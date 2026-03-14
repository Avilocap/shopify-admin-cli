import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  INVENTORY_ADJUST_MUTATION,
  INVENTORY_LEVEL_AT_LOCATION_QUERY,
  INVENTORY_LEVELS_QUERY,
  LOCATIONS_LIST_QUERY,
} from "../graphql/inventory.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

interface InventoryQuantity {
  name: string;
  quantity: number;
}

interface InventoryLocationSummary {
  id: string;
  name: string;
}

interface InventoryLevelNode {
  id: string;
  location: InventoryLocationSummary;
  quantities: InventoryQuantity[];
}

interface InventoryItemNode {
  id: string;
  inventoryLevel?: InventoryLevelNode | null;
  inventoryLevels?: {
    nodes: InventoryLevelNode[];
  };
  legacyResourceId: number | string;
  sku: string | null;
  tracked: boolean;
}

interface InventoryLevelsResponse {
  inventoryItems: {
    edges: Array<{
      cursor: string;
      node: InventoryItemNode;
    }>;
    pageInfo: PageInfo;
  };
}

interface InventoryAdjustGroup {
  changes: Array<{
    delta: number;
    item: {
      id: string;
      sku: string | null;
    } | null;
    ledgerDocumentUri: string | null;
    location: InventoryLocationSummary | null;
    name: string;
    quantityAfterChange: number | null;
  }>;
  createdAt: string;
  id: string;
  reason: string;
  referenceDocumentUri: string | null;
}

interface InventoryAdjustResponse {
  inventoryAdjustQuantities: {
    inventoryAdjustmentGroup: InventoryAdjustGroup | null;
    userErrors: GraphQlUserError[];
  };
}

interface LocationNode {
  address: {
    formatted: string[];
  };
  deactivatedAt: string | null;
  fulfillsOnlineOrders: boolean;
  hasActiveInventory: boolean;
  hasUnfulfilledOrders: boolean;
  id: string;
  legacyResourceId: number | string;
  name: string;
}

interface LocationsListResponse {
  locations: {
    edges: Array<{
      cursor: string;
      node: LocationNode;
    }>;
    pageInfo: PageInfo;
  };
}

interface InventoryLevelsOptions {
  after?: string;
  format: OutputFormat;
  itemId?: string;
  limit: string;
  locationId?: string;
  name?: string;
  query?: string;
  sku?: string;
}

interface InventoryAdjustOptions {
  format: OutputFormat;
  itemId: string;
  ledgerDocumentUri?: string;
  locationId: string;
  name?: string;
  quantity: string;
  reason?: string;
  reference?: string;
}

interface InventoryLocationsOptions {
  after?: string;
  format: OutputFormat;
  includeInactive?: boolean;
  includeLegacy?: boolean;
  limit: string;
  query?: string;
}

interface InventoryItemSearchQueryOptions {
  itemId?: string;
  rawQuery?: string;
  sku?: string;
}

