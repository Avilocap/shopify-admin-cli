import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_HANDLE_WITH_MEDIA_QUERY,
  PRODUCT_CREATE_MUTATION,
  PRODUCT_DELETE_MUTATION,
  PRODUCT_GET_QUERY,
  PRODUCT_GET_WITH_MEDIA_QUERY,
  PRODUCT_UPDATE_MUTATION,
  PRODUCTS_LIST_QUERY,
} from "../graphql/products.js";
import type {
  GraphQlUserError,
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
  descriptionHtml?: string | null;
  handle: string;
  id: string;
  media?: {
    nodes: ProductMediaNode[];
  };
  productType: string;
  seo?: {
    description: string | null;
    title: string | null;
  } | null;
  status: string;
  tags: string[];
  title: string;
  totalInventory: number | null;
  variants: {
    nodes: ProductVariantItem[];
  };
  vendor: string;
}

interface ProductMediaNode {
  alt: string | null;
  id: string;
  image?: {
    altText: string | null;
    height: number | null;
    url: string;
    width: number | null;
  } | null;
  mediaContentType: string;
}

interface ProductImageItem {
  altText: string;
  height: number | null;
  id: string;
  url: string;
  width: number | null;
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
  includeMedia?: boolean;
}

interface ProductSearchQueryOptions {
  rawQuery?: string;
  status?: string;
  tag?: string;
  type?: string;
  vendor?: string;
}

interface ProductMutationOptions {
  description?: string;
  format: OutputFormat;
  handle?: string;
  seoDescription?: string;
  seoTitle?: string;
  status?: string;
  tags?: string;
  title?: string;
  type?: string;
  vendor?: string;
}

interface ProductUpdateOptions extends ProductMutationOptions {
  matchHandle?: boolean;
  newHandle?: string;
}

interface ProductDeleteOptions {
  force?: boolean;
  format: OutputFormat;
  handle?: boolean;
}

interface ProductMutationResponse {
  product: ProductDetails | null;
  userErrors: GraphQlUserError[];
}

interface ProductCreateResponse {
  productCreate: ProductMutationResponse;
}

interface ProductUpdateResponse {
  productUpdate: ProductMutationResponse;
}

interface ProductDeleteResponse {
  productDelete: {
    deletedProductId: string | null;
    productDeleteOperation: {
      deletedProductId: string | null;
      id: string;
      status: string;
    } | null;
    userErrors: GraphQlUserError[];
  };
}

