# Shopfleet CLI - Implementation Plan

Multi-store Shopify CLI built on the GraphQL Admin API.

## Current status

### Already implemented

- `config add`
- `config remove`
- `config list`
- `config set-default`
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
- `gift-cards list`
- `gift-cards get`
- `gift-cards create`
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
- `fulfillment list`
- `fulfillment create`
- `fulfillment tracking`
- `analytics custom`
- `analytics sales`
- `analytics products`
- `analytics overview`
- migration from `~/.store-manager/stores.json` to `~/.shopfleet/stores.json`
- agent-friendly `--help` for implemented commands

### Validated against a real store

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
- `collections list`
- `collections get`
- `collections products`
- `analytics custom`
- `analytics sales`
- `analytics products`
- `analytics overview`

Notes:

- product write operations were tested with an isolated temporary product
- the temporary product was deleted at the end of the validation flow
- order cancellation is implemented but was not executed against a real order
- financial refund is implemented but was not executed against a real order
- collections commands were validated in read-only mode against a real store
- gift card commands are implemented but not yet validated against a real sandbox store
- analytics Phase 1 was validated against the real store through ShopifyQL

### In progress

- keeping plan, README, and CLI help aligned as command contracts evolve

### Pending

- the rest of the command catalog

## 1. Technical stack

| Decision | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript | Strong typing, autocomplete, good fit for GraphQL |
| Runtime | Node.js (>=20) | Native Shopify ecosystem |
| CLI framework | Commander.js | Mature, subcommands, flags, extensible help |
| GraphQL client | native `fetch` | Fewer dependencies, enough for the MVP |
| Output | cli-table3 + chalk | Readable tables and terminal colors |
| Config | JSON file in home directory | Easy to inspect, debug, and share between agents |
| Package manager | npm | Standard |
| Build | tsup | Fast bundler for TS CLIs |
| Testing | vitest | Fast and TypeScript-friendly |

## 2. Project structure

```text
shopfleet/
├── src/
│   ├── index.ts                  # CLI entry point
│   ├── client.ts                 # GraphQL client (multi-store)
│   ├── config.ts                 # Store config management
│   ├── types.ts                  # Core types
│   ├── commands/
│   │   ├── products.ts           # Product commands
│   │   ├── orders.ts             # Order commands
│   │   ├── customers.ts          # Customer commands
│   │   ├── inventory.ts          # Inventory commands
│   │   ├── collections.ts        # Collection commands
│   │   ├── discounts.ts          # Discount commands
│   │   ├── fulfillment.ts        # Fulfillment commands
│   │   ├── financial.ts          # Financial commands
│   │   ├── gift-cards.ts         # Gift card commands
│   │   ├── content.ts            # Pages and blogs
│   │   ├── webhooks.ts           # Webhook commands
│   │   ├── draft-orders.ts       # Draft order commands
│   │   ├── metafields.ts         # Metafield and metaobject commands
│   │   ├── analytics.ts          # Reporting and analytics
│   │   ├── shop.ts               # Shop info, locations, markets
│   │   └── redirects.ts          # URL redirects
│   ├── graphql/
│   │   ├── products.ts           # Product queries and mutations
│   │   ├── orders.ts             # Order queries
│   │   ├── customers.ts          # Customer queries
│   │   ├── inventory.ts          # Inventory queries and mutations
│   │   ├── collections.ts        # Collection queries
│   │   ├── discounts.ts          # Discount queries and mutations
│   │   ├── fulfillment.ts        # Fulfillment queries and mutations
│   │   ├── financial.ts          # Transaction and refund queries
│   │   ├── gift-cards.ts         # Gift card queries and mutations
│   │   ├── content.ts            # Page and blog queries and mutations
│   │   ├── webhooks.ts           # Webhook queries and mutations
│   │   ├── draft-orders.ts       # Draft order queries and mutations
│   │   ├── metafields.ts         # Metafield queries and mutations
│   │   ├── analytics.ts          # Analytics queries
│   │   └── shop.ts               # Shop queries
│   └── utils/
│       ├── output.ts             # Table and JSON formatting
│       └── pagination.ts         # Cursor pagination helper
├── package.json
├── tsconfig.json
├── AGENTS.md
├── CLAUDE.md
├── .gitignore
└── README.md
```

