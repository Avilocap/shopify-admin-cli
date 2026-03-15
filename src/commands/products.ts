import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  INVENTORY_ITEM_UPDATE_MUTATION,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCT_BY_HANDLE_WITH_MEDIA_QUERY,
  PRODUCT_CREATE_MUTATION,
  PRODUCT_DELETE_MUTATION,
  PRODUCT_GET_QUERY,
  PRODUCT_GET_WITH_MEDIA_QUERY,
  PRODUCT_VARIANT_GET_QUERY,
  PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
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
  category: ProductCategory | null;
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

interface ProductCategory {
  fullName: string;
  id: string;
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
  category?: string;
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
  category?: string;
  rawQuery?: string;
  status?: string;
  tag?: string;
  type?: string;
  vendor?: string;
}

interface ProductMutationOptions {
  category?: string;
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
  clearCategory?: boolean;
  deleteConflictingMetafields?: boolean;
  matchHandle?: boolean;
  newHandle?: string;
}

interface ProductDeleteOptions {
  force?: boolean;
  format: OutputFormat;
  handle?: boolean;
}

interface ProductVariantDetails extends ProductVariantItem {
  product: {
    handle: string;
    id: string;
    title: string;
  };
}

interface ProductVariantGetResponse {
  productVariant: ProductVariantDetails | null;
}

interface ProductVariantMutationResponse {
  product: {
    handle: string;
    id: string;
    title: string;
  } | null;
  productVariants: ProductVariantItem[];
  userErrors: GraphQlUserError[];
}

interface ProductVariantsBulkUpdateResponse {
  productVariantsBulkUpdate: ProductVariantMutationResponse;
}

interface InventoryItemMutationResponse {
  inventoryItem: {
    harmonizedSystemCode: string | null;
    id: string;
    legacyResourceId: number | string;
    requiresShipping: boolean | null;
    sku: string | null;
    tracked: boolean;
    unitCost: {
      amount: string;
      currencyCode: string;
    } | null;
  } | null;
  userErrors: GraphQlUserError[];
}

interface InventoryItemUpdateResponse {
  inventoryItemUpdate: InventoryItemMutationResponse;
}

