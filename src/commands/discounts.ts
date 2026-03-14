import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  DISCOUNT_CREATE_MUTATION,
  DISCOUNT_GET_QUERY,
  DISCOUNTS_LIST_QUERY,
} from "../graphql/discounts.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const DISCOUNT_SORT_KEYS = [
  "CREATED_AT",
  "ENDS_AT",
  "ID",
  "RELEVANCE",
  "STARTS_AT",
  "TITLE",
  "UPDATED_AT",
] as const;

type DiscountSortKey = (typeof DISCOUNT_SORT_KEYS)[number];

interface Money {
  amount: string;
  currencyCode: string;
}

interface DiscountCodeNode {
  code: string;
}

interface DiscountCombinesWith {
  orderDiscounts: boolean;
  productDiscounts: boolean;
  shippingDiscounts: boolean;
}

interface DiscountAppType {
  functionId: string;
  title: string | null;
}

interface DiscountValueAmount {
  __typename: "DiscountAmount";
  amount: Money;
  appliesOnEachItem: boolean;
}

interface DiscountValuePercentage {
  __typename: "DiscountPercentage";
  percentage: number;
}

type DiscountValue = DiscountValueAmount | DiscountValuePercentage;

interface DiscountSummaryShape {
  __typename: string;
  appDiscountType?: DiscountAppType | null;
  appliesOncePerCustomer?: boolean;
  asyncUsageCount?: number;
  codes?: {
    nodes: DiscountCodeNode[];
  };
  combinesWith?: DiscountCombinesWith;
  customerGets?: {
    value: DiscountValue | null;
  };
  discountClasses?: string[];
  endsAt: string | null;
  startsAt: string | null;
  status: string;
  summary?: string | null;
  title: string;
  usageLimit?: number | null;
}

interface DiscountNodeItem {
  discount: DiscountSummaryShape;
  id: string;
}

