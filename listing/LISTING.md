# Directory listing — treasury-risk-mcp

Copy-paste source for MCP directories (mcp.so, Glama, Smithery, Cline Marketplace, PulseMCP, awesome-mcp-servers…).
Every claim below is verifiable against the live service and the npm package.

---

## Identity

| Field | Value |
|---|---|
| Name | Treasury Risk Analyzer |
| Package | `treasury-risk-mcp` (npm) |
| Registry name | `io.github.christianmatumona/treasury-risk-mcp` |
| npm | https://www.npmjs.com/package/treasury-risk-mcp |
| GitHub | https://github.com/christianmatumona/treasury-risk-mcp |
| Service | https://portfolio-risk-analyzer-g9ao.onrender.com |
| OpenAPI | https://portfolio-risk-analyzer-g9ao.onrender.com/openapi.json |
| Transport | stdio (local, via `npx`) |
| License | ISC |
| Category | Finance / Fintech · Payments |
| Tags | treasury, cfo, fx, liquidity, risk, cash-flow, payments, x402, usdc, base, agents |

## Short description (≤ 100 characters)

> Treasury risk, FX exposure, liquidity & payment decisions for AI CFO agents. Pay per call in USDC.

## One-liner (≤ 160 characters)

> Deterministic treasury analytics for AI CFO and Treasury agents: risk, FX exposure, cash forecast and "can we pay this today?" — pay per call in USDC, no account.

## Long description

Treasury Risk Analyzer gives AI CFO, Treasury and AP/AR agents decision-grade financial analytics as MCP tools. It answers the question a finance agent asks before moving money: **can we safely execute this payment today?**

- **Deterministic.** Every figure is calculated, not generated. No LLM touches the numbers. Each response includes its methodology, data-quality flags, warnings and limitations, so another agent can act on it or escalate.
- **Agent-native output.** Responses are structured JSON with a stable envelope (`risk_classification`, `warnings`, `methodology`, `limitations`). Decisions are machine-actionable: `PAY` / `REVIEW` / `DO_NOT_PAY`.
- **No account, no API key, no subscription.** Each paid call is settled in USDC on Base via the open x402 protocol, from a wallet the user controls, with a hard per-call spending cap. Invalid input is rejected for free, before any payment is requested.
- **Try before paying.** Without a wallet configured, paid tools validate your input and quote the price. `get_example_input` returns a valid example for every tool.

## Tools

| Tool | Price | What it answers |
|---|---|---|
| `describe_service` | free | Capabilities, prices, payment configuration |
| `get_example_input` | free | A valid example input for any paid tool |
| `treasury_risk` | $0.10 | Volatility, Sharpe/Sortino/Calmar, VaR & Expected Shortfall, HHI concentration (asset/currency/geography/sector), risk contribution, correlated stress tests with statistical-significance gating |
| `fx_exposure` | $0.25 | Gross/net exposure by currency, hedged vs unhedged, natural hedges, FX stress scenarios, hedge priority |
| `liquidity_forecast` | $0.50 | Daily cash projection, minimum cash and its date, buffer breach, HEALTHY/WARNING/CRITICAL, optional DSO/DPO/DIO and cash conversion cycle |
| `treasury_decision` | $2.00 | Combines liquidity, FX exposure and treasury risk into PAY / REVIEW / DO_NOT_PAY for a specific payment, with a confidence score and a structured justification |

## Example prompts

- "We need to pay a EUR 750,000 supplier invoice today. Opening cash is $5M, our minimum buffer is $1M. Can we pay it?"
- "Here are our receivables and payables in EUR, GBP and JPY. What is our net FX exposure, and which currency should we hedge first?"
- "Project our cash position for the next 90 days from these scheduled flows, and tell me if we breach our $500k buffer."
- "Assess the risk of our treasury allocation (USD/EUR/GBP cash, USDC, sukuk fund) and stress-test a 10% EUR drop."

## Install

Claude Desktop / Cursor / any MCP client:

```json
{
  "mcpServers": {
    "treasury-risk": {
      "command": "npx",
      "args": ["-y", "treasury-risk-mcp"],
      "env": {
        "X402_PRIVATE_KEY": "0x…",
        "MAX_PAYMENT_USD": "2.00"
      }
    }
  }
}
```

Claude Code:

```bash
claude mcp add treasury-risk -e X402_PRIVATE_KEY=0x… -e MAX_PAYMENT_USD=2.00 -- npx -y treasury-risk-mcp
```

| Variable | Required | Meaning |
|---|---|---|
| `X402_PRIVATE_KEY` | no (needed to pay) | Key of a **dedicated** Base wallet holding a few USDC. Never leaves the local process. |
| `MAX_PAYMENT_USD` | no | Hard per-call cap, default `2.00`. |
| `TREASURY_API_URL` | no | Override the service URL. |

The first `npx` run downloads dependencies, which can take up to a minute. To avoid a client start-up timeout, pre-install with `npm i -g treasury-risk-mcp` and use `"command": "treasury-risk-mcp"`.

## Security & trust

- Wallet key stays local; it only signs an EIP-3009 USDC authorization for the exact price returned by the service, capped by `MAX_PAYMENT_USD`. No ETH needed for gas.
- Read-only analytics: the server never moves funds other than the per-call fee and never executes payments.
- Your financial input is not stored. Only request metadata is logged for usage metrics: route, status, latency, payer address, amount, transaction hash, analysis id, error code and user agent.
- Analytics and decision support only — not investment advice, not a payment instruction.

## Assets

- Logo: `listing/logo.svg` (vector), `listing/logo-400.png` (400×400 PNG)

## Source

Public repository (MCP client only): https://github.com/christianmatumona/treasury-risk-mcp
