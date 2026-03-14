# Shopfleet

Disclaimer: this project was developed using 100% AI.

CLI for managing Shopify stores from the terminal.

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
- `customers list`
- `customers get`
- `customers search`
- `customers orders`
- `financial transactions`
- `financial refund`
- `financial summary`
- `inventory levels`
- `inventory adjust`
- `inventory locations`
- `collections list`
- `collections get`
- `collections products`
- `discounts list`
- `discounts get`
- `discounts create`

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

## Create a custom app for a store

Starting on January 1, 2026, Shopify no longer lets you create new "legacy custom apps" from a store admin. New custom apps must be created and managed in Shopify Dev Dashboard.

For each store:

1. Open the store admin.
2. Go to `Settings > Apps`.
3. Click `Develop apps`.
4. Click `Build apps in Dev Dashboard`.
5. In Dev Dashboard, click `Create app`.
6. Open the `Versions` tab and create the first version.
7. If the app is not embedded in the Shopify admin, set `App URL` to `https://shopify.dev/apps/default-app-home`.
8. Choose a recent `Webhooks API` version.
9. Add the Admin API scopes you need.
10. Release the version.
11. From `Home`, install the app on that store.
12. Open the app `Settings` and copy `Client ID` and `Client secret`.

Shopfleet uses `clientId` and `clientSecret` for new apps. It requests an Admin API `access_token` from `POST /admin/oauth/access_token` with the `client_credentials` grant when needed. Tokens from this flow expire after 24 hours, so the CLI requests a fresh token again when required.

Recommended Admin API scopes:

- `write_products`
- `write_orders`
- `read_all_orders`
- `write_customers`
- `write_inventory`
- `write_discounts`
- `read_assigned_fulfillment_orders`
- `write_assigned_fulfillment_orders`
- `read_merchant_managed_fulfillment_orders`
- `write_merchant_managed_fulfillment_orders`
- `read_third_party_fulfillment_orders`
- `write_third_party_fulfillment_orders`
- `write_gift_cards`
- `write_content`
- `write_draft_orders`
- `write_metaobject_definitions`
- `write_metaobjects`
- `write_online_store_navigation`
- `read_price_rules`
- `read_reports`
- `read_locations`
- `read_markets`
- `read_themes`

Then register the store in the CLI:

```bash
shopfleet config add main --domain main-store.myshopify.com --client-id your-client-id --client-secret your-client-secret
```

Notes:

- `--domain` must be the Shopify admin domain in the `*.myshopify.com` format.
- `clientId` and `clientSecret` are the values from the app `Settings` page in Dev Dashboard.
- Legacy `accessToken` support remains available only for older apps that already use that model.

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
shopfleet customers list --limit 10
shopfleet customers search maria@example.com
shopfleet customers get 1234567890 --format table
shopfleet customers orders 1234567890 --limit 10
shopfleet financial transactions 1234567890
shopfleet financial refund 1234567890 --line-items 987654321:1 --force
shopfleet financial summary --from 2026-03-01 --to 2026-03-14
shopfleet inventory levels --sku ABC-123
shopfleet inventory adjust --item-id 30322695 --location-id 124656943 --quantity -4
shopfleet inventory locations --limit 10
shopfleet collections list --limit 10
shopfleet collections get 1234567890 --format table
shopfleet collections products 1234567890 --limit 10
shopfleet discounts list --limit 10
shopfleet discounts get gid://shopify/DiscountNode/1234567890 --format table
shopfleet discounts create --title "Spring 10" --code SPRING10 --starts 2026-03-14 --percentage 10
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
Variants, media, and options stay out of scope here.
Inventory operations live under the dedicated `inventory` command group.

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

## Customers

`customers list` supports raw Shopify customer search syntax:

```bash
shopfleet customers list --query "state:enabled" --sort updated-at
shopfleet customers list --query "tag:VIP" --reverse
```

`customers search` builds a search query over first name, last name, email, and phone.
`customers get` accepts a Shopify customer GID or numeric customer ID.
`customers orders` reads the customer's `orders` connection directly.

```bash
shopfleet customers search maria
shopfleet customers get gid://shopify/Customer/1234567890
shopfleet customers orders 1234567890 --sort processed-at
```

## Inventory

`inventory levels` lists inventory quantities per inventory item and location:

```bash
shopfleet inventory levels --limit 20
shopfleet inventory levels --sku ABC-123 --name available
shopfleet inventory levels --item-id 30322695 --location-id 124656943 --format json
```

`inventory levels` accepts an inventory item GID or numeric inventory item ID with `--item-id`.
`--location-id` accepts a location GID or numeric location ID and narrows each inventory item to that location.
`--name` reads one inventory quantity state at a time and defaults to `available`.

`inventory adjust` applies a signed delta at one location:

```bash
shopfleet inventory adjust --item-id 30322695 --location-id 124656943 --quantity -4
shopfleet inventory adjust --item-id gid://shopify/InventoryItem/30322695 --location-id gid://shopify/Location/124656943 --quantity 10 --reference gid://shopfleet/InventoryAdjustment/2026-03-14-001
```

`inventory adjust` expects an inventory item GID or numeric ID plus a location GID or numeric ID.
`--quantity` is a signed delta, not an absolute quantity.
Shopify requires `--ledger-document-uri` when `--name` is not `available`.

`inventory locations` lists stock locations:

```bash
shopfleet inventory locations --limit 20
shopfleet inventory locations --query 'name:warehouse' --include-inactive
```

Locations are active-only by default unless `--include-inactive` is set.

## Financial

`financial transactions` returns the transaction history for the target order.

`financial refund` creates a refund through `refundCreate` with explicit safety guards:

```bash
shopfleet financial refund 1234567890 --line-items 987654321:1 --force
shopfleet financial refund gid://shopify/Order/1234567890 --line-items gid://shopify/LineItem/987654321:2 --shipping-amount 6.99 --restock --notify --force
```

`financial refund` expects an order GID or numeric ID.
`--line-items` expects Shopify line item GIDs or numeric line item IDs in the form `<line-item-id>:<quantity>`.
Provide `--line-items`, `--shipping-amount`, or both.
`financial refund` was not executed against a real order during validation, to avoid changing production financial data.

`financial summary` reads matching orders and calculates totals locally:

```bash
shopfleet financial summary --from 2026-03-01 --to 2026-03-14
shopfleet financial summary --financial-status paid --limit 250 --format json
```

`--limit` caps how many matching orders are included in the summary.

## Collections

`collections list` supports simple filtering and sorting:

```bash
shopfleet collections list --type custom --sort updated-at --reverse
shopfleet collections list --query 'title:miniatura'
```

`collections get` accepts a Shopify collection GID or numeric collection ID.
`collections products` lists products inside the target collection with manual pagination.

## Discounts

`discounts list` supports raw Shopify discount search syntax and a small set of convenience filters:

```bash
shopfleet discounts list --status active --method code
shopfleet discounts list --query 'title:"Spring" method:automatic' --sort starts-at
```

`discounts get` accepts a Shopify discount node GID returned by `discounts list` or `discounts create`.
Numeric discount IDs are not supported because Shopify discount node IDs are type-specific.

`discounts create` currently covers one narrow write path:

```bash
shopfleet discounts create --title "Spring 10" --code SPRING10 --starts 2026-03-14 --percentage 10
shopfleet discounts create --title "VIP 20" --code VIP20 --starts 2026-03-14T09:00:00Z --ends 2026-03-31T23:59:59Z --amount 20 --once-per-customer
```

It creates a basic discount code that applies to all buyers and all items.
Pass exactly one of `--percentage` or `--amount`.
