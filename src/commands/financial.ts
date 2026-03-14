import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  FINANCIAL_REFUND_CONTEXT_QUERY,
  FINANCIAL_REFUND_MUTATION,
  FINANCIAL_SUMMARY_ORDERS_QUERY,
  FINANCIAL_TRANSACTIONS_QUERY,
} from "../graphql/financial.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printTable } from "../utils/output.js";
import { buildOrderSearchQuery, normalizeOrderId } from "./orders.js";

interface Money {
  amount: string;
  currencyCode: string;
}

interface MoneySet {
  shopMoney: Money;
}

interface OrderTransaction {
  amountSet: MoneySet;
  createdAt: string;
  gateway: string | null;
  id: string;
  kind: string;
  status: string;
}

interface OrderLineItemRefundable {
  id: string;
  name: string;
  quantity: number;
  refundableQuantity: number;
}

interface FinancialTransactionsResponse {
  order: {
    id: string;
    name: string;
    transactions: OrderTransaction[];
  } | null;
}

interface FinancialRefundContextResponse {
  order: {
    id: string;
    lineItems: {
      nodes: OrderLineItemRefundable[];
    };
    name: string;
  } | null;
}

interface FinancialRefundLineItem {
  quantity: number;
  lineItem: {
    id: string;
    name: string;
  } | null;
}

interface FinancialRefundResponse {
  refundCreate: {
    refund: {
      createdAt: string;
      id: string;
      note: string | null;
      refundLineItems: {
        edges: Array<{
          node: FinancialRefundLineItem;
        }>;
      };
      totalRefundedSet: MoneySet | null;
      transactions: {
        edges: Array<{
          node: OrderTransaction;
        }>;
      };
    } | null;
    userErrors: GraphQlUserError[];
  };
}

interface FinancialSummaryOrder {
  cancelledAt: string | null;
  currentTotalPriceSet: MoneySet;
  displayFinancialStatus: string;
  id: string;
  name: string;
  processedAt: string;
  totalOutstandingSet: MoneySet | null;
  totalPriceSet: MoneySet;
  totalRefundedSet: MoneySet | null;
}

interface FinancialSummaryOrdersResponse {
  orders: {
    edges: Array<{
      cursor: string;
      node: FinancialSummaryOrder;
    }>;
    pageInfo: PageInfo;
  };
}

interface FinancialTransactionsOptions {
  format: OutputFormat;
}

interface FinancialRefundOptions {
  force?: boolean;
  format: OutputFormat;
  lineItems?: string;
  note?: string;
  notify?: boolean;
  restock?: boolean;
  shippingAmount?: string;
}

interface FinancialSummaryOptions {
  financialStatus?: string;
  format: OutputFormat;
  from?: string;
  fulfillmentStatus?: string;
  limit: string;
  query?: string;
  status?: string;
  to?: string;
}

interface RefundLineItemSelection {
  lineItemId: string;
  quantity: number;
}

interface DecimalAmount {
  scale: number;
  value: bigint;
}

interface FinancialSummaryResult {
  cancelledOrders: number;
  currentSales: string;
  financialStatusBreakdown: Record<string, number>;
  grossSales: string;
  hasMore: boolean;
  orderCount: number;
  outstanding: string;
  query: string | null;
  refunded: string;
}

const EMPTY_DECIMAL_AMOUNT: DecimalAmount = {
  scale: 0,
  value: 0n,
};

export function registerFinancialCommands(program: Command): void {
  const financial = program
    .command("financial")
    .description("Read transactions, create refunds, and summarize order finances");

  financial
    .command("transactions")
    .description("List transactions for an order")
    .argument("<id>", "Order GID or numeric ID")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet financial transactions 1234567890
  shopfleet financial transactions gid://shopify/Order/1234567890 --format json

Notes:
  The argument must be a Shopify order GID or numeric order ID.
      `,
    )
    .action(async (id: string, options: FinancialTransactionsOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<FinancialTransactionsResponse>({
        query: FINANCIAL_TRANSACTIONS_QUERY,
        variables: { id: normalizeOrderId(id) },
      });

      if (!data.order) {
        throw new Error(`Order not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.order);
        return;
      }

      printTransactionsTable(data.order.transactions);
    });

  financial
    .command("refund")
    .description("Create a refund for an order")
    .argument("<id>", "Order GID or numeric ID")
    .option(
      "--line-items <items>",
      "Comma-separated refunds as <line-item-id>:<quantity>",
    )
    .option("--shipping-amount <amount>", "Shipping refund amount in shop currency")
    .option("--note <note>", "Internal refund note")
    .option("--notify", "Notify the customer")
    .option("--restock", "Restock refunded quantities")
    .option("--force", "Required to execute the refund")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet financial refund 1234567890 --line-items 987654321:1 --force
  shopfleet financial refund gid://shopify/Order/1234567890 --line-items gid://shopify/LineItem/987654321:2 --shipping-amount 6.99 --restock --notify --force

