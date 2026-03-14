import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  COLLECTION_GET_QUERY,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_LIST_QUERY,
} from "../graphql/collections.js";
import type { OutputFormat, PageInfo, ProductListItem } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const COLLECTION_SORT_KEYS = ["ID", "RELEVANCE", "TITLE", "UPDATED_AT"] as const;
const COLLECTION_PRODUCT_SORT_KEYS = [
  "BEST_SELLING",
  "COLLECTION_DEFAULT",
  "CREATED",
  "ID",
  "MANUAL",
  "PRICE",
  "RELEVANCE",
  "TITLE",
] as const;

type CollectionSortKey = (typeof COLLECTION_SORT_KEYS)[number];
type CollectionProductSortKey = (typeof COLLECTION_PRODUCT_SORT_KEYS)[number];

interface CollectionCount {
  count: number;
  precision: string;
}

interface CollectionListItem {
  handle: string;
  id: string;
  productsCount: CollectionCount;
  ruleSet: {
    appliedDisjunctively: boolean;
  } | null;
  sortOrder: string;
  title: string;
  updatedAt: string;
}

interface CollectionDetails extends CollectionListItem {
  description: string;
}

interface CollectionsListResponse {
  collections: {
    edges: Array<{
      cursor: string;
      node: CollectionListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface CollectionGetResponse {
  collection: CollectionDetails | null;
}

interface CollectionProductsResponse {
  collection: {
    id: string;
    products: {
      edges: Array<{
        cursor: string;
        node: ProductListItem;
      }>;
      pageInfo: PageInfo;
    };
    title: string;
  } | null;
}

interface CollectionsListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
  type?: string;
}

interface CollectionGetOptions {
  format: OutputFormat;
}

interface CollectionProductsOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  reverse?: boolean;
  sort?: string;
}

export function registerCollectionCommands(program: Command): void {
  const collections = program
    .command("collections")
    .description("Read collection data");

  collections
    .command("list")
    .description("List collections")
    .option("--limit <n>", "Number of collections to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify collection search query")
    .option("--type <type>", "Collection type: custom or smart")
    .option(
      "--sort <sortKey>",
      `Sort by ${COLLECTION_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet collections list --limit 20
  shopfleet collections list --type custom --sort updated-at --reverse
  shopfleet collections list --query 'title:miniatura'

Notes:
  --type maps to Shopify collection_type filtering.
  Pagination is manual for now. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: CollectionsListOptions, command: Command) => {
      await runCollectionsList(options, command);
    });

  collections
    .command("get")
    .description("Get a collection by GID or numeric ID")
    .argument("<id>", "Collection GID or numeric ID")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet collections get gid://shopify/Collection/1234567890
  shopfleet collections get 1234567890 --format table

Notes:
  The argument must be a Shopify collection GID or numeric collection ID.
      `,
    )
    .action(async (id: string, options: CollectionGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<CollectionGetResponse>({
        query: COLLECTION_GET_QUERY,
        variables: { id: normalizeCollectionId(id) },
      });

      if (!data.collection) {
        throw new Error(`Collection not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.collection);
        return;
      }

      printCollectionDetails(data.collection);
    });

  collections
    .command("products")
    .description("List products inside a collection")
    .argument("<id>", "Collection GID or numeric ID")
    .option("--limit <n>", "Number of products to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option(
      "--sort <sortKey>",
      `Sort by ${COLLECTION_PRODUCT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet collections products 1234567890 --limit 20
  shopfleet collections products 1234567890 --sort title

Notes:
  The argument must be a Shopify collection GID or numeric collection ID.
      `,
    )
    .action(
      async (id: string, options: CollectionProductsOptions, command: Command) => {
        const storeAlias = command.optsWithGlobals().store as string | undefined;
        const store = await resolveStore(storeAlias);
        const client = new ShopifyClient({ store });
        const limit = Number(options.limit);
        const sortKey = parseCollectionProductSortKey(options.sort);

        if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
          throw new Error("--limit must be an integer between 1 and 250.");
        }

        const data = await client.query<CollectionProductsResponse>({
          query: COLLECTION_PRODUCTS_QUERY,
          variables: {
            after: options.after ?? null,
            first: limit,
            id: normalizeCollectionId(id),
            reverse: Boolean(options.reverse),
            sortKey,
          },
        });

        if (!data.collection) {
          throw new Error(`Collection not found: ${id}`);
        }

        const rows = data.collection.products.edges.map((edge) => edge.node);

        if (options.format === "json") {
          printJson({
            collectionId: data.collection.id,
            collectionTitle: data.collection.title,
            items: rows,
            pageInfo: data.collection.products.pageInfo,
            sortKey,
          });
          return;
        }

        printOutput(options.format, rows, [
          "id",
          "handle",
          "title",
          "status",
          "vendor",
          "productType",
          "totalInventory",
        ]);

        if (data.collection.products.pageInfo.hasNextPage) {
          process.stdout.write(
            `${chalk.dim(`Next cursor: ${data.collection.products.pageInfo.endCursor ?? ""}`)}\n`,
          );
        }
      },
    );
}

async function runCollectionsList(
  options: CollectionsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = buildCollectionSearchQuery({
    rawQuery: options.query,
    type: options.type,
  });
  const sortKey = parseCollectionSortKey(options.sort, query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<CollectionsListResponse>({
    query: COLLECTIONS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.collections.edges.map((edge) => mapCollectionListRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.collections.edges.map((edge) => edge.node),
      pageInfo: data.collections.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "title",
    "handle",
    "type",
    "productsCount",
    "sortOrder",
    "updatedAt",
  ]);

  if (data.collections.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.collections.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function mapCollectionListRow(collection: CollectionListItem): Record<string, unknown> {
  return {
    handle: collection.handle,
    id: collection.id,
    productsCount: formatCollectionCount(collection.productsCount),
    sortOrder: collection.sortOrder,
    title: collection.title,
    type: collection.ruleSet ? "smart" : "custom",
    updatedAt: collection.updatedAt,
  };
}

function printCollectionDetails(collection: CollectionDetails): void {
  printTable(
    [
      {
        description: collection.description,
        handle: collection.handle,
        id: collection.id,
        productsCount: formatCollectionCount(collection.productsCount),
        sortOrder: collection.sortOrder,
        title: collection.title,
        type: collection.ruleSet ? "smart" : "custom",
        updatedAt: collection.updatedAt,
      },
    ],
    [
      "id",
      "title",
      "handle",
      "type",
      "productsCount",
      "sortOrder",
      "updatedAt",
      "description",
    ],
  );
}

function formatCollectionCount(count: CollectionCount): string {
  return `${count.count} (${count.precision})`;
}

export function normalizeCollectionId(input: string): string {
  if (input.startsWith("gid://shopify/Collection/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Collection/${input}`;
  }

  throw new Error("Expected a collection GID or numeric collection ID.");
}

export function buildCollectionSearchQuery(options: {
  rawQuery?: string;
  type?: string;
}): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildTypeFilter(options.type),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function parseCollectionSortKey(
  input: string | undefined,
  query: string | null,
): CollectionSortKey {
  if (!input) {
    return query ? "RELEVANCE" : "UPDATED_AT";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!COLLECTION_SORT_KEYS.includes(normalized as CollectionSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${COLLECTION_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE" && !query) {
    throw new Error("--sort relevance requires a search query.");
  }

  return normalized as CollectionSortKey;
}

export function parseCollectionProductSortKey(
  input: string | undefined,
): CollectionProductSortKey {
  if (!input) {
    return "TITLE";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!COLLECTION_PRODUCT_SORT_KEYS.includes(normalized as CollectionProductSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${COLLECTION_PRODUCT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  return normalized as CollectionProductSortKey;
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildTypeFilter(input?: string): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();

  if (normalized !== "custom" && normalized !== "smart") {
    throw new Error('Invalid --type value. Valid values: custom, smart.');
  }

  return `collection_type:${normalized}`;
}
