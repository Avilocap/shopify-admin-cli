# Shopfleet CLI Contract

Use this reference when you need quick command-specific reminders without re-reading every command file.

## Ground Truth Sources

Check these in this order:

1. Targeted `node dist/index.js <group> <command> --help`
2. [`src/commands`](../../../src/commands)
3. [`README.md`](../../../README.md)

The repository docs are close to the code, but the command files and live help are the final contract.

## Command Groups

The current top-level groups are:

- `config`
- `shop`
- `analytics`
- `products`
- `orders`
- `customers`
- `gift-cards`
- `pages`
- `blogs`
- `inventory`
- `collections`
- `fulfillment`
- `discounts`
- `financial`

## Common Patterns

- The global store selector is `--store <alias>`.
- Most read and write commands support `--format table|json`.
- Read commands usually default to JSON unless the help says otherwise.
- Shopify admin domains must be `*.myshopify.com`.
- Never expose `clientSecret` or legacy tokens in logs or examples.

## Identifier Rules

Use command help to confirm exact input, but these rules are important:

- `products get|update|delete` accept a product GID or numeric product ID by default. Use `--handle` to treat the argument as a handle.
- `orders get|transactions|cancel` accept an order GID or numeric order ID.
- `customers get|orders` accept a customer GID or numeric customer ID.
- `gift-cards get` accepts a gift card GID or numeric ID.
- `collections get|products` accept a collection GID or numeric ID.
- `inventory adjust --item-id` expects an inventory item GID or numeric ID.
- `inventory adjust --location-id` expects a location GID or numeric ID.
- `fulfillment create --fulfillment-order-id` expects a fulfillment order GID or numeric ID.
- `fulfillment create --line-items` expects fulfillment order line item IDs, not order line item IDs.

## Mutation Commands

These commands mutate Shopify data and should be treated as real store operations:

- `products create`
- `products update`
- `products delete`
- `orders cancel`
- `gift-cards create`
- `pages create`
- `blogs create-article`
- `financial refund`
- `inventory adjust`
- `fulfillment create`
- `fulfillment tracking`
- `discounts create`

Notes:

- `orders cancel` is explicitly destructive and requires `--force`.
- `products delete` also requires careful confirmation because it removes catalog data.
- `discounts create` requires exactly one of `--percentage` or `--amount`.
- `inventory adjust --quantity` is a signed delta, not an absolute quantity.
- Analytics commands are read-only and implemented on ShopifyQL.

## Safe Validation Recipes

### Inspect help

```bash
node dist/index.js products get --help
node dist/index.js fulfillment create --help
```

### Exercise config locally without touching Shopify

```bash
node dist/index.js config add skill-temp --domain example-dev-store.myshopify.com --client-id fake --client-secret fake
node dist/index.js config list
node dist/index.js config remove skill-temp
```

### Verify destructive guards without mutating the store

```bash
node dist/index.js orders cancel 1234567890
```

This should fail locally because `--force` is required.

### Read from an existing configured alias

```bash
node dist/index.js shop info --store <alias>
node dist/index.js products list --store <alias> --limit 1
```

Treat any existing alias as a real store. Read-only commands are the default safe probe when you need context before a write.

## Repo Workflow Reminders

- Entry point: [`src/index.ts`](../../../src/index.ts)
- Config layer: [`src/config.ts`](../../../src/config.ts)
- Shopify client: [`src/client.ts`](../../../src/client.ts)
- GraphQL documents: [`src/graphql`](../../../src/graphql)
- Output helpers: [`src/utils/output.ts`](../../../src/utils/output.ts)

After code changes, run:

```bash
npm run build
npm run typecheck
npm test
```