export function registerProductCommands(program: Command): void {
  const products = program
    .command("products")
    .description("Read and modify product catalog data");

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
  shopfleet products list --limit 20
  shopfleet products list --vendor Pichardo --status active
  shopfleet products list --query 'tag:"miniatura" status:active' --sort updated-at

Notes:
  --query uses Shopify search syntax directly.
  Pagination is manual. Reuse the returned cursor with --after.
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
  shopfleet products search corona
  shopfleet products search macarena --status active --limit 5

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
    .option(
      "--include-media",
      "Include descriptionHtml and up to 10 product images with metadata",
    )
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet products get gid://shopify/Product/1234567890
  shopfleet products get 1234567890 --format table
  shopfleet products get 1234567890 --include-media
  shopfleet products get my-product-handle --handle

Notes:
  Without --handle, the argument must be a Shopify product GID or numeric product ID.
  Use --include-media to include descriptionHtml and up to 10 product images.
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
                query: options.includeMedia
                  ? PRODUCT_BY_HANDLE_WITH_MEDIA_QUERY
                  : PRODUCT_BY_HANDLE_QUERY,
                variables: { handle: idOrHandle },
              })
            ).productByHandle
          : (
              await client.query<ProductGetResponse>({
                query: options.includeMedia ? PRODUCT_GET_WITH_MEDIA_QUERY : PRODUCT_GET_QUERY,
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

        printProductDetails(product, Boolean(options.includeMedia));
      },
    );

  products
    .command("create")
    .description("Create a product with top-level product fields")
    .requiredOption("--title <title>", "Product title")
    .option("--description <html>", "HTML description")
    .option("--handle <handle>", "Product handle")
    .option("--seo-title <title>", "SEO title override")
    .option("--seo-description <text>", "SEO description override")
    .option("--vendor <vendor>", "Vendor")
    .option("--type <productType>", "Product type")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--status <status>", "Product status: active, draft or archived")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet products create --title "Test product" --status draft
  shopfleet products create --title "Test product" --vendor Pichardo --type Accesorio --tags test,cli
  shopfleet products create --title "Test product" --seo-title "Buy Test product online" --seo-description "Short search snippet"

Notes:
  This command sets top-level product fields, including optional SEO title and SEO description.
  Use the inventory commands for stock changes.
      `,
    )
    .action(async (options: ProductMutationOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<ProductCreateResponse>({
        query: PRODUCT_CREATE_MUTATION,
        variables: {
          product: buildProductCreateInput(options),
        },
      });

      assertNoUserErrors(data.productCreate.userErrors);

      if (!data.productCreate.product) {
        throw new Error("Shopify did not return the created product.");
      }

      printProductMutationResult(data.productCreate.product, options.format);
    });

  products
    .command("update")
    .description("Update top-level fields for an existing product")
    .argument("<idOrHandle>", "Product GID, numeric ID or handle")
    .option("--handle", "Treat the argument as a product handle")
    .option("--title <title>", "Product title")
    .option("--description <html>", "HTML description")
    .option("--new-handle <handle>", "New product handle")
    .option("--seo-title <title>", "SEO title override")
    .option("--seo-description <text>", "SEO description override")
    .option("--vendor <vendor>", "Vendor")
    .option("--type <productType>", "Product type")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--status <status>", "Product status: active, draft or archived")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet products update 1234567890 --title "Nuevo titulo"
  shopfleet products update my-handle --handle --status draft --tags test,cli
  shopfleet products update 1234567890 --new-handle nuevo-handle
  shopfleet products update 1234567890 --seo-title "Nuevo SEO title" --seo-description "Nueva SEO description"

Notes:
  Use --handle only to resolve the target product by its current handle.
  Use --new-handle if you want to change the product handle.
      `,
    )
    .action(
      async (idOrHandle: string, options: ProductUpdateOptions, command: Command) => {
        const storeAlias = command.optsWithGlobals().store as string | undefined;
        const store = await resolveStore(storeAlias);
        const client = new ShopifyClient({ store });
        const id = await resolveProductReference(client, idOrHandle, Boolean(options.handle));
        const productUpdate = buildProductUpdateInput(id, options);
        const data = await client.query<ProductUpdateResponse>({
          query: PRODUCT_UPDATE_MUTATION,
          variables: {
            product: productUpdate,
          },
        });

        assertNoUserErrors(data.productUpdate.userErrors);

        if (!data.productUpdate.product) {
          throw new Error("Shopify did not return the updated product.");
        }

        printProductMutationResult(data.productUpdate.product, options.format);
      },
    );

  products
    .command("delete")
    .description("Delete a product by GID, numeric ID or handle")
    .argument("<idOrHandle>", "Product GID, numeric ID or handle")
    .option("--handle", "Treat the argument as a product handle")
    .option("--force", "Required to execute the delete")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet products delete 1234567890 --force
  shopfleet products delete my-handle --handle --force

