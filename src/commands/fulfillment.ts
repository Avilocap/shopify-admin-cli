import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  FULFILLMENT_CREATE_MUTATION,
  FULFILLMENT_ORDERS_LIST_QUERY,
  FULFILLMENT_TRACKING_UPDATE_MUTATION,
  ORDER_FULFILLMENT_ORDERS_QUERY,
} from "../graphql/fulfillment.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";
import { normalizeOrderId } from "./orders.js";

const FULFILLMENT_SORT_KEYS = [
  "CREATED_AT",
  "FULFILL_BY",
  "ID",
  "UPDATED_AT",
] as const;

type FulfillmentSortKey = (typeof FULFILLMENT_SORT_KEYS)[number];

interface FulfillmentTrackingInfo {
  company: string | null;
  number: string | null;
  url: string | null;
}

interface FulfillmentNode {
  id: string;
  status: string;
  trackingInfo: FulfillmentTrackingInfo[];
}

interface FulfillmentOrderLineItemNode {
  id: string;
  remainingQuantity: number;
  totalQuantity: number;
}

interface FulfillmentOrderLocation {
  location: {
    id: string;
    name: string;
  } | null;
  name: string | null;
}

interface FulfillmentOrderDestination {
  city: string | null;
  countryCode: string | null;
  provinceCode: string | null;
  zip: string | null;
}

interface FulfillmentOrderAction {
  action: string;
}

interface FulfillmentOrderListItem {
  assignedLocation: FulfillmentOrderLocation | null;
  destination: FulfillmentOrderDestination | null;
  fulfillAt: string | null;
  fulfillBy: string | null;
  fulfillments: {
    nodes: FulfillmentNode[];
  };
  id: string;
  lineItems: {
    nodes: FulfillmentOrderLineItemNode[];
  };
  orderId: string;
  orderName: string | null;
  orderProcessedAt: string | null;
  requestStatus: string;
  status: string;
  supportedActions: FulfillmentOrderAction[];
  updatedAt: string;
}

