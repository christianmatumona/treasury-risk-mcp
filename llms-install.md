# Installing treasury-risk-mcp (instructions for AI agents)

Follow these steps exactly. Nothing needs to be cloned or built: the server is published on npm and runs with `npx`.

## 1. Requirements

- Node.js 20 or newer (`node --version`).

## 2. Add the server to the MCP configuration

Add this entry to the user's MCP settings file (for Cline: `cline_mcp_settings.json`; for Claude Desktop: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "treasury-risk": {
      "command": "npx",
      "args": ["-y", "treasury-risk-mcp"],
      "env": {
        "MAX_PAYMENT_USD": "2.00"
      }
    }
  }
}
```

Do **not** add `X402_PRIVATE_KEY` yourself and do not ask the user to paste a private key into the chat. Without it the server works in free mode: all tools are listed, `describe_service` and `get_example_input` work, and paid tools validate the input and return the price without charging anything.

If the first start times out (the first `npx` run downloads dependencies), install globally instead and use the binary:

```bash
npm install -g treasury-risk-mcp
```

```json
{ "mcpServers": { "treasury-risk": { "command": "treasury-risk-mcp", "env": { "MAX_PAYMENT_USD": "2.00" } } } }
```

## 3. Verify the installation

1. Call `describe_service` with no arguments. Expect `service.name` = `"Treasury Risk Analyzer"` and `payment.configured` = `false`.
2. Call `get_example_input` with `{ "tool": "fx_exposure" }`, then call `fx_exposure` with the returned `example`. Expect `status` = `"payment_not_configured"`, `input_valid` = `true` and `charged` = `false`.

If both succeed, the installation is complete.

## 4. Enabling paid calls (the user does this, not the agent)

Tell the user that to run real analyses they need to:

- create a **dedicated** wallet on Base that holds only a few USDC (no ETH needed);
- set its private key as `X402_PRIVATE_KEY` in the `env` block themselves;
- keep `MAX_PAYMENT_USD` as the hard per-call spending cap.

Prices: `treasury_risk` $0.10, `fx_exposure` $0.25, `liquidity_forecast` $0.50, `treasury_decision` $2.00 per call. Invalid input is never charged.