interface ProductVariantUpdateOptions {
  barcode?: string;
  clearBarcode?: boolean;
  clearCompareAtPrice?: boolean;
  clearTaxCode?: boolean;
  compareAtPrice?: string;
  cost?: string;
  countryCodeOfOrigin?: string;
  format: OutputFormat;
  harmonizedSystemCode?: string;
  inventoryPolicy?: string;
  metafield?: string[];
  price?: string;
  provinceCodeOfOrigin?: string;
  requiresShipping?: string;
  showUnitPrice?: string;
  sku?: string;
  taxCode?: string;
  taxable?: string;
  tracked?: string;
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
    .option(
      "--category <categoryId>",
      "Filter by taxonomy category GID or raw taxonomy category ID",
    )
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
  shopfleet products list --category sg-4-17-2-17
  shopfleet products list --query 'tag:"miniatura" status:active' --sort updated-at

Notes:
  --category accepts a taxonomy category GID or a raw taxonomy category ID.
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
    .option(
      "--category <categoryId>",
      "Filter by taxonomy category GID or raw taxonomy category ID",
    )
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
  shopfleet products search sandalia --category sg-4-17-2-17
  shopfleet products search macarena --status active --limit 5

Notes:
  --category accepts a taxonomy category GID or a raw taxonomy category ID.
  This command builds a Shopify search query and sorts by relevance.
      `,
    )
    .action(async (text: string, options: ProductsListOptions, command: Command) => {
      await runProductsList(
        {
          ...options,
          query: buildProductSearchQuery({
            rawQuery: text,
            category: options.category,
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
  Product details include the current Shopify taxonomy category when set.
  Use --include-media to include descriptionHtml, up to 10 product images, and detailed variant rows with inventory item IDs.
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
    .option(
      "--category <categoryId>",
      "Taxonomy category GID or raw taxonomy category ID",
    )
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
  shopfleet products create --title "Test product" --category sg-4-17-2-17
  shopfleet products create --title "Test product" --vendor Pichardo --type Accesorio --tags test,cli
  shopfleet products create --title "Test product" --seo-title "Buy Test product online" --seo-description "Short search snippet"

Notes:
  --category accepts a taxonomy category GID or a raw taxonomy category ID.
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
    .option(
      "--category <categoryId>",
      "Taxonomy category GID or raw taxonomy category ID",
    )
    .option("--clear-category", "Remove the current taxonomy category")
    .option(
      "--delete-conflicting-metafields",
      "Delete constrained metafields that conflict with the new category",
    )
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
  shopfleet products update 1234567890 --title "Updated title"
  shopfleet products update 1234567890 --category sg-4-17-2-17
  shopfleet products update 1234567890 --clear-category
  shopfleet products update my-handle --handle --status draft --tags test,cli
  shopfleet products update 1234567890 --new-handle updated-handle
  shopfleet products update 1234567890 --seo-title "Updated SEO title" --seo-description "Updated SEO description"

Notes:
  --category accepts a taxonomy category GID or a raw taxonomy category ID.
  Use --clear-category to remove the current category.
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

  const productVariants = products
    .command("variants")
    .description("Inspect and modify product variants");

  productVariants
    .command("update")
    .description("Update one product variant and its linked inventory item metadata")
    .argument("<id>", "Product variant GID or numeric ID")
    .option("--sku <sku>", "Variant SKU")
    .option("--price <amount>", "Variant price as a non-negative decimal")
    .option(
      "--compare-at-price <amount>",
      "Compare-at price as a non-negative decimal",
    )
    .option("--clear-compare-at-price", "Remove the current compare-at price")
    .option("--barcode <barcode>", "Barcode")
    .option("--clear-barcode", "Remove the current barcode")
    .option("--taxable <value>", "Whether the variant is taxable: true or false")
    .option("--tax-code <code>", "Tax code")
    .option("--clear-tax-code", "Remove the current tax code")
    .option(
      "--inventory-policy <policy>",
      "Inventory policy: deny or continue",
    )
    .option(
      "--show-unit-price <value>",
      "Whether to show the unit price: true or false",
    )
    .option("--cost <amount>", "Inventory item unit cost as a non-negative decimal")
    .option(
      "--tracked <value>",
      "Whether the linked inventory item is tracked: true or false",
    )
    .option(
      "--requires-shipping <value>",
      "Whether the linked inventory item requires shipping: true or false",
    )
    .option(
      "--country-code-of-origin <code>",
      "Inventory item country of origin as an ISO 3166-1 alpha-2 code",
    )
    .option(
      "--province-code-of-origin <code>",
      "Inventory item province or state of origin code",
    )
    .option(
      "--harmonized-system-code <code>",
      "Inventory item harmonized system code",
    )
    .option(
      "--metafield <entry>",
      "Variant metafield in namespace.key:type:value format. Repeat the flag to send multiple metafields.",
      collectRepeatedOption,
    )
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Context:
  This command updates one product variant. Variant pricing fields use the product mutation, while SKU and stock metadata use the linked inventory item.

Examples:
  shopfleet products variants update 1234567890 --sku MINI-001 --price 39.95
  shopfleet products variants update gid://shopify/ProductVariant/1234567890 --compare-at-price 49.95 --barcode 8437000000012
  shopfleet products variants update 1234567890 --tracked false --requires-shipping false --cost 12.50
  shopfleet products variants update 1234567890 --metafield custom.material:single_line_text_field:resin --metafield custom.collection:single_line_text_field:2026

Notes:
  The argument expects a product variant GID or numeric variant ID.
  Use --clear-compare-at-price, --clear-barcode, or --clear-tax-code to remove those optional values.
  --metafield creates or updates variant metafields using namespace.key:type:value.
      `,
    )
    .action(async (id: string, options: ProductVariantUpdateOptions, command: Command) => {
      if (!hasVariantFieldUpdates(options) && !hasInventoryItemFieldUpdates(options)) {
        throw new Error(
          "Nothing to update. Pass at least one variant or inventory item field to modify.",
        );
      }

      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const variantId = normalizeProductVariantId(id);
      const currentVariant = await getProductVariant(client, variantId);

      if (hasVariantFieldUpdates(options)) {
        const data = await client.query<ProductVariantsBulkUpdateResponse>({
          query: PRODUCT_VARIANTS_BULK_UPDATE_MUTATION,
          variables: {
            productId: currentVariant.product.id,
            variants: [buildProductVariantUpdateInput(currentVariant.id, options)],
          },
        });

        assertNoUserErrors(data.productVariantsBulkUpdate.userErrors);
      }

      if (hasInventoryItemFieldUpdates(options)) {
        const inventoryItemId = currentVariant.inventoryItem?.id;

        if (!inventoryItemId) {
          throw new Error("The variant is not linked to an inventory item.");
        }

        const data = await client.query<InventoryItemUpdateResponse>({
          query: INVENTORY_ITEM_UPDATE_MUTATION,
          variables: {
            id: inventoryItemId,
            input: buildInventoryItemUpdateInput(options),
          },
        });

        assertNoUserErrors(data.inventoryItemUpdate.userErrors);
      }

      const updatedVariant = await getProductVariant(client, variantId);
      printProductVariantDetails(updatedVariant, options.format);
    });

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
    category: options.category,
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
        category: product.category?.fullName ?? "",
        categoryId: product.category?.id ?? "",
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
      "category",
      "categoryId",
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
        barcode: variant.barcode ?? "",
        compareAtPrice: variant.compareAtPrice ?? "",
        id: variant.id,
        inventoryItemId: variant.inventoryItem?.id ?? "",
        inventoryItemNumericId: variant.inventoryItem?.legacyResourceId ?? "",
        inventoryPolicy: variant.inventoryPolicy ?? "",
        title: variant.title,
        sku: variant.sku ?? "",
        price: variant.price ?? "",
        inventoryQuantity: variant.inventoryQuantity,
        tracked: variant.inventoryItem?.tracked ?? "",
      })),
      [
        "id",
        "title",
        "sku",
        "barcode",
        "price",
        "compareAtPrice",
        "inventoryQuantity",
        "inventoryPolicy",
        "inventoryItemId",
        "inventoryItemNumericId",
        "tracked",
      ],
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