Notes:
  The argument must be a Shopify order GID or numeric order ID.
  --line-items expects Shopify line item GIDs or numeric line item IDs in the form <line-item-id>:<quantity>.
  Provide --line-items, --shipping-amount, or both.
  This command is destructive and requires --force.
      `,
    )
    .action(async (id: string, options: FinancialRefundOptions, command: Command) => {
      await runFinancialRefund(id, options, command);
    });

  financial
    .command("summary")
    .description("Summarize finances from matching orders")
    .option("--limit <n>", "Maximum number of orders to summarize", "100")
    .option("--query <query>", "Raw Shopify order search query")
    .option("--status <status>", "Filter by order status")
    .option("--financial-status <status>", "Filter by financial status")
    .option("--fulfillment-status <status>", "Filter by fulfillment status")
    .option("--from <date>", "Filter by processed date >= YYYY-MM-DD or ISO date")
    .option("--to <date>", "Filter by processed date <= YYYY-MM-DD or ISO date")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet financial summary --from 2026-03-01 --to 2026-03-14
  shopfleet financial summary --financial-status paid --limit 250 --format json

Notes:
  This command reads matching orders and calculates totals locally.
  --limit caps how many matching orders are included in the summary.
      `,
    )
    .action(async (options: FinancialSummaryOptions, command: Command) => {
      await runFinancialSummary(options, command);
    });
}

async function runFinancialRefund(
  id: string,
  options: FinancialRefundOptions,
  command: Command,
): Promise<void> {
  if (!options.force) {
    throw new Error("Refusing to create a refund without --force.");
  }

  const requestedLineItems = parseRefundLineItems(options.lineItems);
  const shippingAmount = parseShippingAmount(options.shippingAmount);

  if (requestedLineItems.length === 0 && shippingAmount === null) {
    throw new Error("Provide --line-items, --shipping-amount, or both.");
  }

  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const orderId = normalizeOrderId(id);
  const context = await client.query<FinancialRefundContextResponse>({
    query: FINANCIAL_REFUND_CONTEXT_QUERY,
    variables: { id: orderId },
  });

  if (!context.order) {
    throw new Error(`Order not found: ${id}`);
  }

  const refundLineItems = buildRefundLineItemsInput(
    requestedLineItems,
    context.order.lineItems.nodes,
    Boolean(options.restock),
  );

  const data = await client.query<FinancialRefundResponse>({
    query: FINANCIAL_REFUND_MUTATION,
    variables: {
      input: {
        note: options.note ?? null,
        notify: Boolean(options.notify),
        orderId,
        refundLineItems: refundLineItems.length > 0 ? refundLineItems : undefined,
        shipping:
          shippingAmount === null
            ? undefined
            : {
                amount: shippingAmount,
              },
        transactions: [],
      },
    },
  });

  assertNoFinancialUserErrors(data.refundCreate.userErrors);

  const refund = data.refundCreate.refund;

  if (!refund) {
    throw new Error("Shopify did not return refund details.");
  }

  if (options.format === "json") {
    printJson({
      order: {
        id: context.order.id,
        name: context.order.name,
      },
      refund,
      request: {
        lineItems: refundLineItems,
        note: options.note ?? null,
        notify: Boolean(options.notify),
        restock: Boolean(options.restock),
        shippingAmount,
      },
    });
    return;
  }

  printTable(
    [
      {
        createdAt: refund.createdAt,
        id: refund.id,
        note: refund.note ?? "",
        notify: Boolean(options.notify),
        orderId: context.order.id,
        orderName: context.order.name,
        refundedItems: refund.refundLineItems.edges.map((edge) =>
          formatRefundedLineItem(edge.node),
        ),
        restock: Boolean(options.restock),
        shippingAmount: shippingAmount ?? "",
        totalRefunded: refund.totalRefundedSet
          ? formatMoney(refund.totalRefundedSet.shopMoney)
          : "",
      },
    ],
    [
      "id",
      "orderId",
      "orderName",
      "totalRefunded",
      "shippingAmount",
      "restock",
      "notify",
      "createdAt",
      "note",
      "refundedItems",
    ],
  );

  if (refund.transactions.edges.length > 0) {
    process.stdout.write("\nTransactions\n");
    printTransactionsTable(refund.transactions.edges.map((edge) => edge.node));
  }
}