export function registerInventoryCommands(program: Command): void {
  const inventory = program
    .command("inventory")
    .description("Read and modify inventory data");

  inventory
    .command("levels")
    .description("List inventory levels by inventory item")
    .option("--limit <n>", "Number of inventory items to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify inventory item search query")
    .option("--item-id <id>", "Inventory item GID or numeric ID")
    .option("--sku <sku>", "Filter by SKU")
    .option(
      "--location-id <id>",
      "Location GID or numeric ID. Limits each inventory item to one location",
    )
    .option(
      "--name <quantityName>",
      "Inventory quantity name to retrieve, for example available or committed",
      "available",
    )
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet inventory levels --limit 20
  shopfleet inventory levels --sku ABC-123 --name available
  shopfleet inventory levels --item-id 30322695 --location-id 124656943 --format json

Notes:
  --item-id expects an inventory item GID or numeric inventory item ID.
  --location-id expects a location GID or numeric location ID.
  --query uses Shopify inventory item search syntax directly.
      `,
    )
    .action(async (options: InventoryLevelsOptions, command: Command) => {
      await runInventoryLevels(options, command);
    });

  inventory
    .command("adjust")
    .description("Adjust inventory by applying a signed delta at one location")
    .requiredOption("--item-id <id>", "Inventory item GID or numeric ID")
    .requiredOption("--location-id <id>", "Location GID or numeric ID")
    .requiredOption("--quantity <delta>", "Signed delta to add or remove")
    .option(
      "--name <quantityName>",
      "Inventory quantity name to adjust, for example available or committed",
      "available",
    )
    .option("--reason <reason>", "Adjustment reason", "correction")
    .option("--reference <uri>", "Reference document URI for the adjustment group")
    .option(
      "--ledger-document-uri <uri>",
      "Ledger document URI. Required by Shopify when --name is not available",
    )
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet inventory adjust --item-id 30322695 --location-id 124656943 --quantity -4
  shopfleet inventory adjust --item-id gid://shopify/InventoryItem/30322695 --location-id gid://shopify/Location/124656943 --quantity 10 --reference gid://shopfleet/InventoryAdjustment/2026-03-14-001

Notes:
  --quantity is a signed delta, not an absolute quantity.
  --item-id expects an inventory item GID or numeric inventory item ID.
  --location-id expects a location GID or numeric location ID.
  Shopify requires --ledger-document-uri when --name is not available.
      `,
    )
    .action(async (options: InventoryAdjustOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const quantityName = parseInventoryQuantityName(options.name);
      const data = await client.query<InventoryAdjustResponse>({
        query: INVENTORY_ADJUST_MUTATION,
        variables: {
          input: buildInventoryAdjustInput(options),
          quantityNames: [quantityName],
        },
      });

      assertNoInventoryUserErrors(data.inventoryAdjustQuantities.userErrors);

      if (!data.inventoryAdjustQuantities.inventoryAdjustmentGroup) {
        throw new Error("Shopify did not return the inventory adjustment group.");
      }

      printInventoryAdjustResult(
        data.inventoryAdjustQuantities.inventoryAdjustmentGroup,
        options.format,
      );
    });

  inventory
    .command("locations")
    .description("List inventory locations")
    .option("--limit <n>", "Number of locations to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify location search query")
    .option("--include-inactive", "Include deactivated locations")
    .option("--include-legacy", "Include fulfillment service legacy locations")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet inventory locations --limit 20
  shopfleet inventory locations --query 'name:warehouse' --include-inactive