function printProductVariantDetails(
  variant: ProductVariantDetails,
  format: OutputFormat,
): void {
  if (format === "json") {
    printJson(variant);
    return;
  }

  printTable(
    [
      {
        id: variant.id,
        productId: variant.product.id,
        productHandle: variant.product.handle,
        productTitle: variant.product.title,
        title: variant.title,
        sku: variant.sku ?? "",
        barcode: variant.barcode ?? "",
        price: variant.price ?? "",
        compareAtPrice: variant.compareAtPrice ?? "",
        taxable: variant.taxable ?? "",
        taxCode: variant.taxCode ?? "",
        inventoryPolicy: variant.inventoryPolicy ?? "",
        showUnitPrice: variant.showUnitPrice ?? "",
        inventoryQuantity: variant.inventoryQuantity ?? "",
        inventoryItemId: variant.inventoryItem?.id ?? "",
        inventoryItemNumericId: variant.inventoryItem?.legacyResourceId ?? "",
        tracked: variant.inventoryItem?.tracked ?? "",
        requiresShipping: variant.inventoryItem?.requiresShipping ?? "",
        countryCodeOfOrigin: variant.inventoryItem?.countryCodeOfOrigin ?? "",
        provinceCodeOfOrigin: variant.inventoryItem?.provinceCodeOfOrigin ?? "",
        harmonizedSystemCode: variant.inventoryItem?.harmonizedSystemCode ?? "",
        unitCost: variant.inventoryItem?.unitCost
          ? `${variant.inventoryItem.unitCost.amount} ${variant.inventoryItem.unitCost.currencyCode}`
          : "",
      },
    ],
    [
      "id",
      "productId",
      "productHandle",
      "productTitle",
      "title",
      "sku",
      "barcode",
      "price",
      "compareAtPrice",
      "taxable",
      "taxCode",
      "inventoryPolicy",
      "showUnitPrice",
      "inventoryQuantity",
      "inventoryItemId",
      "inventoryItemNumericId",
      "tracked",
      "requiresShipping",
      "countryCodeOfOrigin",
      "provinceCodeOfOrigin",
      "harmonizedSystemCode",
      "unitCost",
    ],
  );
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

async function getProductVariant(
  client: ShopifyClient,
  id: string,
): Promise<ProductVariantDetails> {
  const variant = (
    await client.query<ProductVariantGetResponse>({
      query: PRODUCT_VARIANT_GET_QUERY,
      variables: { id },
    })
  ).productVariant;

  if (!variant) {
    throw new Error(`Product variant not found: ${id}`);
  }

  return variant;
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
    category: buildProductCategoryCreateInput(options.category),
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
  const category = buildProductCategoryUpdateInput(options);

  if (options.deleteConflictingMetafields && category === undefined) {
    throw new Error(
      "--delete-conflicting-metafields can only be used when changing or clearing the product category.",
    );
  }

  const payload = omitUndefined({
    category,
    deleteConflictingConstrainedMetafields: options.deleteConflictingMetafields || undefined,
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

export function normalizeProductVariantId(input: string): string {
  if (input.startsWith("gid://shopify/ProductVariant/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/ProductVariant/${input}`;
  }

  throw new Error("Expected a product variant GID or numeric variant ID.");
}

export function buildProductSearchQuery(
  options: ProductSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildFilterTerm(
      "category_id",
      options.category ? normalizeProductCategorySearchId(options.category) : undefined,
    ),
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

export function buildProductVariantUpdateInput(
  id: string,
  options: ProductVariantUpdateOptions,
): Record<string, unknown> {
  const metafields = options.metafield?.map((entry) => parseVariantMetafield(entry));
  const compareAtPrice = buildNullableValue(
    options.compareAtPrice,
    options.clearCompareAtPrice,
    "--compare-at-price",
  );
  const barcode = buildNullableValue(
    options.barcode,
    options.clearBarcode,
    "--barcode",
  );
  const taxCode = buildNullableValue(
    options.taxCode,
    options.clearTaxCode,
    "--tax-code",
  );

  const payload = omitUndefined({
    barcode,
    compareAtPrice:
      compareAtPrice === null
        ? null
        : compareAtPrice === undefined
          ? undefined
          : normalizeNonNegativeDecimal(compareAtPrice, "--compare-at-price"),
    id,
    inventoryPolicy: parseInventoryPolicy(options.inventoryPolicy),
    metafields: metafields?.length ? metafields : undefined,
    price:
      options.price !== undefined
        ? normalizeNonNegativeDecimal(options.price, "--price")
        : undefined,
    showUnitPrice:
      options.showUnitPrice !== undefined
        ? parseBooleanFlag(options.showUnitPrice, "--show-unit-price")
        : undefined,
    taxCode,
    taxable:
      options.taxable !== undefined
        ? parseBooleanFlag(options.taxable, "--taxable")
        : undefined,
  });

  if (Object.keys(payload).length === 1) {
    throw new Error(
      "Nothing to update. Pass at least one variant or inventory item field to modify.",
    );
  }

  return payload;
}

export function buildInventoryItemUpdateInput(
  options: ProductVariantUpdateOptions,
): Record<string, unknown> {
  const payload = omitUndefined({
    countryCodeOfOrigin: options.countryCodeOfOrigin?.trim() || undefined,
    cost:
      options.cost !== undefined ? normalizeNonNegativeDecimal(options.cost, "--cost") : undefined,
    harmonizedSystemCode: options.harmonizedSystemCode?.trim() || undefined,
    provinceCodeOfOrigin: options.provinceCodeOfOrigin?.trim() || undefined,
    requiresShipping:
      options.requiresShipping !== undefined
        ? parseBooleanFlag(options.requiresShipping, "--requires-shipping")
        : undefined,
    sku: options.sku?.trim() || undefined,
    tracked:
      options.tracked !== undefined
        ? parseBooleanFlag(options.tracked, "--tracked")
        : undefined,
  });

  if (Object.keys(payload).length === 0) {
    throw new Error(
      "Nothing to update. Pass at least one variant or inventory item field to modify.",
    );
  }

  return payload;
}

export function hasVariantFieldUpdates(options: ProductVariantUpdateOptions): boolean {
  return (
    options.price !== undefined ||
    options.compareAtPrice !== undefined ||
    Boolean(options.clearCompareAtPrice) ||
    options.barcode !== undefined ||
    Boolean(options.clearBarcode) ||
    options.taxable !== undefined ||
    options.taxCode !== undefined ||
    Boolean(options.clearTaxCode) ||
    options.inventoryPolicy !== undefined ||
    options.showUnitPrice !== undefined ||
    (options.metafield?.length ?? 0) > 0
  );
}

export function hasInventoryItemFieldUpdates(options: ProductVariantUpdateOptions): boolean {
  return (
    options.sku !== undefined ||
    options.cost !== undefined ||
    options.tracked !== undefined ||
    options.requiresShipping !== undefined ||
    options.countryCodeOfOrigin !== undefined ||
    options.provinceCodeOfOrigin !== undefined ||
    options.harmonizedSystemCode !== undefined
  );
}

export function normalizeProductCategoryId(input: string): string {
  const trimmed = input.trim();

  if (!trimmed || /\s/.test(trimmed)) {
    throw new Error(
      "Expected a taxonomy category GID or raw taxonomy category ID without spaces.",
    );
  }

  if (trimmed.startsWith("gid://shopify/TaxonomyCategory/")) {
    return trimmed;
  }

  if (trimmed.startsWith("gid://shopify/")) {
    throw new Error(
      "Expected a taxonomy category GID in the gid://shopify/TaxonomyCategory/<id> format.",
    );
  }

  return `gid://shopify/TaxonomyCategory/${trimmed}`;
}

export function normalizeProductCategorySearchId(input: string): string {
  const categoryId = normalizeProductCategoryId(input);
  return categoryId.replace("gid://shopify/TaxonomyCategory/", "");
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function parseBooleanFlag(value: string, flagName: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error(`${flagName} must be either true or false.`);
}

function parseInventoryPolicy(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim().toUpperCase();

  if (!["CONTINUE", "DENY"].includes(normalized)) {
    throw new Error(
      `Invalid --inventory-policy value "${input}". Valid values: continue, deny.`,
    );
  }

  return normalized;
}

function normalizeNonNegativeDecimal(input: string, flagName: string): string {
  const trimmed = input.trim();

  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Error(
      `Invalid ${flagName} value "${input}". Expected a non-negative decimal.`,
    );
  }

  if (Number(trimmed) < 0) {
    throw new Error(`${flagName} must be zero or greater.`);
  }

  return trimmed;
}

function buildNullableValue(
  value: string | undefined,
  clear: boolean | undefined,
  flagName: string,
): string | null | undefined {
  if (value !== undefined && clear) {
    const clearFlag =
      flagName === "--compare-at-price"
        ? "--clear-compare-at-price"
        : flagName === "--tax-code"
          ? "--clear-tax-code"
          : "--clear-barcode";
    throw new Error(`Use either ${flagName} or ${clearFlag}, but not both.`);
  }

  if (clear) {
    return null;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseVariantMetafield(input: string): Record<string, string> {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("--metafield entries must be non-empty.");
  }

  const firstColon = trimmed.indexOf(":");
  const secondColon = trimmed.indexOf(":", firstColon + 1);

  if (firstColon <= 0 || secondColon <= firstColon + 1) {
    throw new Error(
      `Invalid --metafield value "${input}". Expected namespace.key:type:value.`,
    );
  }

  const namespaceAndKey = trimmed.slice(0, firstColon);
  const type = trimmed.slice(firstColon + 1, secondColon).trim();
  const value = trimmed.slice(secondColon + 1).trim();
  const dotIndex = namespaceAndKey.indexOf(".");

  if (dotIndex <= 0 || dotIndex === namespaceAndKey.length - 1) {
    throw new Error(
      `Invalid --metafield value "${input}". Expected namespace.key:type:value.`,
    );
  }

  if (!type || !value) {
    throw new Error(
      `Invalid --metafield value "${input}". Expected namespace.key:type:value.`,
    );
  }

  return {
    key: namespaceAndKey.slice(dotIndex + 1),
    namespace: namespaceAndKey.slice(0, dotIndex),
    type,
    value,
  };
}

function collectRepeatedOption(value: string, previous?: string[]): string[] {
  return [...(previous ?? []), value];
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

function buildProductCategoryCreateInput(category?: string): string | undefined {
  if (category === undefined) {
    return undefined;
  }

  return normalizeProductCategoryId(category);
}

function buildProductCategoryUpdateInput(
  options: Pick<ProductUpdateOptions, "category" | "clearCategory">,
): string | null | undefined {
  if (options.category !== undefined && options.clearCategory) {
    throw new Error("Use either --category or --clear-category, but not both.");
  }

  if (options.clearCategory) {
    return null;
  }

  return buildProductCategoryCreateInput(options.category);
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
