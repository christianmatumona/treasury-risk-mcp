# treasury-risk-mcp

MCP server for the **Treasury Risk Analyzer**: deterministic financial decision services for AI Treasury and CFO agents. It covers treasury risk, FX exposure, the liquidity forecast, and one question: *"Can we safely execute this payment today?"*

Each call is paid in **USDC on Base** via [x402](https://x402.org). There is no account, no API key and no subscription. Your agent pays per call from its own wallet, and only when the input is valid.

## Tools

| Tool | Price | What it answers |
|---|---|---|
| `describe_service` | free | What the service does, its prices, and whether payments are configured |
| `get_example_input` | free | A valid example input for any paid tool |
| `treasury_risk` | $0.10 | Volatility, Sharpe/Sortino/Calmar, VaR/CVaR, HHI concentration, risk contribution, correlated stress tests |
| `fx_exposure` | $0.25 | Gross/net exposure by currency, natural hedges, FX stress scenarios, hedge priority |
| `liquidity_forecast` | $0.50 | Daily cash projection, minimum cash and its date, buffer breach, liquidity status, optional DSO/DPO/DIO |
| `treasury_decision` | $2.00 | PAY / REVIEW / DO_NOT_PAY for a payment, combining liquidity, FX and risk, with a confidence score |

No LLM computes any figure: every metric is deterministic and documented in the response's `methodology`.

## Install

Claude Desktop (`claude_desktop_config.json`), Cursor, or any MCP client:

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

| Variable | Default | Meaning |
|---|---|---|
| `X402_PRIVATE_KEY` | *(none)* | Private key of a Base wallet that holds USDC. Without it, paid tools only validate your input and return the price. |
| `MAX_PAYMENT_USD` | `2.00` | Hard per-call cap. A tool priced above it is refused before anything is signed. |
| `TREASURY_API_URL` | production URL | Override the service URL. |

**Wallet safety:** use a dedicated wallet that holds only a few USDC. The key stays in the MCP process on your machine. It is only used to sign an EIP-3009 USDC transfer for the exact price the service asks for, never more than `MAX_PAYMENT_USD`. No ETH is needed for gas, because the facilitator submits the transfer.

## How payment works

1. The tool sends your input to the API. Invalid input gets a free `400` and you are never charged.
2. Valid input gets `402 Payment Required` with the price.
3. The server signs a USDC authorization for that price and retries.
4. The payment settles on Base, and the analysis comes back with a `_payment` receipt (transaction hash, payer, network).

## Limits

- The output is analytics and decision support, not investment advice. It does not execute any payment.
- It only analyses the data you supply. It does not fetch market data.
- The HTTP API is also callable directly. Its OpenAPI spec is at `/openapi.yaml` and `/openapi.json`.
