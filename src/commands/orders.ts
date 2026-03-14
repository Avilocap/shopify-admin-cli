import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  ORDER_CANCEL_MUTATION,
  ORDER_GET_QUERY,
  ORDER_TRANSACTIONS_QUERY,
  ORDERS_LIST_QUERY,
} from "../graphql/orders.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const ORDER_SORT_KEYS = [
  "CREATED_AT",
  "CURRENT_TOTAL_PRICE",
  "CUSTOMER_NAME",
  "DESTINATION",
  "FINANCIAL_STATUS",
  "FULFILLMENT_STATUS",
  "ID",
  "ORDER_NUMBER",
  "PO_NUMBER",
  "PROCESSED_AT",
  "RELEVANCE",
  "TOTAL_ITEMS_QUANTITY",
  "TOTAL_PRICE",
  "UPDATED_AT",
] as const;

const ORDER_CANCEL_REASONS = [
  "CUSTOMER",
  "DECLINED",
  "FRAUD",
  "INVENTORY",
  "STAFF",
  "OTHER",
] as const;

type OrderSortKey = (typeof ORDER_SORT_KEYS)[number];
type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

interface Money {
  amount: string;
  currencyCode: string;
}

interface MoneySet {
  shopMoney: Money;
}

interface OrderCustomerSummary {
  displayName: string | null;
  email: string | null;
  id?: string;
}

interface OrderTransaction {
  amountSet: MoneySet;
  createdAt: string;
  gateway: string | null;
  id: string;
  kind: string;
  status: string;
}

interface OrderListItem {
  cancelledAt: string | null;
  currentTotalPriceSet: MoneySet;
  customer: OrderCustomerSummary | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  id: string;
  name: string;
  processedAt: string;
}

interface OrderDetails {
  cancelReason: string | null;
  cancelledAt: string | null;
  canNotifyCustomer: boolean;
  currentSubtotalPriceSet: MoneySet;
  currentTotalPriceSet: MoneySet;
  customer: OrderCustomerSummary | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  id: string;
  name: string;
  note: string | null;
  processedAt: string;
  tags: string[];
  transactions: OrderTransaction[];
}