## 3. Multi-store configuration

### File: `~/.shopfleet/stores.json`

```json
{
  "stores": {
    "store1": {
      "name": "My Main Store",
      "domain": "my-store.myshopify.com",
      "clientId": "client_id_xxxxx",
      "clientSecret": "client_secret_xxxxx"
    },
    "store2": {
      "name": "My Second Store",
      "domain": "other-store.myshopify.com",
      "clientId": "client_id_yyyyy",
      "clientSecret": "client_secret_yyyyy"
    }
  },
  "defaultStore": "store1"
}
```

Notes:

- `domain` must always be the admin domain `*.myshopify.com`, not the public storefront domain.
- The main flow uses `clientId` + `clientSecret`.
- Legacy `accessToken` remains only as optional compatibility for older apps.

### Using the `--store` flag

```bash
# Use the default store
shopfleet products list

# Use a specific store
shopfleet products list --store store2

# Change the default store
shopfleet config set-default store2
```

### Configuration commands

```bash
shopfleet config add <alias> --domain <domain> --client-id <clientId> --client-secret <clientSecret>
shopfleet config remove <alias>
shopfleet config list
shopfleet config set-default <alias>
```

## 4. Full operation catalog

Reference: operations from MCP `@ajackus/shopify-mcp-server` (47 tools) plus useful extras.

### 4.1 Products (6 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `products list` | `products` query | List products with filters |
| done | `products get <id>` | `product` query | Product detail |
| done | `products create` | `productCreate` mutation | Create product |
| done | `products update <id>` | `productUpdate` mutation | Update product |
| done | `products delete <id>` | `productDelete` mutation | Delete product |
| done | `products search <query>` | `products` query + filter | Search by title, SKU, vendor, or type |

Common flags: `--limit`, `--after`, `--sort`, `--reverse`, `--status`, `--vendor`, `--type`, `--tag`
Create and update flags: `--title`, `--description`, `--vendor`, `--type`, `--tags`, `--status`
Current output: `--format table|json`

### 4.2 Orders (4 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `orders list` | `orders` query | List orders with filters |
| done | `orders get <id>` | `order` query | Order detail |
| done | `orders transactions <id>` | `order` query | Order transactions |
| done | `orders cancel <id>` | `orderCancel` | Cancel order |

Flags: `--status`, `--financial-status`, `--fulfillment-status`, `--from`, `--to`, `--limit`, `--after`, `--sort`, `--reverse`

### 4.3 Customers (4 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `customers list` | `customers` query | List customers |
| done | `customers get <id>` | `customer` query | Customer detail |
| done | `customers search <query>` | `customers` + filter | Search by name, email, or phone |
| done | `customers orders <id>` | `customer.orders` | Orders for a customer |

Flags: `--limit`, `--after`, `--sort`, `--reverse`

### 4.4 Inventory (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `inventory levels` | `inventoryItems` query | Inventory levels |
| done | `inventory adjust` | `inventoryAdjustQuantities` | Adjust quantity |
| done | `inventory locations` | `locations` query | List locations |

Level flags: `--item-id`, `--location-id`, `--sku`, `--name`, `--limit`, `--after`
Adjust flags: `--item-id`, `--location-id`, `--quantity`, `--name`, `--reason`
Location flags: `--limit`, `--after`, `--query`, `--include-inactive`, `--include-legacy`

### 4.5 Collections (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `collections list` | `collections` query | List collections |
| done | `collections get <id>` | `collection` query | Collection detail |
| done | `collections products <id>` | `collection.products` | Products in a collection |

Flags: `--limit`, `--after`, `--sort`, `--reverse`, `--query`, `--type smart|custom`