interface DiscountsListResponse {
  discountNodes: {
    edges: Array<{
      cursor: string;
      node: DiscountNodeItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface DiscountGetResponse {
  discountNode: DiscountNodeItem | null;
}

interface DiscountCreateResponse {
  discountCodeBasicCreate: {
    codeDiscountNode: {
      codeDiscount: DiscountSummaryShape | null;
      id: string;
    } | null;
    userErrors: GraphQlUserError[];
  };
}

interface DiscountsListOptions {
  after?: string;
  code?: string;
  format: OutputFormat;
  limit: string;
  method?: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
  status?: string;
  title?: string;
  type?: string;
}

interface DiscountGetOptions {
  format: OutputFormat;
}

interface DiscountCreateOptions {
  amount?: string;
  code: string;
  ends?: string;
  format: OutputFormat;
  oncePerCustomer?: boolean;
  percentage?: string;
  starts: string;
  title: string;
  usageLimit?: string;
}

interface DiscountSearchQueryOptions {
  code?: string;
  method?: string;
  rawQuery?: string;
  status?: string;
  title?: string;
  type?: string;
}

interface DiscountOutput {
  appDiscountType: string;
  appliesOncePerCustomer: boolean | string;
  code: string;
  combinesWith: string;
  discountClasses: string;
  endsAt: string;
  id: string;
  method: string;
  startsAt: string;
  status: string;
  summary: string;
  timesUsed: number | string;
  title: string;
  type: string;
  usageLimit: number | string;
  value: string;
}

export function registerDiscountCommands(program: Command): void {
  const discounts = program.command("discounts").description("Read and create discounts");

  discounts
    .command("list")
    .description("List discounts")
    .option("--limit <n>", "Number of discounts to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify discount search query")
    .option("--code <code>", "Filter by discount code")
    .option("--title <title>", "Filter by discount title")
    .option("--status <status>", "Filter by status: active, expired or scheduled")
    .option("--method <method>", "Filter by method: code or automatic")
    .option(
      "--type <type>",
      "Filter by type: percentage, fixed_amount, free_shipping, bxgy or app",
    )
    .option(
      "--sort <sortKey>",
      `Sort by ${DISCOUNT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet discounts list --limit 20
  shopfleet discounts list --status active --method code
  shopfleet discounts list --query 'title:"Black Friday" method:automatic' --sort starts-at

Notes:
  --query uses Shopify discount search syntax directly.
  Pagination is manual for now. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: DiscountsListOptions, command: Command) => {
      await runDiscountsList(options, command);
    });

  discounts
    .command("get")
    .description("Get a discount by discount node GID")
    .argument("<id>", "Discount GID returned by discounts list or discounts create")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet discounts get gid://shopify/DiscountNode/1234567890
  shopfleet discounts get gid://shopify/DiscountCodeNode/1234567890 --format table

Notes:
  The argument must be a Shopify discount node GID. Numeric discount IDs are not supported here.
      `,
    )
    .action(async (id: string, options: DiscountGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<DiscountGetResponse>({
        query: DISCOUNT_GET_QUERY,
        variables: { id: normalizeDiscountId(id) },
      });

      if (!data.discountNode) {
        throw new Error(`Discount not found: ${id}`);
      }

      const result = normalizeDiscountNode(data.discountNode);

      if (options.format === "json") {
        printJson(result);
        return;
      }

      printDiscountDetails(result);
    });

  discounts
    .command("create")
    .description("Create a basic discount code for all buyers and all items")
    .requiredOption("--title <title>", "Discount title")
    .requiredOption("--code <code>", "Discount code customers will enter")
    .requiredOption("--starts <dateTime>", "Start date as YYYY-MM-DD or ISO datetime")
    .option("--ends <dateTime>", "End date as YYYY-MM-DD or ISO datetime")
    .option("--usage-limit <n>", "Maximum total redemptions")
    .option("--percentage <percent>", "Percentage off, for example 10 or 15.5")
    .option("--amount <amount>", "Fixed amount off, for example 20 or 20.00")
    .option("--once-per-customer", "Limit redemption to one use per customer")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet discounts create --title "Spring 10" --code SPRING10 --starts 2026-03-14 --percentage 10
  shopfleet discounts create --title "VIP 20" --code VIP20 --starts 2026-03-14T09:00:00Z --ends 2026-03-31T23:59:59Z --amount 20 --once-per-customer

Notes:
  This command creates a basic code discount that applies to all buyers and all items.
  Pass exactly one of --percentage or --amount.
      `,
    )
    .action(async (options: DiscountCreateOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<DiscountCreateResponse>({
        query: DISCOUNT_CREATE_MUTATION,
        variables: {
          basicCodeDiscount: buildDiscountCreateInput(options),
        },
      });

      assertNoDiscountUserErrors(data.discountCodeBasicCreate.userErrors);

      const createdNode = data.discountCodeBasicCreate.codeDiscountNode;

      if (!createdNode?.codeDiscount) {
        throw new Error("Shopify did not return the created discount.");
      }

      const result = normalizeDiscountNode({
        discount: createdNode.codeDiscount,
        id: createdNode.id,
      });

      if (options.format === "json") {
        printJson(result);
        return;
      }

      printDiscountDetails(result);
    });
}

async function runDiscountsList(
  options: DiscountsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = buildDiscountSearchQuery({
    code: options.code,
    method: options.method,
    rawQuery: options.query,
    status: options.status,
    title: options.title,
    type: options.type,
  });
  const sortKey = parseDiscountSortKey(options.sort, query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<DiscountsListResponse>({
    query: DISCOUNTS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const items = data.discountNodes.edges.map((edge) => normalizeDiscountNode(edge.node));

  if (options.format === "json") {
    printJson({
      items,
      pageInfo: data.discountNodes.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, items, [
    "id",
    "method",
    "type",
    "code",
    "title",
    "status",
    "value",
    "startsAt",
    "endsAt",
  ]);

  if (data.discountNodes.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.discountNodes.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function normalizeDiscountNode(node: DiscountNodeItem): DiscountOutput {
  const discount = node.discount;

  return {
    appDiscountType: discount.appDiscountType?.title ?? "",
    appliesOncePerCustomer:
      discount.appliesOncePerCustomer === undefined
        ? ""
        : discount.appliesOncePerCustomer,
    code: discount.codes?.nodes[0]?.code ?? "",
    combinesWith: formatCombinesWith(discount.combinesWith),
    discountClasses: (discount.discountClasses ?? []).join(", "),
    endsAt: discount.endsAt ?? "",
    id: node.id,
    method: inferDiscountMethod(discount.__typename),
    startsAt: discount.startsAt ?? "",
    status: discount.status,
    summary: discount.summary ?? "",
    timesUsed: discount.asyncUsageCount ?? "",
    title: discount.title,
    type: inferDiscountType(discount),
    usageLimit: discount.usageLimit ?? "",
    value: formatDiscountValue(discount.customerGets?.value ?? null),
  };
}

function printDiscountDetails(discount: DiscountOutput): void {
  printTable(
    [discount],
    [
      "id",
      "method",
      "type",
      "code",
      "title",
      "status",
      "value",
      "startsAt",
      "endsAt",
      "usageLimit",
      "appliesOncePerCustomer",
      "timesUsed",
      "discountClasses",
      "combinesWith",
      "appDiscountType",
      "summary",
    ],
  );
}

function inferDiscountMethod(typeName: string): string {
  return typeName.startsWith("DiscountCode") ? "code" : "automatic";
}

function inferDiscountType(discount: DiscountSummaryShape): string {
  if (
    discount.__typename === "DiscountCodeBasic" ||
    discount.__typename === "DiscountAutomaticBasic"
  ) {
    const valueType = discount.customerGets?.value?.__typename;

    if (valueType === "DiscountPercentage") {
      return "percentage";
    }

    if (valueType === "DiscountAmount") {
      return "fixed_amount";
    }

    return "basic";
  }

  if (
    discount.__typename === "DiscountCodeBxgy" ||
    discount.__typename === "DiscountAutomaticBxgy"
  ) {
    return "bxgy";
  }

  if (
    discount.__typename === "DiscountCodeFreeShipping" ||
    discount.__typename === "DiscountAutomaticFreeShipping"
  ) {
    return "free_shipping";
  }

  if (
    discount.__typename === "DiscountCodeApp" ||
    discount.__typename === "DiscountAutomaticApp"
  ) {
    return "app";
  }

  return discount.__typename;
}

function formatDiscountValue(value: DiscountValue | null): string {
  if (!value) {
    return "";
  }

  if (value.__typename === "DiscountPercentage") {
    return `${stripTrailingZeros((value.percentage * 100).toFixed(2))}%`;
  }

  return `${value.amount.amount} ${value.amount.currencyCode}`;
}

function formatCombinesWith(combinesWith?: DiscountCombinesWith): string {
  if (!combinesWith) {
    return "";
  }

  return [
    combinesWith.orderDiscounts ? "order_discounts" : null,
    combinesWith.productDiscounts ? "product_discounts" : null,
    combinesWith.shippingDiscounts ? "shipping_discounts" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function assertNoDiscountUserErrors(userErrors: GraphQlUserError[]): void {
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

export function normalizeDiscountId(input: string): string {
  const trimmed = input.trim();

  if (
    /^gid:\/\/shopify\/(DiscountNode|DiscountCodeNode|DiscountAutomaticNode)\/[^/]+$/.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  throw new Error(
    "Expected a discount GID returned by discounts list or discounts create.",
  );
}

export function buildDiscountSearchQuery(
  options: DiscountSearchQueryOptions,
): string | null {
  const parts = [
    sanitizeRawQuery(options.rawQuery),
    buildFilterTerm("code", options.code),
    buildFilterTerm("title", options.title),
    buildFilterTerm("status", options.status?.toLowerCase()),
    buildFilterTerm("method", options.method?.toLowerCase()),
    buildFilterTerm("type", options.type?.toLowerCase()),
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function parseDiscountSortKey(
  input: string | undefined,
  query: string | null,
): DiscountSortKey {
  if (!input) {
    return query ? "RELEVANCE" : "TITLE";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!DISCOUNT_SORT_KEYS.includes(normalized as DiscountSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${DISCOUNT_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE" && !query) {
    throw new Error("--sort relevance requires a search query.");
  }

  return normalized as DiscountSortKey;
}

export function buildDiscountCreateInput(
  options: DiscountCreateOptions,
): Record<string, unknown> {
  const title = requireNonEmptyValue(options.title, "--title");
  const code = requireNonEmptyValue(options.code, "--code");
  const startsAt = parseDateTime(options.starts, "--starts");
  const endsAt = options.ends ? parseDateTime(options.ends, "--ends") : undefined;

  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("--ends must be later than --starts.");
  }

  return omitUndefined({
    appliesOncePerCustomer: Boolean(options.oncePerCustomer),
    code,
    context: {
      all: "ALL",
    },
    customerGets: {
      items: {
        all: true,
      },
      value: parseDiscountValueInput(options),
    },
    endsAt,
    startsAt,
    title,
    usageLimit:
      options.usageLimit !== undefined
        ? parsePositiveInteger(options.usageLimit, "--usage-limit")
        : undefined,
  });
}

function parseDiscountValueInput(
  options: DiscountCreateOptions,
): Record<string, unknown> {
  const percentage = options.percentage?.trim();
  const amount = options.amount?.trim();

  if (percentage && amount) {
    throw new Error("Pass either --percentage or --amount, not both.");
  }

  if (!percentage && !amount) {
    throw new Error("Pass one of --percentage or --amount.");
  }

  if (percentage) {
    const value = Number(percentage);

    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      throw new Error("--percentage must be a number between 0 and 100.");
    }

    return {
      percentage: value / 100,
    };
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("--amount must be a positive number.");
  }

  return {
    discountAmount: {
      amount: numericAmount.toFixed(2),
      appliesOnEachItem: false,
    },
  };
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function parseDateTime(value: string, flagName: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid YYYY-MM-DD or ISO datetime.`);
  }

  return parsed.toISOString();
}

function requireNonEmptyValue(value: string, flagName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${flagName} must not be empty.`);
  }

  return trimmed;
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

function stripTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
