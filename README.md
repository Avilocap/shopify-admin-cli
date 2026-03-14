# Shopfleet

Disclaimer: this project was developed using 100% AI.

Private CLI for managing Shopify stores from the terminal.

## Current status

MVP in progress with focus on:

- multi-store configuration
- authentication against Shopify Admin GraphQL
- `shop info`
- `products list`
- `products get`
- `products search`
- `products create`
- `products update`
- `products delete`
- `orders list`
- `orders get`
- `orders transactions`
- `orders cancel`

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
~/.shopfleet/stores.json
```

If `~/.store-manager/stores.json` exists from the previous CLI name, Shopfleet moves it automatically on first use.

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
shopfleet config add main --domain main-store.myshopify.com --client-id xxx --client-secret yyy
shopfleet config list
shopfleet shop info
shopfleet products list --limit 10
shopfleet products search "corona"
shopfleet products get gid://shopify/Product/1234567890
shopfleet products get 1234567890
shopfleet products get paso-macarena-miniatura --handle
shopfleet products create --title "Test product" --status draft
shopfleet products update 1234567890 --title "Updated title"
shopfleet products delete 1234567890 --force
shopfleet orders list --limit 10
shopfleet orders get 1234567890 --format table
shopfleet orders transactions 1234567890
shopfleet orders cancel 1234567890 --reason customer --refund-method original --force
```

## API version

The default version is `2026-01`. You can override it with:

```bash
SHOPIFY_API_VERSION=2026-01 shopfleet shop info
```

## Products

`products list` supports simple filters:

```bash
shopfleet products list --vendor Pichardo --type Pasito --status active
shopfleet products list --query 'tag:"miniatura" status:active' --sort updated-at
```

`products search` uses Shopify's default search and sorts by relevance.

Write commands are also available:

```bash
shopfleet products create --title "Test product" --vendor Pichardo --type Accesorio --tags test,cli
shopfleet products update my-product --handle --status draft --new-handle my-updated-product
shopfleet products delete my-updated-product --handle --force
```

Current write scope is limited to top-level product fields.
Variants, media, options, and inventory stay out of scope for now.

## Orders

`orders list` supports simple filters:

```bash
shopfleet orders list --financial-status paid --fulfillment-status unfulfilled
shopfleet orders list --from 2026-03-01 --to 2026-03-14 --sort processed-at --reverse
```

`orders get` accepts a Shopify order GID or numeric order ID.
`orders transactions` returns the transaction history for the target order.

`orders cancel` is implemented with explicit safety guards:

```bash
shopfleet orders cancel 1234567890 --force
shopfleet orders cancel 1234567890 --reason customer --refund-method original --notify-customer --force
```

`orders cancel` was not executed against a real order during validation, to avoid changing production order data.
