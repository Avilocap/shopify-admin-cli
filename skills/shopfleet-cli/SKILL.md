---
name: shopfleet-cli
description: "Use when working with the Shopfleet/store-manager Shopify CLI in this repository: exploring commands, running the local CLI safely, updating command contracts, debugging command behavior, or adding new CLI features."
---

# Shopfleet CLI

Use this skill when the task is about the local Shopify CLI in this repository.

This repo currently exposes the `shopfleet` CLI from [`src/index.ts`](../../src/index.ts). It manages Shopify stores through Admin GraphQL and supports both read commands and write commands. Other agents may not have the repository `AGENTS.md`, so this skill carries the operating rules that matter most.

## Quick Rules

1. Treat [`src/commands`](../../src/commands), targeted `--help`, and live CLI behavior as the ground truth. Use [`README.md`](../../README.md) for examples and workflow context. If docs diverge, trust the code and help output.
2. Run commands from the repo root. Prefer `node dist/index.js ...` when `dist/` is present and up to date. If behavior looks stale, rebuild or use `npm run dev -- ...`.
3. Do not print or log secrets. Store config may contain `clientSecret` or legacy `accessToken`.
4. Assume configured aliases may be real stores, often production stores. Before any write command, confirm the target alias and the intended effect.
5. For config-only validation, use a temporary alias with fake credentials and remove it when done.
6. When a command contract or method behavior changes, update code, `--help`, [`README.md`](../../README.md), [`AGENTS.md`](../../AGENTS.md), and the relevant files under [`skills/`](../../skills/) together when applicable.
7. Keep solutions small. Stay on the supported surface; do not introduce traffic, conversion, abandonment, marketing analytics, webhooks, or bulk operations unless explicitly requested.

## Safe Workflow

### 1. Discover the current state

Start with:

```bash
node dist/index.js --help
node dist/index.js config list
```

`config list` is safe and shows the configured aliases plus the config file path. Treat existing aliases as real stores unless the user gives you better context.

Store config lives at `~/.shopfleet/stores.json` and the CLI migrates from `~/.store-manager/stores.json` automatically.

### 2. Classify the task

- Read-only task: `shop info`, list/get/search commands, analytics, and other non-mutating reads are generally safe on an existing configured alias.
- Local config task: `config add`, `config remove`, `config set-default`, and config migration work can be tested locally without touching Shopify if you use fake credentials.
- Write task: product create/update/delete, order cancel, gift card create, page create, blog article create, refund, inventory adjust, fulfillment create/tracking, and discount create all mutate store data. Production use is valid, but these commands should be executed deliberately against the intended alias.

### 3. Choose the safest validation path

Prefer this order:

1. `--help` and source inspection
2. local validation paths that fail before any network write
3. read-only commands on a configured alias
4. temporary config aliases with fake credentials for config workflows
5. real write operations only when the target store and the intended mutation are clear

Good safe probes:

```bash
node dist/index.js orders cancel 1234567890
node dist/index.js config add skill-temp --domain example-dev-store.myshopify.com --client-id fake --client-secret fake
node dist/index.js config remove skill-temp
```

`orders cancel` refuses to proceed without `--force`, which is a useful guardrail check that does not perform the cancellation.

### 4. When you do need live behavior

Use read-only commands first when you need to understand the current store state:

```bash
node dist/index.js shop info --store <alias>
node dist/index.js products list --store <alias> --limit 1
```

Prefer `--format table` when you want concise terminal inspection and `--format json` when you need structured output for reasoning or comparison.

## Implementation Notes

- The HTTP client uses native `fetch` in [`src/client.ts`](../../src/client.ts).
- Default Shopify API version is pinned in code and can be overridden with `SHOPIFY_API_VERSION`.
- Auth supports either `clientId` + `clientSecret` or legacy `accessToken`.
- The CLI talks to Shopify Admin GraphQL and keeps analytics read-only through ShopifyQL.
- The config layer normalizes domains and requires the Shopify admin domain in `*.myshopify.com` format.

## Editing Workflow

When changing behavior:

1. Inspect the target command in [`src/commands`](../../src/commands).
2. Inspect the corresponding GraphQL helper in [`src/graphql`](../../src/graphql) if the command hits Shopify.
3. Keep behavior explicit and names clear. Avoid premature abstractions.
4. Update help text examples and identifier notes with `addHelpText("after", ...)`.
5. If the command contract or method behavior changed, update [`README.md`](../../README.md), [`AGENTS.md`](../../AGENTS.md), and the relevant repository skill docs under [`skills/`](../../skills/).

Then verify:

```bash
npm run build
npm run typecheck
npm test
```

## Reference Files

- Command surface, identifier rules, and mutation notes: [`references/cli-contract.md`](./references/cli-contract.md)
