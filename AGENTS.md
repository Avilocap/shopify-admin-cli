# AGENTS.md

Operational guide for agents working in this repository.

## Goal

Keep a small, readable, and easy-to-extend private Shopify CLI.

## Principles

- prioritize small, maintainable solutions
- avoid premature abstractions
- do not introduce large dependencies for small problems
- keep behavior explicit and names clear
- do not open new areas until the current vertical is closed

## Current vertical

The active MVP covers:

- multi-store configuration
- Shopify authentication with `clientId` and `clientSecret`
- optional legacy `accessToken` compatibility
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
- `collections list`
- `collections get`
- `collections products`
- `discounts list`
- `discounts get`
- `discounts create`
- `fulfillment list`
- `fulfillment create`
- `fulfillment tracking`

## Expected structure

- `src/index.ts`: CLI entry point
- `src/config.ts`: read and write `~/.shopfleet/stores.json`, migrating from `~/.store-manager/stores.json` when needed
- `src/client.ts`: token exchange and GraphQL calls
- `src/commands/*`: subcommand definitions
- `src/graphql/*`: pure GraphQL queries
- `src/utils/output.ts`: table and JSON rendering

## Implementation rules

- keep the HTTP client on native `fetch` unless there is a clear need
- pin a default `SHOPIFY_API_VERSION` and allow override through env
- support both `clientId/clientSecret` and `accessToken` in config
- never print secrets in logs or tables
- do not introduce analytics, webhooks, or bulk operations in the MVP

## Documentation rules

- all repository documentation must be written in English
- keep `README.md`, `AGENTS.md`, help text, plans, and any new docs in English only
- if you edit existing documentation that is not in English, translate it to English in the same change
- write help for agents, not for humans relying on implicit context
- each command must clearly explain what input it expects
- each command must say whether it expects a GID, a numeric ID, or a handle
- each command must include at least one realistic example in `--help`
- when a command has an important precondition, it must appear in `--help`
- when a command contract changes, update code, `--help`, `README.md`, and this file together when applicable
- prefer direct, operational language: what it does, what it needs, what it returns
- avoid marketing language or vague descriptions

## CLI help convention

Use `addHelpText("after", ...)` in Commander to add:

1. a short context line
2. copyable examples
3. notes about formats or identifiers when needed

Correct clarity examples:

- `products get` must make it clear whether it accepts a GID, a numeric ID, or `--handle`
- `config add` must make it clear that `--domain` has to be `*.myshopify.com`

## Workflow

1. Change as little as necessary.
2. Build with `npm run build`.
3. Validate types with `npm run typecheck`.
4. Run tests if they exist.
5. Update documentation when a command contract changes.

## Mirror documentation

`CLAUDE.md` must point to this same document to avoid divergence.
