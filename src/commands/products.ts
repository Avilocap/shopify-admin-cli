import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_GET_QUERY,
  PRODUCTS_LIST_QUERY,
} from "../graphql/products.js";
import type {
  OutputFormat,
  PageInfo,
  ProductListItem,
  ProductVariantItem,
} from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const PRODUCT_SORT_KEYS = [
  "CREATED_AT",
  "ID",
  "INVENTORY_TOTAL",
  "PRODUCT_TYPE",
  "PUBLISHED_AT",
  "RELEVANCE",
  "TITLE",
  "UPDATED_AT",
  "VENDOR",
] as const;

type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

interface ProductDetails {
  handle: string;
  id: string;
  productType: string;
  status: string;
  tags: string[];
  title: string;
  totalInventory: number | null;
  variants: {
    nodes: ProductVariantItem[];
  };
  vendor: string;
}

interface ProductsListResponse {
  products: {
    edges: Array<{
      cursor: string;
      node: ProductListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface ProductGetResponse {
  product: ProductDetails | null;
}

interface ProductByHandleResponse {
  productByHandle: ProductDetails | null;
}

interface ProductsListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
  status?: string;
  tag?: string;
  type?: string;
  vendor?: string;
}

interface ProductGetOptions {
  format: OutputFormat;
  handle?: boolean;
}

interface ProductSearchQueryOptions {
  rawQuery?: string;
  status?: string;
  tag?: string;
  type?: string;
  vendor?: string;
}

export function registerProductCommands(program: Command): void {
  const products = program.command("products").description("Read product catalog data");

  products
    .command("list")
    .description("List products")
    .option("--limit <n>", "Number of products to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify product search query")
    .option("--vendor <vendor>", "Filter by vendor")
    .option("--type <productType>", "Filter by product type")
    .option("--status <status>", "Filter by status: active, draft or archived")
    .option("--tag <tag>", "Filter by tag")
    .option(
      "--sort <sortKey>",
      `Sort by ${PRODUCT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  store-manager products list --limit 20
  store-manager products list --vendor Pichardo --status active
  store-manager products list --query 'tag:"miniatura" status:active' --sort updated-at

Notes:
  --query uses Shopify search syntax directly.
  Pagination is manual for now. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: ProductsListOptions, command: Command) => {
      await runProductsList(options, command);
    });

  products
    .command("search")
    .description("Search products across default Shopify fields")
    .argument("<text>", "Search text")
    .option("--limit <n>", "Number of products to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--vendor <vendor>", "Filter by vendor")
    .option("--type <productType>", "Filter by product type")
    .option("--status <status>", "Filter by status: active, draft or archived")
    .option("--tag <tag>", "Filter by tag")
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  store-manager products search corona
  store-manager products search macarena --status active --limit 5

Notes:
  This command builds a Shopify search query and sorts by relevance.
      `,
    )
    .action(async (text: string, options: ProductsListOptions, command: Command) => {
      await runProductsList(
        {
          ...options,
          query: buildProductSearchQuery({
            rawQuery: text,
            status: options.status,
            tag: options.tag,
            type: options.type,
            vendor: options.vendor,
          }) ?? undefined,
          sort: "relevance",
        },
        command,
      );
    });

  products
    .command("get")
    .description("Get a product by GID, numeric ID or handle")
    .argument("<idOrHandle>", "Product GID, numeric ID or handle")
    .option("--handle", "Treat the argument as a product handle")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  store-manager products get gid://shopify/Product/1234567890
  store-manager products get 1234567890 --format table
  store-manager products get my-product-handle --handle

Notes:
  Without --handle, the argument must be a Shopify product GID or numeric product ID.
      `,
    )
    .action(
      async (idOrHandle: string, options: ProductGetOptions, command: Command) => {
        const storeAlias = command.optsWithGlobals().store as string | undefined;
        const store = await resolveStore(storeAlias);
        const client = new ShopifyClient({ store });
        const product = options.handle
          ? (
              await client.query<ProductByHandleResponse>({
                query: PRODUCT_BY_HANDLE_QUERY,
                variables: { handle: idOrHandle },
              })
            ).productByHandle
          : (
              await client.query<ProductGetResponse>({
                query: PRODUCT_GET_QUERY,
                variables: { id: normalizeProductId(idOrHandle) },
              })
            ).product;

        if (!product) {
          throw new Error(`Product not found: ${idOrHandle}`);
        }

        if (options.format === "json") {
          printJson(product);
          return;
        }

        printProductDetails(product);
      },
    );
}

async function runProductsList(
  options: ProductsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = buildProductSearchQuery({
    rawQuery: options.query,
    status: options.status,
    tag: options.tag,
    type: options.type,
    vendor: options.vendor,
  });
  const sortKey = parseProductSortKey(options.sort, query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<ProductsListResponse>({
    query: PRODUCTS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.products.edges.map((edge) => edge.node);

  if (options.format === "json") {
    printJson({
      items: rows,
      pageInfo: data.products.pageInfo,
      query,
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

  if (data.products.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.products.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function printProductDetails(product: ProductDetails): void {
  printTable(
    [
      {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        totalInventory: product.totalInventory,
      },
    ],
    [
      "id",
      "title",
      "handle",
      "status",
      "vendor",
      "productType",
      "tags",
      "totalInventory",
    ],
  );

  if (product.variants.nodes.length > 0) {
    process.stdout.write("\nVariants\n");
    printTable(
      product.variants.nodes.map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku ?? "",
        price: variant.price ?? "",
        inventoryQuantity: variant.inventoryQuantity,
      })),
      ["id", "title", "sku", "price", "inventoryQuantity"],
    );
  }
}

export function normalizeProductId(input: string): string {
  if (input.startsWith("gid://shopify/Product/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Product/${input}`;
  }

  throw new Error(
    "Expected a product GID or numeric product ID. Use --handle to fetch by handle.",
  );
}

export function buildProductSearchQuery(
  options: ProductSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildFilterTerm("vendor", options.vendor),
    buildFilterTerm("product_type", options.type),
    buildFilterTerm("status", options.status?.toLowerCase()),
    buildFilterTerm("tag", options.tag),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function parseProductSortKey(
  input: string | undefined,
  query: string | null,
): ProductSortKey {
  if (!input) {
    return query ? "RELEVANCE" : "TITLE";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!PRODUCT_SORT_KEYS.includes(normalized as ProductSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${PRODUCT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE" && !query) {
    throw new Error("--sort relevance requires a search query.");
  }

  return normalized as ProductSortKey;
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function buildFilterTerm(field: string, value?: string): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return `${field}:${quoteSearchValue(trimmed)}`;
}

function quoteSearchValue(value: string): string {
  if (!/[\s:()]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