interface FulfillmentOrdersListResponse {
  fulfillmentOrders: {
    edges: Array<{
      cursor: string;
      node: FulfillmentOrderListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface FulfillmentCreateOrderNode {
  assignedLocation: FulfillmentOrderLocation | null;
  id: string;
  lineItems: {
    nodes: FulfillmentOrderLineItemNode[];
  };
  requestStatus: string;
  status: string;
  supportedActions: FulfillmentOrderAction[];
}

interface OrderFulfillmentOrdersResponse {
  order: {
    fulfillmentOrders: {
      nodes: FulfillmentCreateOrderNode[];
    };
    id: string;
    name: string;
  } | null;
}

interface FulfillmentMutationPayload {
  fulfillment: FulfillmentNode | null;
  userErrors: GraphQlUserError[];
}

interface FulfillmentCreateResponse {
  fulfillmentCreate: FulfillmentMutationPayload;
}

interface FulfillmentTrackingUpdateResponse {
  fulfillmentTrackingInfoUpdate: FulfillmentMutationPayload;
}

interface FulfillmentListOptions {
  after?: string;
  format: OutputFormat;
  includeClosed?: boolean;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
  status?: string;
}

interface FulfillmentCreateOptions {
  carrier?: string;
  fulfillmentOrderId?: string;
  format: OutputFormat;
  lineItems?: string;
  message?: string;
  notify?: boolean;
  orderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

interface FulfillmentTrackingOptions {
  carrier?: string;
  format: OutputFormat;
  notify?: boolean;
  trackingNumber?: string;
  trackingUrl?: string;
}

interface FulfillmentSearchQueryOptions {
  rawQuery?: string;
  status?: string;
}

export interface FulfillmentLineItemSelection {
  id: string;
  quantity?: number;
}

interface TrackingInfoInputOptions {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

interface FulfillmentCreateTarget {
  fulfillmentOrderId: string;
  fulfillmentOrderLineItems?: Array<{
    id: string;
    quantity: number;
  }>;
}

interface FulfillmentMutationResult {
  carrier: string;
  fulfillmentId: string;
  notifyCustomer: boolean;
  status: string;
  targetFulfillmentOrderIds: string[];
  trackingNumbers: string[];
  trackingUrls: string[];
}

export function registerFulfillmentCommands(program: Command): void {
  const fulfillment = program
    .command("fulfillment")
    .description("Read and modify fulfillment data");

  fulfillment
    .command("list")
    .description("List fulfillment orders")
    .option("--limit <n>", "Number of fulfillment orders to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify fulfillment order search query")
    .option("--status <status>", "Filter by fulfillment order status")
    .option("--include-closed", "Include closed fulfillment orders")
    .option(
      "--sort <sortKey>",
      `Sort by ${FULFILLMENT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet fulfillment list --limit 20
  shopfleet fulfillment list --status open --sort updated-at
  shopfleet fulfillment list --query 'request_status:unsubmitted' --include-closed

Notes:
  --query uses Shopify fulfillment order search syntax directly.
  Pagination is manual for now. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: FulfillmentListOptions, command: Command) => {
      await runFulfillmentList(options, command);
    });

  fulfillment
    .command("create")
    .description("Create a fulfillment for one order")
    .requiredOption("--order-id <id>", "Order GID or numeric ID")
    .option(
      "--fulfillment-order-id <id>",
      "Fulfillment order GID or numeric ID. Use when the order has multiple open fulfillment orders",
    )
    .option(
      "--line-items <items>",
      "Comma-separated fulfillment order line item IDs, optionally with :quantity",
    )
    .option("--tracking-number <number>", "Tracking number")
    .option("--tracking-url <url>", "Tracking URL")
    .option("--carrier <name>", "Tracking company or carrier")
    .option("--message <text>", "Optional fulfillment message")
    .option("--notify", "Notify the customer")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet fulfillment create --order-id 1234567890
  shopfleet fulfillment create --order-id 1234567890 --tracking-number 1Z9999999999999999 --carrier UPS
  shopfleet fulfillment create --order-id 1234567890 --fulfillment-order-id 987654321 --line-items 445529754:1,445529755:2

Notes:
  --order-id expects a Shopify order GID or numeric order ID.
  --fulfillment-order-id expects a fulfillment order GID or numeric ID.
  --line-items expects fulfillment order line item IDs, not order line item IDs.
  If --line-items is omitted, the CLI attempts to fulfill all remaining quantities on the selected fulfillment order targets.
      `,
    )
    .action(async (options: FulfillmentCreateOptions, command: Command) => {
      await runFulfillmentCreate(options, command);
    });

  fulfillment
    .command("tracking")
    .description("Update tracking information for a fulfillment")
    .argument("<id>", "Fulfillment GID or numeric ID")
    .option("--tracking-number <number>", "Tracking number")
    .option("--tracking-url <url>", "Tracking URL")
    .option("--carrier <name>", "Tracking company or carrier")
    .option("--notify", "Notify the customer")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet fulfillment tracking 255858046 --tracking-number 1Z9999999999999999
  shopfleet fulfillment tracking gid://shopify/Fulfillment/255858046 --tracking-url https://example.com/track/255858046 --carrier UPS --notify

Notes:
  The argument must be a Shopify fulfillment GID or numeric fulfillment ID.
  At least one of --tracking-number, --tracking-url, or --carrier is required.
      `,
    )
    .action(
      async (id: string, options: FulfillmentTrackingOptions, command: Command) => {
        await runFulfillmentTrackingUpdate(id, options, command);
      },
    );
}

async function runFulfillmentList(
  options: FulfillmentListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = buildFulfillmentSearchQuery({
    rawQuery: options.query,
    status: options.status,
  });
  const sortKey = parseFulfillmentSortKey(options.sort);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<FulfillmentOrdersListResponse>({
    query: FULFILLMENT_ORDERS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      includeClosed: Boolean(options.includeClosed),
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.fulfillmentOrders.edges.map((edge) =>
    mapFulfillmentOrderRow(edge.node),
  );

  if (options.format === "json") {
    printJson({
      includeClosed: Boolean(options.includeClosed),
      items: data.fulfillmentOrders.edges.map((edge) => edge.node),
      pageInfo: data.fulfillmentOrders.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "orderName",
    "status",
    "requestStatus",
    "assignedLocation",
    "remainingItems",
    "fulfillments",
    "tracking",
    "updatedAt",
  ]);

  if (data.fulfillmentOrders.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.fulfillmentOrders.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

async function runFulfillmentCreate(
  options: FulfillmentCreateOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const orderId = normalizeOrderId(options.orderId);
  const requestedFulfillmentOrderId = options.fulfillmentOrderId
    ? normalizeFulfillmentOrderId(options.fulfillmentOrderId)
    : undefined;
  const lineItemSelections = parseFulfillmentLineItems(options.lineItems);
  const trackingInfo = buildTrackingInfoInput({
    carrier: options.carrier,
    trackingNumber: options.trackingNumber,
    trackingUrl: options.trackingUrl,
  });

  const data = await client.query<OrderFulfillmentOrdersResponse>({
    query: ORDER_FULFILLMENT_ORDERS_QUERY,
    variables: { id: orderId },
  });

  if (!data.order) {
    throw new Error(`Order not found: ${options.orderId}`);
  }

  const lineItemsByFulfillmentOrder = buildFulfillmentCreateTargets(
    data.order.fulfillmentOrders.nodes,
    requestedFulfillmentOrderId,
    lineItemSelections,
  );

  const mutation = await client.query<FulfillmentCreateResponse>({
    query: FULFILLMENT_CREATE_MUTATION,
    variables: {
      fulfillment: {
        lineItemsByFulfillmentOrder,
        trackingInfo,
      },
      message: options.message ?? null,
      notifyCustomer: Boolean(options.notify),
    },
  });

  assertNoFulfillmentUserErrors(mutation.fulfillmentCreate.userErrors);

  if (!mutation.fulfillmentCreate.fulfillment) {
    throw new Error("Shopify did not return the created fulfillment.");
  }

  const result = mapFulfillmentMutationResult(
    mutation.fulfillmentCreate.fulfillment,
    lineItemsByFulfillmentOrder.map((entry) => entry.fulfillmentOrderId),
    Boolean(options.notify),
  );

  if (options.format === "json") {
    printJson(result);
    return;
  }

  printFulfillmentMutationResult(result);
}

async function runFulfillmentTrackingUpdate(
  id: string,
  options: FulfillmentTrackingOptions,
  command: Command,
): Promise<void> {
  const trackingInfoInput = buildTrackingInfoInput({
    carrier: options.carrier,
    trackingNumber: options.trackingNumber,
    trackingUrl: options.trackingUrl,
  });

  if (!trackingInfoInput) {
    throw new Error(
      "At least one of --tracking-number, --tracking-url, or --carrier is required.",
    );
  }

  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const mutation = await client.query<FulfillmentTrackingUpdateResponse>({
    query: FULFILLMENT_TRACKING_UPDATE_MUTATION,
    variables: {
      fulfillmentId: normalizeFulfillmentId(id),
      notifyCustomer: Boolean(options.notify),
      trackingInfoInput,
    },
  });

  assertNoFulfillmentUserErrors(mutation.fulfillmentTrackingInfoUpdate.userErrors);

  if (!mutation.fulfillmentTrackingInfoUpdate.fulfillment) {
    throw new Error("Shopify did not return the updated fulfillment.");
  }

  const result = mapFulfillmentMutationResult(
    mutation.fulfillmentTrackingInfoUpdate.fulfillment,
    [],
    Boolean(options.notify),
  );

  if (options.format === "json") {
    printJson(result);
    return;
  }

  printFulfillmentMutationResult(result);
}

function mapFulfillmentOrderRow(
  fulfillmentOrder: FulfillmentOrderListItem,
): Record<string, unknown> {
  return {
    assignedLocation: formatAssignedLocation(fulfillmentOrder.assignedLocation),
    fulfillments: fulfillmentOrder.fulfillments.nodes.length,
    id: fulfillmentOrder.id,
    orderName: fulfillmentOrder.orderName ?? fulfillmentOrder.orderId,
    remainingItems: fulfillmentOrder.lineItems.nodes.reduce(
      (sum, lineItem) => sum + lineItem.remainingQuantity,
      0,
    ),
    requestStatus: fulfillmentOrder.requestStatus,
    status: fulfillmentOrder.status,
    tracking: formatTrackingSummary(fulfillmentOrder.fulfillments.nodes),
    updatedAt: fulfillmentOrder.updatedAt,
  };
}

function formatAssignedLocation(location: FulfillmentOrderLocation | null): string {
  if (!location) {
    return "";
  }

  return location.location?.name ?? location.name ?? "";
}

function formatTrackingSummary(fulfillments: FulfillmentNode[]): string {
  const values = fulfillments
    .flatMap((fulfillment) => fulfillment.trackingInfo)
    .map((tracking) => tracking.number ?? tracking.url ?? tracking.company ?? "")
    .filter(Boolean);

  return values.join(", ");
}

function mapFulfillmentMutationResult(
  fulfillment: FulfillmentNode,
  targetFulfillmentOrderIds: string[],
  notifyCustomer: boolean,
): FulfillmentMutationResult {
  return {
    carrier: fulfillment.trackingInfo
      .map((tracking) => tracking.company ?? "")
      .filter(Boolean)
      .join(", "),
    fulfillmentId: fulfillment.id,
    notifyCustomer,
    status: fulfillment.status,
    targetFulfillmentOrderIds,
    trackingNumbers: fulfillment.trackingInfo
      .map((tracking) => tracking.number ?? "")
      .filter(Boolean),
    trackingUrls: fulfillment.trackingInfo
      .map((tracking) => tracking.url ?? "")
      .filter(Boolean),
  };
}

function printFulfillmentMutationResult(result: FulfillmentMutationResult): void {
  printTable(
    [
      {
        carrier: result.carrier,
        fulfillmentId: result.fulfillmentId,
        notifyCustomer: result.notifyCustomer,
        status: result.status,
        targetFulfillmentOrderIds: result.targetFulfillmentOrderIds,
        trackingNumbers: result.trackingNumbers,
        trackingUrls: result.trackingUrls,
      },
    ],
    [
      "fulfillmentId",
      "status",
      "carrier",
      "trackingNumbers",
      "trackingUrls",
      "notifyCustomer",
      "targetFulfillmentOrderIds",
    ],
  );
}

function assertNoFulfillmentUserErrors(userErrors: GraphQlUserError[]): void {
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

function buildFulfillmentCreateTargets(
  fulfillmentOrders: FulfillmentCreateOrderNode[],
  requestedFulfillmentOrderId: string | undefined,
  lineItemSelections: FulfillmentLineItemSelection[],
): FulfillmentCreateTarget[] {
  const eligibleOrders = fulfillmentOrders.filter(canCreateFulfillment);
  const targetOrders = requestedFulfillmentOrderId
    ? eligibleOrders.filter((fulfillmentOrder) => fulfillmentOrder.id === requestedFulfillmentOrderId)
    : eligibleOrders;

  if (requestedFulfillmentOrderId && targetOrders.length === 0) {
    throw new Error(
      `Fulfillment order not found or not fulfillable: ${requestedFulfillmentOrderId}`,
    );
  }

  if (targetOrders.length === 0) {
    throw new Error("No fulfillable fulfillment orders were found for the target order.");
  }

  if (lineItemSelections.length === 0) {
    assertSingleAssignedLocation(targetOrders);
    return targetOrders.map((fulfillmentOrder) => ({
      fulfillmentOrderId: fulfillmentOrder.id,
    }));
  }

  const selectionsById = new Map<string, FulfillmentLineItemSelection>();

  for (const selection of lineItemSelections) {
    if (selectionsById.has(selection.id)) {
      throw new Error(`Duplicate fulfillment order line item ID: ${selection.id}`);
    }

    selectionsById.set(selection.id, selection);
  }

  const grouped = new Map<
    string,
    {
      fulfillmentOrder: FulfillmentCreateOrderNode;
      items: Array<{ id: string; quantity: number }>;
    }
  >();

  for (const fulfillmentOrder of targetOrders) {
    for (const lineItem of fulfillmentOrder.lineItems.nodes) {
      const selection = selectionsById.get(lineItem.id);

      if (!selection) {
        continue;
      }

      if (lineItem.remainingQuantity <= 0) {
        throw new Error(`No remaining quantity for fulfillment order line item ${lineItem.id}.`);
      }

      const quantity = selection.quantity ?? lineItem.remainingQuantity;

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for fulfillment order line item ${lineItem.id}.`);
      }

      if (quantity > lineItem.remainingQuantity) {
        throw new Error(
          `Requested quantity ${quantity} exceeds remaining quantity ${lineItem.remainingQuantity} for fulfillment order line item ${lineItem.id}.`,
        );
      }

      const current = grouped.get(fulfillmentOrder.id) ?? {
        fulfillmentOrder,
        items: [],
      };

      current.items.push({
        id: lineItem.id,
        quantity,
      });
      grouped.set(fulfillmentOrder.id, current);
      selectionsById.delete(lineItem.id);
    }
  }

  if (selectionsById.size > 0) {
    throw new Error(
      `Unknown fulfillment order line item IDs: ${Array.from(selectionsById.keys()).join(", ")}`,
    );
  }

  const groupedOrders = Array.from(grouped.values()).map((entry) => entry.fulfillmentOrder);
  assertSingleAssignedLocation(groupedOrders);

  return Array.from(grouped.values()).map((entry) => ({
    fulfillmentOrderId: entry.fulfillmentOrder.id,
    fulfillmentOrderLineItems: entry.items,
  }));
}

function canCreateFulfillment(fulfillmentOrder: FulfillmentCreateOrderNode): boolean {
  const hasRemainingQuantity = fulfillmentOrder.lineItems.nodes.some(
    (lineItem) => lineItem.remainingQuantity > 0,
  );
  const supportsCreate = fulfillmentOrder.supportedActions.some(
    (action) => action.action === "CREATE_FULFILLMENT",
  );

  return hasRemainingQuantity && supportsCreate;
}

function assertSingleAssignedLocation(
  fulfillmentOrders: FulfillmentCreateOrderNode[],
): void {
  const locationKeys = new Set(
    fulfillmentOrders.map((fulfillmentOrder) => {
      const locationId = fulfillmentOrder.assignedLocation?.location?.id;

      if (locationId) {
        return locationId;
      }

      return fulfillmentOrder.assignedLocation?.name ?? fulfillmentOrder.id;
    }),
  );

  if (locationKeys.size > 1) {
    throw new Error(
      "The target order has fulfillable fulfillment orders across multiple locations. Use --fulfillment-order-id or --line-items to narrow the request to one location.",
    );
  }
}

export function normalizeFulfillmentOrderId(input: string): string {
  if (input.startsWith("gid://shopify/FulfillmentOrder/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/FulfillmentOrder/${input}`;
  }

  throw new Error("Expected a fulfillment order GID or numeric fulfillment order ID.");
}

export function normalizeFulfillmentOrderLineItemId(input: string): string {
  if (input.startsWith("gid://shopify/FulfillmentOrderLineItem/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/FulfillmentOrderLineItem/${input}`;
  }

  throw new Error(
    "Expected a fulfillment order line item GID or numeric fulfillment order line item ID.",
  );
}

export function normalizeFulfillmentId(input: string): string {
  if (input.startsWith("gid://shopify/Fulfillment/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Fulfillment/${input}`;
  }

  throw new Error("Expected a fulfillment GID or numeric fulfillment ID.");
}

export function buildFulfillmentSearchQuery(
  options: FulfillmentSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildFilterTerm("status", options.status?.toLowerCase()),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function parseFulfillmentSortKey(input: string | undefined): FulfillmentSortKey {
  if (!input) {
    return "UPDATED_AT";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!FULFILLMENT_SORT_KEYS.includes(normalized as FulfillmentSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${FULFILLMENT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  return normalized as FulfillmentSortKey;
}

export function parseFulfillmentLineItems(
  input: string | undefined,
): FulfillmentLineItemSelection[] {
  const trimmed = input?.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed.split(",").map((entry) => {
    const [rawId, rawQuantity] = entry.split(":");
    const id = normalizeFulfillmentOrderLineItemId(rawId?.trim() ?? "");

    if (!rawQuantity) {
      return { id };
    }

    const quantity = Number(rawQuantity.trim());

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity in --line-items entry "${entry}".`);
    }

    return { id, quantity };
  });
}

export function buildTrackingInfoInput(
  options: TrackingInfoInputOptions,
): Record<string, string> | null {
  const trackingInfo = {
    ...(sanitizeScalarInput(options.carrier)
      ? { company: sanitizeScalarInput(options.carrier) as string }
      : {}),
    ...(sanitizeScalarInput(options.trackingNumber)
      ? { number: sanitizeScalarInput(options.trackingNumber) as string }
      : {}),
    ...(sanitizeScalarInput(options.trackingUrl)
      ? { url: sanitizeScalarInput(options.trackingUrl) as string }
      : {}),
  };

  if (Object.keys(trackingInfo).length === 0) {
    return null;
  }

  return trackingInfo;
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeScalarInput(value?: string): string | null {
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