async function runFinancialSummary(
  options: FinancialSummaryOptions,
  command: Command,
): Promise<void> {
  const limit = Number(options.limit);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
    throw new Error("--limit must be an integer between 1 and 1000.");
  }

  const query = buildOrderSearchQuery({
    financialStatus: options.financialStatus,
    from: options.from,
    fulfillmentStatus: options.fulfillmentStatus,
    rawQuery: options.query,
    status: options.status,
    to: options.to,
  });
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const orders: FinancialSummaryOrder[] = [];
  let after: string | null = null;
  let hasNextPage = false;

  do {
    const pageSize = Math.min(250, limit - orders.length);
    const data: FinancialSummaryOrdersResponse =
      await client.query<FinancialSummaryOrdersResponse>({
      query: FINANCIAL_SUMMARY_ORDERS_QUERY,
      variables: {
        after,
        first: pageSize,
        query,
      },
    });

    orders.push(
      ...data.orders.edges.map(
        (edge: { cursor: string; node: FinancialSummaryOrder }) => edge.node,
      ),
    );
    after = data.orders.pageInfo.endCursor;
    hasNextPage = data.orders.pageInfo.hasNextPage;
  } while (orders.length < limit && hasNextPage && after);

  const summary = summarizeFinancialOrders(
    orders,
    query,
    hasNextPage && orders.length >= limit,
  );

  if (options.format === "json") {
    printJson(summary);
    return;
  }

  printTable(
    [
      {
        cancelledOrders: summary.cancelledOrders,
        currentSales: summary.currentSales,
        grossSales: summary.grossSales,
        hasMore: summary.hasMore,
        orderCount: summary.orderCount,
        outstanding: summary.outstanding,
        query: summary.query ?? "",
        refunded: summary.refunded,
      },
    ],
    [
      "orderCount",
      "cancelledOrders",
      "grossSales",
      "currentSales",
      "refunded",
      "outstanding",
      "hasMore",
      "query",
    ],
  );

  if (Object.keys(summary.financialStatusBreakdown).length > 0) {
    process.stdout.write("\nFinancial status breakdown\n");
    printTable(
      Object.entries(summary.financialStatusBreakdown).map(([status, count]) => ({
        count,
        status,
      })),
      ["status", "count"],
    );
  }
}

