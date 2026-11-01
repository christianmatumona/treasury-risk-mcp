// x402 payment client for the MCP server: pays the Treasury Risk Analyzer's standard `exact`
// (EIP-3009 USDC) rail on Base with the user's own key. The key never leaves this process —
// it only signs a USDC transfer authorization for the exact price the 402 asks for.

import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

export const NETWORK = 'eip155:8453'; // Base mainnet
const GATEWAY_BATCHED = 'GatewayWalletBatched';

/** Parses a "$0.50"/"0.50" style USD amount; returns NaN when invalid. */
export function parseUsd(value) {
  const n = Number(String(value ?? '').trim().replace(/^\$/, ''));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * @param {object} opts
 * @param {string|undefined} opts.privateKey  0x-prefixed 32-byte hex key, or undefined (no payments)
 * @param {number} opts.maxPaymentUsd         hard per-call cap, enforced before signing
 */
export function createPayer({ privateKey, maxPaymentUsd }) {
  if (!privateKey) return { enabled: false, address: null, fetch: null };
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('X402_PRIVATE_KEY must be a 0x-prefixed 64-hex-character private key');
  }
  const account = privateKeyToAccount(privateKey);
  const capAtomic = BigInt(Math.round(maxPaymentUsd * 1e6)); // USDC has 6 decimals

  const client = new x402Client()
    .register(NETWORK, new ExactEvmScheme(account))
    // The service also offers Circle Gateway batching on the same network/scheme; this client
    // signs plain EIP-3009 transfers, so it must never pick the Gateway option.
    .registerPolicy((_v, reqs) => reqs.filter((r) => r.extra?.name !== GATEWAY_BATCHED))
    // Defense in depth on top of the SDK's own spend controls: never sign above the user's cap.
    .registerPolicy((_v, reqs) => reqs.filter((r) => {
      try { return BigInt(r.amount) <= capAtomic; } catch { return false; }
    }))
    .setSpendControls({ maxAmountPerPayment: `$${maxPaymentUsd}` });

  return { enabled: true, address: account.address, fetch: wrapFetchWithPayment(fetch, client) };
}

/** Decodes the PAYMENT-RESPONSE settlement receipt, if present. */
export function readReceipt(response) {
  const header = response.headers.get('payment-response');
  if (!header) return null;
  try { return decodePaymentResponseHeader(header); } catch { return null; }
}

/** Decodes a 402's PAYMENT-REQUIRED header into the accepted options (for quoting). */
export function readPaymentRequired(response) {
  const header = response.headers.get('payment-required');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf-8')); } catch { return null; }
}