interface OrdersListResponse {
  orders: {
    edges: Array<{
      cursor: string;
      node: OrderListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface OrderGetResponse {
  order: (Omit<OrderDetails, "transactions"> & { transactions: OrderTransaction[] }) | null;
}

interface OrderTransactionsResponse {
  order: {
    id: string;
    name: string;
    transactions: OrderTransaction[];
  } | null;
}

interface OrderCancelResponse {
  orderCancel: {
    job: {
      done: boolean;
      id: string;
    } | null;
    orderCancelUserErrors: GraphQlUserError[];
  };
}

interface OrdersListOptions {
  after?: string;
  financialStatus?: string;
  format: OutputFormat;
  from?: string;
  fulfillmentStatus?: string;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
  status?: string;
  to?: string;
}

interface OrderGetOptions {
  format: OutputFormat;
}

interface OrderCancelOptions {
  force?: boolean;
  format: OutputFormat;
  noRestock?: boolean;
  note?: string;
  notifyCustomer?: boolean;
  reason?: string;
  refundMethod?: string;
}

interface OrderSearchQueryOptions {
  financialStatus?: string;
  from?: string;
  fulfillmentStatus?: string;
  rawQuery?: string;
  status?: string;
  to?: string;
}

export function registerOrderCommands(program: Command): void {
  const orders = program.command("orders").description("Read and modify order data");

  orders
    .command("list")
    .description("List orders")
    .option("--limit <n>", "Number of orders to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify order search query")
    .option("--status <status>", "Filter by order status")
    .option("--financial-status <status>", "Filter by financial status")
    .option("--fulfillment-status <status>", "Filter by fulfillment status")
    .option("--from <date>", "Filter by processed date >= YYYY-MM-DD or ISO date")
    .option("--to <date>", "Filter by processed date <= YYYY-MM-DD or ISO date")
    .option(
      "--sort <sortKey>",
      `Sort by ${ORDER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet orders list --limit 20
  shopfleet orders list --financial-status paid --fulfillment-status unfulfilled
  shopfleet orders list --from 2026-03-01 --to 2026-03-14 --sort processed-at --reverse

Notes:
  --query uses Shopify search syntax directly.
  Pagination is manual. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: OrdersListOptions, command: Command) => {
      await runOrdersList(options, command);
    });

  orders
    .command("get")
    .description("Get an order by GID or numeric ID")
    .argument("<id>", "Order GID or numeric ID")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet orders get gid://shopify/Order/1234567890
  shopfleet orders get 1234567890 --format table

Notes:
  The argument must be a Shopify order GID or numeric order ID.
      `,
    )
    .action(async (id: string, options: OrderGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<OrderGetResponse>({
        query: ORDER_GET_QUERY,
        variables: { id: normalizeOrderId(id) },
      });

      if (!data.order) {
        throw new Error(`Order not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.order);
        return;
      }

      printOrderDetails(data.order);
    });

  orders
    .command("transactions")
    .description("List transactions for an order")
    .argument("<id>", "Order GID or numeric ID")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet orders transactions gid://shopify/Order/1234567890
  shopfleet orders transactions 1234567890 --format json
      `,
    )
    .action(async (id: string, options: OrderGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<OrderTransactionsResponse>({
        query: ORDER_TRANSACTIONS_QUERY,
        variables: { id: normalizeOrderId(id) },
      });

      if (!data.order) {
        throw new Error(`Order not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.order);
        return;
      }

      printOrderTransactions(data.order.transactions);
    });

  orders
    .command("cancel")
    .description("Cancel an order")
    .argument("<id>", "Order GID or numeric ID")
    .option(
      "--reason <reason>",
      `Cancellation reason: ${ORDER_CANCEL_REASONS.join(", ").toLowerCase()}`,
      "other",
    )
    .option("--refund-method <method>", "Refund method: none or original", "none")
    .option("--notify-customer", "Notify the customer")
    .option("--note <note>", "Internal staff note")
    .option("--no-restock", "Do not restock order items")
    .option("--force", "Required to execute the cancellation")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet orders cancel 1234567890 --force
  shopfleet orders cancel 1234567890 --reason customer --refund-method original --notify-customer --force

Notes:
  This command is destructive and requires --force.
  The CLI supports refund-method values "none" and "original".
      `,
    )
    .action(async (id: string, options: OrderCancelOptions, command: Command) => {
      if (!options.force) {
        throw new Error("Refusing to cancel an order without --force.");
      }

      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const orderId = normalizeOrderId(id);
      const data = await client.query<OrderCancelResponse>({
        query: ORDER_CANCEL_MUTATION,
        variables: {
          notifyCustomer: Boolean(options.notifyCustomer),
          orderId,
          reason: parseOrderCancelReason(options.reason),
          refundMethod: buildOrderCancelRefundMethod(options.refundMethod),
          restock: options.noRestock ? false : true,
          staffNote: options.note ?? null,
        },
      });

      assertNoOrderUserErrors(data.orderCancel.orderCancelUserErrors);

      const result = {
        jobDone: data.orderCancel.job?.done ?? false,
        jobId: data.orderCancel.job?.id ?? "",
        note: options.note ?? "",
        notifyCustomer: Boolean(options.notifyCustomer),
        orderId,
        reason: parseOrderCancelReason(options.reason),
        refundMethod: parseRefundMethod(options.refundMethod),
        restock: options.noRestock ? false : true,
      };

      if (options.format === "json") {
        printJson(result);
        return;
      }

      printTable(
        [result],
        [
          "orderId",
          "reason",
          "refundMethod",
          "restock",
          "notifyCustomer",
          "jobDone",
          "jobId",
        ],
      );
    });
}

async function runOrdersList(
  options: OrdersListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = buildOrderSearchQuery({
    financialStatus: options.financialStatus,
    from: options.from,
    fulfillmentStatus: options.fulfillmentStatus,
    rawQuery: options.query,
    status: options.status,
    to: options.to,
  });
  const sortKey = parseOrderSortKey(options.sort, query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<OrdersListResponse>({
    query: ORDERS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.orders.edges.map((edge) => mapOrderListRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.orders.edges.map((edge) => edge.node),
      pageInfo: data.orders.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "name",
    "processedAt",
    "customer",
    "financialStatus",
    "fulfillmentStatus",
    "total",
    "cancelledAt",
  ]);

  if (data.orders.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.orders.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function mapOrderListRow(order: OrderListItem): Record<string, unknown> {
  return {
    cancelledAt: order.cancelledAt ?? "",
    customer: formatOrderCustomer(order.customer),
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    id: order.id,
    name: order.name,
    processedAt: order.processedAt,
    total: formatMoney(order.currentTotalPriceSet.shopMoney),
  };
}

function printOrderDetails(order: OrderDetails): void {
  printTable(
    [
      {
        cancelReason: order.cancelReason ?? "",
        cancelledAt: order.cancelledAt ?? "",
        customer: formatOrderCustomer(order.customer),
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        id: order.id,
        name: order.name,
        note: order.note ?? "",
        processedAt: order.processedAt,
        subtotal: formatMoney(order.currentSubtotalPriceSet.shopMoney),
        tags: order.tags,
        total: formatMoney(order.currentTotalPriceSet.shopMoney),
      },
    ],
    [
      "id",
      "name",
      "processedAt",
      "financialStatus",
      "fulfillmentStatus",
      "subtotal",
      "total",
      "cancelledAt",
      "cancelReason",
      "customer",
      "note",
      "tags",
    ],
  );

  if (order.transactions.length > 0) {
    process.stdout.write("\nTransactions\n");
    printOrderTransactions(order.transactions);
  }
}

function printOrderTransactions(transactions: OrderTransaction[]): void {
  if (transactions.length === 0) {
    process.stdout.write("No transactions.\n");
    return;
  }

  printTable(
    transactions.map((transaction) => ({
      amount: formatMoney(transaction.amountSet.shopMoney),
      createdAt: transaction.createdAt,
      gateway: transaction.gateway ?? "",
      id: transaction.id,
      kind: transaction.kind,
      status: transaction.status,
    })),
    ["id", "kind", "status", "gateway", "amount", "createdAt"],
  );
}

function assertNoOrderUserErrors(userErrors: GraphQlUserError[]): void {
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

function formatMoney(money: Money): string {
  return `${money.amount} ${money.currencyCode}`;
}

function formatOrderCustomer(customer: OrderCustomerSummary | null): string {
  if (!customer) {
    return "";
  }

  const displayName = customer.displayName ?? "";
  const email = customer.email ?? "";

  if (displayName && email) {
    return `${displayName} <${email}>`;
  }

  return displayName || email;
}

export function normalizeOrderId(input: string): string {
  if (input.startsWith("gid://shopify/Order/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Order/${input}`;
  }

  throw new Error("Expected an order GID or numeric order ID.");
}

export function buildOrderSearchQuery(
  options: OrderSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildFilterTerm("status", options.status?.toLowerCase()),
    buildFilterTerm("financial_status", options.financialStatus?.toLowerCase()),
    buildFilterTerm(
      "fulfillment_status",
      options.fulfillmentStatus?.toLowerCase(),
    ),
    buildRangeFilter("processed_at", ">=", options.from),
    buildRangeFilter("processed_at", "<=", options.to),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function parseOrderSortKey(
  input: string | undefined,
  query: string | null,
): OrderSortKey {
  if (!input) {
    return query ? "RELEVANCE" : "PROCESSED_AT";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!ORDER_SORT_KEYS.includes(normalized as OrderSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${ORDER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE" && !query) {
    throw new Error("--sort relevance requires a search query.");
  }

  return normalized as OrderSortKey;
}

export function parseOrderCancelReason(
  input: string | undefined,
): OrderCancelReason {
  const normalized = (input ?? "other").trim().toUpperCase();

  if (!ORDER_CANCEL_REASONS.includes(normalized as OrderCancelReason)) {
    throw new Error(
      `Invalid --reason value "${input}". Valid values: ${ORDER_CANCEL_REASONS.join(", ").toLowerCase()}.`,
    );
  }

  return normalized as OrderCancelReason;
}

export function parseRefundMethod(input: string | undefined): "none" | "original" {
  const normalized = (input ?? "none").trim().toLowerCase();

  if (normalized !== "none" && normalized !== "original") {
    throw new Error(
      `Invalid --refund-method value "${input}". Valid values: none, original.`,
    );
  }

  return normalized;
}

export function buildOrderCancelRefundMethod(
  input: string | undefined,
): Record<string, unknown> | null {
  const refundMethod = parseRefundMethod(input);

  if (refundMethod === "none") {
    return null;
  }

  return {
    originalPaymentMethodsRefund: true,
  };
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

function buildRangeFilter(
  field: string,
  operator: ">=" | "<=",
  value?: string,
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return `${field}:${operator}${trimmed}`;
}

function quoteSearchValue(value: string): string {
  if (!/[\s:()]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
