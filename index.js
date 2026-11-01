#!/usr/bin/env node
// Treasury Risk Analyzer — MCP server (stdio).
//
// Tools:
//   describe_service    free  — what the service does, prices, payment status of this server
//   get_example_input   free  — a valid example request body for any paid tool
//   treasury_risk       $0.10 — POST /treasury-risk
//   fx_exposure         $0.25 — POST /fx-exposure
//   liquidity_forecast  $0.50 — POST /liquidity
//   treasury_decision   $2.00 — POST /treasury-decision
//
// Config (env):
//   X402_PRIVATE_KEY   key of a Base wallet holding USDC; without it, paid tools only return a quote
//   MAX_PAYMENT_USD    per-call spending cap, default 2.00 (covers the most expensive tool)
//   TREASURY_API_URL   service base URL (default: public production deployment)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createPayer, parseUsd, readReceipt, readPaymentRequired, NETWORK } from './payment.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf-8'));
const { tools: PAID_TOOLS } = JSON.parse(fs.readFileSync(path.join(here, 'schemas.json'), 'utf-8'));

const API_URL = (process.env.TREASURY_API_URL || 'https://portfolio-risk-analyzer-g9ao.onrender.com').replace(/\/$/, '');
// Total budget per tool call (including the 402 → pay → retry round trip). Kept under the 60 s
// tool-call timeout most MCP clients apply, so the agent gets a structured error instead of a
// client-side timeout.
const REQUEST_TIMEOUT_MS = 50_000;

const unreachable = (err) => ({
  status: 'service_unreachable',
  charged: false,
  message: `Could not reach ${API_URL}: ${err.name === 'TimeoutError' ? `no response within ${REQUEST_TIMEOUT_MS / 1000}s` : err.message}. The host may be starting up — retry in about a minute.`,
});

export function buildServer({ env = process.env, fetchImpl = fetch } = {}) {
  const maxPaymentUsd = parseUsd(env.MAX_PAYMENT_USD ?? '2.00');
  if (Number.isNaN(maxPaymentUsd)) throw new Error('MAX_PAYMENT_USD must be a non-negative number, e.g. "2.00"');
  const payer = createPayer({ privateKey: env.X402_PRIVATE_KEY, maxPaymentUsd });
  const byName = new Map(PAID_TOOLS.map((t) => [t.name, t]));

  const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });
  const fail = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: true });

  const listTools = () => [
    {
      name: 'describe_service',
      description: 'Free. Describes the Treasury Risk Analyzer (deterministic treasury risk, FX exposure, liquidity and payment-decision analytics for AI Treasury/CFO agents), lists the paid tools with their USDC prices, and reports whether this server is configured to pay.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
      name: 'get_example_input',
      description: 'Free. Returns a valid example input for one of the paid tools — a quick way to learn the expected shape before paying.',
      inputSchema: {
        type: 'object',
        properties: { tool: { type: 'string', enum: PAID_TOOLS.map((t) => t.name) } },
        required: ['tool'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
    ...PAID_TOOLS.map((t) => ({
      name: t.name,
      description: `PAID: $${t.price_usd} USDC per call on Base (x402), charged only for valid input. ${t.summary}. ${t.description} All figures are computed deterministically (no LLM). Call get_example_input first if unsure of the shape.`,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    })),
  ];

  async function callApi(route, body, { pay }) {
    const doFetch = pay ? payer.fetch : fetchImpl;
    return doFetch(`${API_URL}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': `${pkg.name}/${pkg.version}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  async function readJson(response) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
  }

  async function callPaidTool(tool, args) {
    const price = parseUsd(tool.price_usd);

    if (!payer.enabled) {
      // Free pre-check: the service validates input before asking for payment.
      let res;
      try {
        res = await callApi(tool.route, args, { pay: false });
      } catch (err) {
        return fail(unreachable(err));
      }
      if (res.status === 400) return fail({ status: 'invalid_input', charged: false, details: await readJson(res) });
      return fail({
        status: 'payment_not_configured',
        charged: false,
        price_usd: tool.price_usd,
        // 402 means the service validated the input and asked for payment; anything else
        // (5xx, 404…) means it could not check, so validity is unknown rather than false.
        input_valid: res.status === 402 ? true : 'unknown',
        ...(res.status !== 402 && { http_status: res.status }),
        message: 'This MCP server has no wallet configured. Set X402_PRIVATE_KEY (a Base wallet holding USDC) in the MCP server environment to enable paid calls.',
      });
    }

    if (price > maxPaymentUsd) {
      return fail({ status: 'over_spending_cap', charged: false, price_usd: tool.price_usd, max_payment_usd: maxPaymentUsd,
        message: `This tool costs $${tool.price_usd}, above MAX_PAYMENT_USD=${maxPaymentUsd}. Raise the cap to use it.` });
    }

    let res;
    try {
      res = await callApi(tool.route, args, { pay: true });
    } catch (err) {
      return fail({ status: 'payment_or_network_error', charged: 'unknown', message: err.message });
    }
    const receipt = readReceipt(res);
    const data = await readJson(res);

    if (res.ok) {
      return ok({ ...data, _payment: receipt ? { charged: true, price_usd: tool.price_usd, ...receipt } : { charged: true, price_usd: tool.price_usd } });
    }
    if (res.status === 400) return fail({ status: 'invalid_input', charged: false, details: data });
    if (res.status === 402) {
      const pr = readPaymentRequired(res);
      return fail({ status: 'payment_failed', charged: false, details: data,
        hint: `Check that ${payer.address} holds enough USDC on Base (${NETWORK}).`, accepted: pr?.accepts?.length ?? undefined });
    }
    return fail({ status: 'service_error', http_status: res.status, charged: receipt ? true : 'unknown', details: data });
  }

  const server = new Server({ name: pkg.name, version: pkg.version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      if (name === 'describe_service') {
        let service = null;
        try {
          const res = await fetchImpl(`${API_URL}/`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
          service = await readJson(res);
        } catch (err) {
          service = { unreachable: err.message };
        }
        return ok({
          service_url: API_URL,
          tools: PAID_TOOLS.map((t) => ({ name: t.name, price_usd: t.price_usd, summary: t.summary })),
          payment: { protocol: 'x402 v2', network: NETWORK, asset: 'USDC', configured: payer.enabled, payer_address: payer.address, max_payment_usd: maxPaymentUsd },
          service,
        });
      }
      if (name === 'get_example_input') {
        const tool = byName.get(args.tool);
        if (!tool) return fail({ status: 'unknown_tool', known: [...byName.keys()] });
        return ok({ tool: tool.name, price_usd: tool.price_usd, example: tool.example });
      }
      const tool = byName.get(name);
      if (!tool) return fail({ status: 'unknown_tool', name });
      return await callPaidTool(tool, args);
    } catch (err) {
      return fail({ status: 'internal_error', message: err.message });
    }
  });

  return { server, payer, maxPaymentUsd };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const { server, payer, maxPaymentUsd } = buildServer();
  await server.connect(new StdioServerTransport());
  // Wake the host in the background so the first tool call doesn't pay for its cold start.
  // Free route, fire-and-forget; failures are irrelevant here.
  fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then((r) => r.body?.cancel()).catch(() => {});
  // stdout is the MCP channel — log to stderr only.
  console.error(`${pkg.name} ${pkg.version} ready — API ${API_URL}; payments ${payer.enabled ? `enabled from ${payer.address}, cap $${maxPaymentUsd}/call` : 'disabled (no X402_PRIVATE_KEY)'}`);
}