Notes:
  This command is destructive and requires --force.
  Deletion runs synchronously so the CLI can return the result directly.
      `,
    )
    .action(
      async (idOrHandle: string, options: ProductDeleteOptions, command: Command) => {
        if (!options.force) {
          throw new Error("Refusing to delete without --force.");
        }

        const storeAlias = command.optsWithGlobals().store as string | undefined;
        const store = await resolveStore(storeAlias);
        const client = new ShopifyClient({ store });
        const id = await resolveProductReference(client, idOrHandle, Boolean(options.handle));
        const data = await client.query<ProductDeleteResponse>({
          query: PRODUCT_DELETE_MUTATION,
          variables: {
            input: { id },
            synchronous: true,
          },
        });

        assertNoUserErrors(data.productDelete.userErrors);

        const result = {
          deletedProductId:
            data.productDelete.deletedProductId ??
            data.productDelete.productDeleteOperation?.deletedProductId ??
            id,
          operationId: data.productDelete.productDeleteOperation?.id ?? "",
          status: data.productDelete.productDeleteOperation?.status ?? "COMPLETED",
        };

        if (options.format === "json") {
          printJson(result);
          return;
        }

        printTable([result], ["deletedProductId", "status", "operationId"]);
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

function printProductDetails(product: ProductDetails, includeMedia: boolean): void {
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
        ...(includeMedia
          ? {
              descriptionHtml: product.descriptionHtml ?? "",
              imageCount: extractProductImages(product).length,
            }
          : {}),
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
      ...(includeMedia ? ["descriptionHtml", "imageCount"] : []),
    ],
  );

  if (!includeMedia) {
    return;
  }

  const productImages = extractProductImages(product);

  if (productImages.length > 0) {
    process.stdout.write("\nImages\n");
    printTable(productImages, ["id", "url", "altText", "width", "height"]);
  }

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

function printProductMutationResult(
  product: ProductDetails,
  format: OutputFormat,
): void {
  if (format === "json") {
    printJson(product);
    return;
  }

  printProductDetails(product, false);
}

export function extractProductImages(product: ProductDetails): ProductImageItem[] {
  return (product.media?.nodes ?? [])
    .filter((media): media is ProductMediaNode & { image: NonNullable<ProductMediaNode["image"]> } => {
      return media.mediaContentType === "IMAGE" && Boolean(media.image?.url);
    })
    .map((media) => ({
      altText: media.image.altText ?? media.alt ?? "",
      height: media.image.height,
      id: media.id,
      url: media.image.url,
      width: media.image.width,
    }));
}

async function resolveProductReference(
  client: ShopifyClient,
  input: string,
  treatAsHandle: boolean,
): Promise<string> {
  if (!treatAsHandle) {
    return normalizeProductId(input);
  }

  const product = (
    await client.query<ProductByHandleResponse>({
      query: PRODUCT_BY_HANDLE_QUERY,
      variables: { handle: input },
    })
  ).productByHandle;

  if (!product) {
    throw new Error(`Product not found: ${input}`);
  }

  return product.id;
}

function assertNoUserErrors(userErrors: GraphQlUserError[]): void {
  if (userErrors.length === 0) {
    return;
  }

  const message = userErrors
    .map((error) => {
      const field = error.field?.join(".") ?? "";
      return field ? `${field}: ${error.message}` : error.message;
    })
    .join("\n");

  throw new Error(message);
}

export function buildProductCreateInput(
  options: ProductMutationOptions,
): Record<string, unknown> {
  return omitUndefined({
    descriptionHtml: options.description,
    handle: options.handle,
    productType: options.type,
    seo: buildSeoInput(options),
    status: parseProductStatus(options.status),
    tags: options.tags !== undefined ? parseTags(options.tags) : undefined,
    title: options.title,
    vendor: options.vendor,
  });
}

export function buildProductUpdateInput(
  id: string,
  options: ProductUpdateOptions,
): Record<string, unknown> {
  const payload = omitUndefined({
    descriptionHtml: options.description,
    handle: options.newHandle,
    id,
    productType: options.type,
    seo: buildSeoInput(options),
    status: parseProductStatus(options.status),
    tags: options.tags !== undefined ? parseTags(options.tags) : undefined,
    title: options.title,
    vendor: options.vendor,
  });

  if (Object.keys(payload).length === 1) {
    throw new Error("Nothing to update. Pass at least one field to modify.");
  }

  return payload;
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

export function parseProductStatus(status?: string): string | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = status.trim().toUpperCase();

  if (!["ACTIVE", "ARCHIVED", "DRAFT"].includes(normalized)) {
    throw new Error(
      `Invalid --status value "${status}". Valid values: active, archived, draft.`,
    );
  }

  return normalized;
}

export function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

function buildSeoInput(
  options: Pick<ProductMutationOptions, "seoDescription" | "seoTitle">,
): Record<string, unknown> | undefined {
  const seo = omitUndefined({
    description: options.seoDescription,
    title: options.seoTitle,
  });

  return Object.keys(seo).length > 0 ? seo : undefined;
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