### 4.6 Discounts (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `discounts list` | `discountNodes` query | List discounts |
| done | `discounts get <id>` | `discountNode` query | Discount detail |
| done | `discounts create` | `discountCodeBasicCreate` | Create discount code |

Create flags: `--title`, `--code`, `--starts`, `--ends`, `--usage-limit`, `--percentage`, `--amount`, `--once-per-customer`

### 4.7 Fulfillment (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `fulfillment list` | `fulfillmentOrders` query | List fulfillment orders |
| done | `fulfillment create` | `fulfillmentCreate` | Create fulfillment |
| done | `fulfillment tracking <id>` | `fulfillmentTrackingInfoUpdate` | Update tracking |

Flags: `--limit`, `--after`, `--query`, `--status`, `--include-closed`, `--sort`, `--reverse`
Create flags: `--order-id`, `--fulfillment-order-id`, `--line-items`, `--tracking-number`, `--tracking-url`, `--carrier`, `--message`, `--notify`
Tracking flags: `--tracking-number`, `--tracking-url`, `--carrier`, `--notify`

### 4.8 Financial (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `financial transactions <order-id>` | `order.transactions` | Transactions for an order |
| done | `financial refund <order-id>` | `refundCreate` | Create refund |
| done | `financial summary` | Calculated from orders | Financial summary |

Refund flags: `--line-items`, `--shipping-amount`, `--note`, `--notify`, `--restock`, `--force`
Summary flags: `--limit`, `--query`, `--status`, `--financial-status`, `--fulfillment-status`, `--from`, `--to`

### 4.9 Gift cards (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `gift-cards list` | `giftCards` query | List gift cards |
| done | `gift-cards get <id>` | `giftCard` query | Gift card detail |
| done | `gift-cards create` | `giftCardCreate` | Create gift card |

Create flags: `--value`, `--code`, `--note`, `--expires`, `--recipient-email`, `--recipient-message`, `--notify`

### 4.10 Content (4 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| pending | `pages list` | `pages` query (REST/GQL) | List pages |
| pending | `pages create` | `pageCreate` | Create page |
| pending | `blogs list` | `blogs` query | List blogs |
| pending | `blogs create-article` | `articleCreate` | Create blog article |

### 4.11 Webhooks (3 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| pending | `webhooks list` | `webhookSubscriptions` query | List webhooks |
| pending | `webhooks create` | `webhookSubscriptionCreate` | Create webhook |
| pending | `webhooks delete <id>` | `webhookSubscriptionDelete` | Delete webhook |

### 4.12 Analytics (Phase 1, pure analytics) (4 commands)

| Status | Command | GraphQL operation | Description |
| --- | --- | --- | --- |
| done | `analytics custom` | `shopifyqlQuery` | Run a raw ShopifyQL query and return structured tabular data |
| done | `analytics sales` | `shopifyqlQuery` | Sales-focused preset for revenue, orders, averages, and trend analysis |
| done | `analytics products` | `shopifyqlQuery` | Product-focused preset for top products, units sold, and product performance |
| done | `analytics overview` | `shopifyqlQuery` | Executive snapshot of the store for agents: sales, orders, AOV, and key trends |

Core flags: `--since`, `--until`, `--during`, `--timeseries`, `--group-by`, `--limit`, `--compare-to`, `--format`

Notes:

- Phase 1 is intentionally ShopifyQL-first and read-only.
- The goal is agent consumption, so output should be normalized for machine use: query, columns, rows, parse errors, and metadata.
- `analytics custom` is the core primitive. The other commands are presets built on top of it.
- Customer analytics, traffic, conversion, abandonment, and marketing are intentionally deferred until the data model is clearer.

## 5. Cross-cutting behavior

### Current

- `--format table|json` on implemented commands
- manual pagination with `--after`
- explicit `--help` with examples for implemented commands
- destructive product deletion requires `--force`

### Deferred

- CSV output
- automatic `--all` pagination
- verbose GraphQL output
- destructive confirmations beyond the current `--force` guard
