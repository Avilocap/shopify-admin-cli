# Store Manager

Disclaimer: this project was developed using 100% AI.

Private CLI for managing Shopify stores from the terminal.

## Current status

MVP in progress with focus on:

- multi-store configuration
- authentication against Shopify Admin GraphQL
- `shop info`
- `products list`
- `products get`

## Requirements

- Node.js 20 or higher
- An app created in Shopify Dev Dashboard and installed on each store
- Per-store credentials:
  - `domain` (`*.myshopify.com`, not the public domain)
  - `clientId`
  - `clientSecret`

Legacy `accessToken` is also supported as an optional compatibility path for older apps.

## Install dependencies

```bash
npm install
```

## Development

```bash
npm run dev -- --help
```

## Build

```bash
npm run build
```

## Store configuration

The CLI stores configuration in:

```text
~/.store-manager/stores.json
```

Example:

```json
{
  "stores": {
    "main": {
      "name": "Main Store",
      "domain": "main-store.myshopify.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret"
    }
  },
  "defaultStore": "main"
}
```

## First commands

```bash
store-manager config add main --domain main-store.myshopify.com --client-id xxx --client-secret yyy
store-manager config list
store-manager shop info
store-manager products list --limit 10
store-manager products search "corona"
store-manager products get gid://shopify/Product/1234567890
store-manager products get 1234567890
store-manager products get paso-macarena-miniatura --handle
```

## API version

The default version is `2026-01`. You can override it with:

```bash
SHOPIFY_API_VERSION=2026-01 store-manager shop info
```

## Products

`products list` supports simple filters:

```bash
store-manager products list --vendor Pichardo --type Pasito --status active
store-manager products list --query 'tag:"miniatura" status:active' --sort updated-at
```

`products search` uses Shopify's default search and sorts by relevance.