function printTransactionsTable(transactions: OrderTransaction[]): void {
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

function buildRefundLineItemsInput(
  requestedLineItems: RefundLineItemSelection[],
  availableLineItems: OrderLineItemRefundable[],
  restock: boolean,
): Array<{
  lineItemId: string;
  quantity: number;
  restockType: "NO_RESTOCK" | "RETURN";
}> {
  const availableById = new Map(
    availableLineItems.map((lineItem) => [normalizeLineItemId(lineItem.id), lineItem]),
  );

  return requestedLineItems.map((selection) => {
    const lineItemId = normalizeLineItemId(selection.lineItemId);
    const lineItem = availableById.get(lineItemId);

    if (!lineItem) {
      throw new Error(`Line item not found on the order: ${selection.lineItemId}`);
    }

    if (lineItem.refundableQuantity <= 0) {
      throw new Error(`Line item is not refundable: ${selection.lineItemId}`);
    }

    if (selection.quantity > lineItem.refundableQuantity) {
      throw new Error(
        `Requested refund quantity ${selection.quantity} exceeds refundable quantity ${lineItem.refundableQuantity} for line item ${selection.lineItemId}.`,
      );
    }

    return {
      lineItemId,
      quantity: selection.quantity,
      restockType: restock ? "RETURN" : "NO_RESTOCK",
    };
  });
}

function formatMoney(money: Money): string {
  return `${money.amount} ${money.currencyCode}`;
}

function formatRefundedLineItem(lineItem: FinancialRefundLineItem): string {
  const name = lineItem.lineItem?.name ?? lineItem.lineItem?.id ?? "Unknown line item";
  return `${name} x${lineItem.quantity}`;
}

function assertNoFinancialUserErrors(userErrors: GraphQlUserError[]): void {
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

export function normalizeLineItemId(input: string): string {
  if (input.startsWith("gid://shopify/LineItem/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/LineItem/${input}`;
  }

  throw new Error("Expected a line item GID or numeric line item ID.");
}

export function parseRefundLineItems(input: string | undefined): RefundLineItemSelection[] {
  const trimmed = input?.trim();

  if (!trimmed) {
    return [];
  }

  const seen = new Set<string>();

  return trimmed.split(",").map((entry) => {
    const separatorIndex = entry.lastIndexOf(":");

    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(
        `Invalid --line-items entry "${entry}". Expected <line-item-id>:<quantity>.`,
      );
    }

    const rawId = entry.slice(0, separatorIndex).trim();
    const rawQuantity = entry.slice(separatorIndex + 1).trim();

    if (!rawId || !rawQuantity) {
      throw new Error(
        `Invalid --line-items entry "${entry}". Expected <line-item-id>:<quantity>.`,
      );
    }

    if (!/^\d+$/.test(rawQuantity)) {
      throw new Error(
        `Invalid refund quantity "${rawQuantity}" for line item ${rawId}. Expected a positive integer.`,
      );
    }

    const lineItemId = normalizeLineItemId(rawId);

    if (seen.has(lineItemId)) {
      throw new Error(`Duplicate line item in --line-items: ${lineItemId}`);
    }

    seen.add(lineItemId);

    const quantity = Number(rawQuantity);

    if (quantity <= 0) {
      throw new Error(
        `Invalid refund quantity "${rawQuantity}" for line item ${rawId}. Expected a positive integer.`,
      );
    }

    return {
      lineItemId,
      quantity,
    };
  });
}

export function parseShippingAmount(input: string | undefined): string | null {
  const trimmed = input?.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new Error(
      `Invalid --shipping-amount value "${input}". Expected a positive decimal amount.`,
    );
  }

  if (trimmed === "0" || /^0(?:\.0+)?$/.test(trimmed)) {
    throw new Error("--shipping-amount must be greater than 0.");
  }

  return trimmed;
}

export function summarizeFinancialOrders(
  orders: FinancialSummaryOrder[],
  query: string | null,
  hasMore: boolean,
): FinancialSummaryResult {
  let grossSales = EMPTY_DECIMAL_AMOUNT;
  let currentSales = EMPTY_DECIMAL_AMOUNT;
  let refunded = EMPTY_DECIMAL_AMOUNT;
  let outstanding = EMPTY_DECIMAL_AMOUNT;
  let cancelledOrders = 0;
  const financialStatusBreakdown: Record<string, number> = {};
  let currencyCode = "USD";

  for (const order of orders) {
    grossSales = addDecimalAmount(grossSales, order.totalPriceSet.shopMoney.amount);
    currentSales = addDecimalAmount(
      currentSales,
      order.currentTotalPriceSet.shopMoney.amount,
    );
    refunded = addDecimalAmount(
      refunded,
      order.totalRefundedSet?.shopMoney.amount ?? "0",
    );
    outstanding = addDecimalAmount(
      outstanding,
      order.totalOutstandingSet?.shopMoney.amount ?? "0",
    );

    if (order.cancelledAt) {
      cancelledOrders += 1;
    }

    financialStatusBreakdown[order.displayFinancialStatus] =
      (financialStatusBreakdown[order.displayFinancialStatus] ?? 0) + 1;
    currencyCode = order.totalPriceSet.shopMoney.currencyCode;
  }

  return {
    cancelledOrders,
    currentSales: formatDecimalAmount(currentSales, currencyCode),
    financialStatusBreakdown,
    grossSales: formatDecimalAmount(grossSales, currencyCode),
    hasMore,
    orderCount: orders.length,
    outstanding: formatDecimalAmount(outstanding, currencyCode),
    query,
    refunded: formatDecimalAmount(refunded, currencyCode),
  };
}

function addDecimalAmount(total: DecimalAmount, amount: string): DecimalAmount {
  const normalized = parseDecimalAmount(amount);
  const scale = Math.max(total.scale, normalized.scale);
  const left = scaleDecimal(total.value, total.scale, scale);
  const right = scaleDecimal(normalized.value, normalized.scale, scale);

  return {
    scale,
    value: left + right,
  };
}

function parseDecimalAmount(input: string): DecimalAmount {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const normalized = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ""] = normalized.split(".");

  if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(fraction)) {
    throw new Error(`Invalid decimal amount "${input}".`);
  }

  const digits = `${whole || "0"}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  const value = BigInt(digits) * (negative ? -1n : 1n);

  return {
    scale: fraction.length,
    value,
  };
}

function scaleDecimal(value: bigint, fromScale: number, toScale: number): bigint {
  if (fromScale === toScale) {
    return value;
  }

  return value * 10n ** BigInt(toScale - fromScale);
}

function formatDecimalAmount(amount: DecimalAmount, currencyCode: string): string {
  const negative = amount.value < 0n;
  const absolute = negative ? amount.value * -1n : amount.value;
  const scale = amount.scale;
  const padded = absolute.toString().padStart(scale + 1, "0");
  const integerPart = scale === 0 ? padded : padded.slice(0, -scale);
  const fractionPart = scale === 0 ? "" : padded.slice(-scale).replace(/0+$/, "");
  const number = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;

  return `${negative ? "-" : ""}${number} ${currencyCode}`;
}