Notes:
  Locations are active-only by default.
  --query uses Shopify location search syntax directly.
      `,
    )
    .action(async (options: InventoryLocationsOptions, command: Command) => {
      await runInventoryLocations(options, command);
    });
}

async function runInventoryLevels(
  options: InventoryLevelsOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const quantityName = parseInventoryQuantityName(options.name);
  const query = buildInventoryItemSearchQuery({
    itemId: options.itemId,
    rawQuery: options.query,
    sku: options.sku,
  });
  const locationId = options.locationId
    ? normalizeLocationId(options.locationId)
    : undefined;

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<InventoryLevelsResponse>({
    query: locationId ? INVENTORY_LEVEL_AT_LOCATION_QUERY : INVENTORY_LEVELS_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      locationId: locationId ?? null,
      query,
      quantityNames: [quantityName],
    },
  });

  const rows = data.inventoryItems.edges.flatMap((edge) =>
    flattenInventoryLevels(edge.node),
  );

  if (options.format === "json") {
    printJson({
      items: data.inventoryItems.edges.map((edge) => edge.node),
      pageInfo: data.inventoryItems.pageInfo,
      query,
      quantityName,
    });
    return;
  }

  printOutput(options.format, rows, [
    "itemId",
    "itemNumericId",
    "sku",
    "tracked",
    "locationId",
    "location",
    "quantityName",
    "quantity",
  ]);

  if (data.inventoryItems.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.inventoryItems.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

async function runInventoryLocations(
  options: InventoryLocationsOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = sanitizeRawQuery(options.query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<LocationsListResponse>({
    query: LOCATIONS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      includeInactive: Boolean(options.includeInactive),
      includeLegacy: Boolean(options.includeLegacy),
      query,
    },
  });

  const rows = data.locations.edges.map((edge) => mapLocationRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.locations.edges.map((edge) => edge.node),
      pageInfo: data.locations.pageInfo,
      query,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "numericId",
    "name",
    "address",
    "active",
    "fulfillsOnlineOrders",
    "hasActiveInventory",
    "hasUnfulfilledOrders",
  ]);

  if (data.locations.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.locations.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function flattenInventoryLevels(item: InventoryItemNode): Array<Record<string, unknown>> {
  const levels = item.inventoryLevel
    ? [item.inventoryLevel]
    : (item.inventoryLevels?.nodes ?? []);

  return levels.flatMap((level) =>
    level.quantities.map((quantity) => ({
      itemId: item.id,
      itemNumericId: item.legacyResourceId,
      location: level.location.name,
      locationId: level.location.id,
      quantity: quantity.quantity,
      quantityName: quantity.name,
      sku: item.sku ?? "",
      tracked: item.tracked,
    })),
  );
}

function mapLocationRow(location: LocationNode): Record<string, unknown> {
  return {
    active: !location.deactivatedAt,
    address: location.address.formatted,
    fulfillsOnlineOrders: location.fulfillsOnlineOrders,
    hasActiveInventory: location.hasActiveInventory,
    hasUnfulfilledOrders: location.hasUnfulfilledOrders,
    id: location.id,
    name: location.name,
    numericId: location.legacyResourceId,
  };
}

function printInventoryAdjustResult(
  result: InventoryAdjustGroup,
  format: OutputFormat,
): void {
  if (format === "json") {
    printJson(result);
    return;
  }

  printTable(
    [
      {
        createdAt: result.createdAt,
        id: result.id,
        reason: result.reason,
        referenceDocumentUri: result.referenceDocumentUri ?? "",
      },
    ],
    ["id", "createdAt", "reason", "referenceDocumentUri"],
  );

  if (result.changes.length === 0) {
    return;
  }

  process.stdout.write("\nChanges\n");
  printTable(
    result.changes.map((change) => ({
      delta: change.delta,
      itemId: change.item?.id ?? "",
      location: change.location?.name ?? "",
      locationId: change.location?.id ?? "",
      quantityAfterChange: change.quantityAfterChange ?? "",
      quantityName: change.name,
      sku: change.item?.sku ?? "",
    })),
    [
      "itemId",
      "sku",
      "locationId",
      "location",
      "quantityName",
      "delta",
      "quantityAfterChange",
    ],
  );
}

function assertNoInventoryUserErrors(userErrors: GraphQlUserError[]): void {
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

export function buildInventoryItemSearchQuery(
  options: InventoryItemSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    options.itemId
      ? buildFilterTerm(
          "id",
          extractNumericResourceId(options.itemId, "InventoryItem"),
        )
      : null,
    buildFilterTerm("sku", options.sku),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function buildInventoryAdjustInput(
  options: InventoryAdjustOptions,
): Record<string, unknown> {
  const name = parseInventoryQuantityName(options.name ?? "available");

  if (name !== "available" && !options.ledgerDocumentUri?.trim()) {
    throw new Error(
      "Shopify requires --ledger-document-uri when --name is not available.",
    );
  }

  return {
    changes: [
      omitUndefined({
        changeFromQuantity: null,
        delta: parseInventoryDelta(options.quantity),
        inventoryItemId: normalizeInventoryItemId(options.itemId),
        ledgerDocumentUri: sanitizeRawQuery(options.ledgerDocumentUri) ?? undefined,
        locationId: normalizeLocationId(options.locationId),
      }),
    ],
    name,
    reason: parseInventoryReason(options.reason),
    referenceDocumentUri: sanitizeRawQuery(options.reference) ?? undefined,
  };
}

export function normalizeInventoryItemId(input: string): string {
  return normalizeShopifyId(input, "InventoryItem");
}

export function normalizeLocationId(input: string): string {
  return normalizeShopifyId(input, "Location");
}

export function parseInventoryDelta(input: string): number {
  const value = Number(input);

  if (!Number.isInteger(value)) {
    throw new Error("--quantity must be a whole number. Use negative values to subtract.");
  }

  if (value === 0) {
    throw new Error("--quantity must be different from zero.");
  }

  return value;
}

export function parseInventoryQuantityName(input: string | undefined): string {
  const normalized = input?.trim().toLowerCase();

  if (!normalized) {
    throw new Error("--name must be a non-empty inventory quantity name.");
  }

  return normalized;
}

export function parseInventoryReason(input: string | undefined): string {
  const normalized = (input ?? "correction").trim().toLowerCase();

  if (!normalized) {
    throw new Error("--reason must be a non-empty value.");
  }

  return normalized;
}

function normalizeShopifyId(
  input: string,
  resource: "InventoryItem" | "Location",
): string {
  const trimmed = input.trim();
  const prefix = `gid://shopify/${resource}/`;

  if (trimmed.startsWith(prefix)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `${prefix}${trimmed}`;
  }

  throw new Error(
    `Expected ${resource === "InventoryItem" ? "an inventory item" : "a location"} GID or numeric ID.`,
  );
}

function extractNumericResourceId(
  input: string,
  resource: "InventoryItem" | "Location",
): string {
  const normalized = normalizeShopifyId(input, resource);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
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

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
