# Installing the GSC Wizard MCP server

GSC Wizard is a hosted (remote) MCP server. There is nothing to clone, build or run locally, and no API key to paste: the client signs in with OAuth 2.1 in the browser.

- Server URL: `https://mcp.gscwizard.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth 2.1 with discovery (RFC 9728) and dynamic client registration (RFC 7591). The first request returns 401; the client then discovers the authorization server and opens the browser.

## Cline

Add this to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "gsc-wizard": {
      "type": "streamableHttp",
      "url": "https://mcp.gscwizard.com/mcp",
      "disabled": false
    }
  }
}
```

Cline opens the browser to authorize. The user signs in to GSC Wizard (Google sign-in) and approves access. Do not add an `Authorization` header or any env vars.

## Requirements to tell the user about

- A GSC Wizard account (https://www.gscwizard.com) with an active plan or free trial.
- Their Google account connected to GSC Wizard with Search Console access. GA4 and Bing Webmaster Tools are optional extra connections made in the GSC Wizard app.

## Verify

Call `list_sites`. It returns the user's Search Console properties. A 401 or "subscription required" error means the user still needs to sign in or start a trial.
