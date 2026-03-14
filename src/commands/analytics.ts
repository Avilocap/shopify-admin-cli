import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import { SHOPIFYQL_QUERY } from "../graphql/analytics.js";
import type { OutputFormat } from "../types.js";
import { printJson, printOutput } from "../utils/output.js";

const COMPARISON_OPTIONS = [
  "previous_period",
  "previous_year",
  "previous_month",
  "this_month",
  "last_month",
  "previous_year_match_day_of_week",
] as const;

const TIMESERIES_OPTIONS = ["day", "week", "month"] as const;
const PRODUCT_GROUP_BY_OPTIONS = [
  "product_title",
  "product_vendor",
  "product_type",
  "product_id",
  "product_variant_title",
  "product_variant_sku",
  "product_variant_id",
  "product_variant_vendor",
  "product_variant_product_title",
  "product_variant_product_type",
] as const;
const PRODUCT_ORDER_BY_OPTIONS = ["total_sales", "net_items_sold"] as const;

type ComparisonOption = (typeof COMPARISON_OPTIONS)[number];
type TimeseriesOption = (typeof TIMESERIES_OPTIONS)[number];
type ProductGroupByOption = (typeof PRODUCT_GROUP_BY_OPTIONS)[number];
type ProductOrderByOption = (typeof PRODUCT_ORDER_BY_OPTIONS)[number];

interface ShopifyQlColumn {
  dataType: string;
  displayName: string;
  name: string;
}

interface ShopifyQlPayload {
  parseErrors: string[];
  tableData: {
    columns: ShopifyQlColumn[];
    rows: Array<Record<string, unknown>>;
  } | null;
}

interface ShopifyQlResponse {
  shopifyqlQuery: ShopifyQlPayload;
}

interface AnalyticsBaseOptions {
  compareTo?: string;
  during?: string;
  format: OutputFormat;
  since?: string;
  until?: string;
}

interface AnalyticsCustomOptions {
  format: OutputFormat;
  query: string;
}

interface AnalyticsSalesOptions extends AnalyticsBaseOptions {
  timeseries?: string;
}

interface AnalyticsProductsOptions extends AnalyticsBaseOptions {
  groupBy?: string;
  limit: string;
  orderBy?: string;
}

interface AnalyticsOverviewOptions extends AnalyticsBaseOptions {}

interface AnalyticsResult {
  columns: ShopifyQlColumn[];
  meta: {
    dataset: string;
    rowCount: number;
    store: string;
  };
  parseErrors: string[];
  query: string;
  rows: Array<Record<string, unknown>>;
}

export function registerAnalyticsCommands(program: Command): void {
  const analytics = program
    .command("analytics")
    .description("Run store analytics through ShopifyQL");

  analytics
    .command("custom")
    .description("Run a raw ShopifyQL query")
    .requiredOption("--query <query>", "Raw ShopifyQL query")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet analytics custom --query "FROM sales SHOW total_sales DURING last_month"
  shopfleet analytics custom --query "FROM sales SHOW total_sales TIMESERIES day DURING last_week" --format table

Notes:
  This is the core analytics primitive. Other analytics commands are presets built on top of ShopifyQL.
      `,
    )
    .action(async (options: AnalyticsCustomOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const result = await runShopifyQlForStore(storeAlias, options.query, "custom");
      printAnalyticsResult(result, options.format);
    });

  analytics
    .command("sales")
    .description("Run a sales analytics preset")
    .option("--during <range>", "Named date range, e.g. last_month", "last_month")
    .option("--since <value>", "ShopifyQL SINCE value, e.g. -30d or 2026-03-01")
    .option("--until <value>", "ShopifyQL UNTIL value, e.g. today or 2026-03-31")
    .option("--timeseries <unit>", "day, week, or month")
    .option(
      "--compare-to <range>",
      `Comparison range: ${COMPARISON_OPTIONS.join(", ")}`,
    )
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet analytics sales --during last_month
  shopfleet analytics sales --during last_week --timeseries day --compare-to previous_period
  shopfleet analytics sales --since 2026-03-01 --until 2026-03-14

Notes:
  Use --during for named ranges or --since/--until for explicit ranges.
      `,
    )
    .action(async (options: AnalyticsSalesOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const query = buildSalesQuery(options);
      const result = await runShopifyQlForStore(storeAlias, query, "sales");
      printAnalyticsResult(result, options.format);
    });

  analytics
    .command("products")
    .description("Run a product performance analytics preset")
    .option("--during <range>", "Named date range, e.g. last_month", "last_month")
    .option("--since <value>", "ShopifyQL SINCE value, e.g. -30d or 2026-03-01")
    .option("--until <value>", "ShopifyQL UNTIL value, e.g. today or 2026-03-31")
    .option(
      "--group-by <fields>",
      `Comma-separated fields: ${PRODUCT_GROUP_BY_OPTIONS.join(", ")}`,
      "product_title,product_vendor",
    )
    .option(
      "--order-by <metric>",
      `Order by metric: ${PRODUCT_ORDER_BY_OPTIONS.join(", ")}`,
      "total_sales",
    )
    .option("--limit <n>", "Number of rows to return", "20")
    .option(
      "--compare-to <range>",
      `Comparison range: ${COMPARISON_OPTIONS.join(", ")}`,
    )
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet analytics products --during last_month --limit 10
  shopfleet analytics products --group-by product_type,product_vendor --order-by net_items_sold
  shopfleet analytics products --since 2026-03-01 --until 2026-03-14 --compare-to previous_period

Notes:
  Product analytics uses the sales dataset and groups performance by product dimensions.
      `,
    )
    .action(async (options: AnalyticsProductsOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const query = buildProductsQuery(options);
      const result = await runShopifyQlForStore(storeAlias, query, "products");
      printAnalyticsResult(result, options.format);
    });

  analytics
    .command("overview")
    .description("Run a store overview analytics preset")
    .option("--during <range>", "Named date range, e.g. last_month", "last_month")
    .option("--since <value>", "ShopifyQL SINCE value, e.g. -30d or 2026-03-01")
    .option("--until <value>", "ShopifyQL UNTIL value, e.g. today or 2026-03-31")
    .option(
      "--compare-to <range>",
      `Comparison range: ${COMPARISON_OPTIONS.join(", ")}`,
      "previous_period",
    )
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet analytics overview
  shopfleet analytics overview --during last_week --compare-to previous_period
  shopfleet analytics overview --since 2026-03-01 --until 2026-03-14

Notes:
  Overview is designed for agents to get a fast store-level snapshot.
      `,
    )
    .action(async (options: AnalyticsOverviewOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const query = buildOverviewQuery(options);
      const result = await runShopifyQlForStore(storeAlias, query, "overview");
      printAnalyticsResult(result, options.format);
    });
}

async function runShopifyQlForStore(
  storeAlias: string | undefined,
  query: string,
  dataset: string,
): Promise<AnalyticsResult> {
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const data = await client.query<ShopifyQlResponse>({
    query: SHOPIFYQL_QUERY,
    variables: { query },
  });

  const payload = data.shopifyqlQuery;
  const result: AnalyticsResult = {
    columns: payload.tableData?.columns ?? [],
    meta: {
      dataset,
      rowCount: payload.tableData?.rows.length ?? 0,
      store: store.alias,
    },
    parseErrors: payload.parseErrors,
    query,
    rows: payload.tableData?.rows ?? [],
  };

  return result;
}

function printAnalyticsResult(
  result: AnalyticsResult,
  format: OutputFormat,
): void {
  if (format === "json") {
    printJson(result);
    return;
  }

  if (result.rows.length === 0) {
    if (result.parseErrors.length > 0) {
      printJson(result);
      return;
    }

    process.stdout.write("No results.\n");
    return;
  }

  printOutput(
    "table",
    result.rows,
    result.columns.map((column) => column.name),
  );

  if (result.parseErrors.length > 0) {
    process.stdout.write(`\nParse errors:\n${result.parseErrors.join("\n")}\n`);
  }
}

export function buildSalesQuery(options: AnalyticsSalesOptions): string {
  const rangeClause = buildTimeRangeClause(options);
  const comparisonClause = buildComparisonClause(options.compareTo);
  const timeseries = parseTimeseries(options.timeseries);

  const clauses = [
    "FROM sales",
    "SHOW total_sales, orders, average_order_value, net_items_sold",
    timeseries ? `TIMESERIES ${timeseries}` : null,
    rangeClause,
    comparisonClause,
  ].filter((value): value is string => Boolean(value));

  return clauses.join(" ");
}

export function buildProductsQuery(options: AnalyticsProductsOptions): string {
  const rangeClause = buildTimeRangeClause(options);
  const comparisonClause = buildComparisonClause(options.compareTo);
  const limit = parsePositiveLimit(options.limit);
  const groupBy = parseProductGroupBy(options.groupBy);
  const orderBy = parseProductOrderBy(options.orderBy);

  const clauses = [
    "FROM sales",
    `SHOW ${groupBy.join(", ")}, total_sales, net_items_sold`,
    `GROUP BY ${groupBy.join(", ")}`,
    rangeClause,
    comparisonClause,
    `ORDER BY ${orderBy} DESC`,
    `LIMIT ${limit}`,
  ].filter((value): value is string => Boolean(value));

  return clauses.join(" ");
}

export function buildOverviewQuery(options: AnalyticsOverviewOptions): string {
  const rangeClause = buildTimeRangeClause(options);
  const comparisonClause = buildComparisonClause(options.compareTo);

  const clauses = [
    "FROM sales",
    "SHOW total_sales, orders, average_order_value, net_items_sold",
    rangeClause,
    comparisonClause,
  ].filter((value): value is string => Boolean(value));

  return clauses.join(" ");
}

export function buildTimeRangeClause(options: {
  during?: string;
  since?: string;
  until?: string;
}): string {
  const during = options.during?.trim();
  const since = options.since?.trim();
  const until = options.until?.trim();

  if (during && (since || until)) {
    throw new Error("Use either --during or --since/--until, not both.");
  }

  if (during) {
    return `DURING ${during}`;
  }

  if (!since && !until) {
    return "DURING last_month";
  }

  if (!since) {
    throw new Error("--until requires --since.");
  }

  return until ? `SINCE ${since} UNTIL ${until}` : `SINCE ${since}`;
}

export function buildComparisonClause(
  input: string | undefined,
): string | null {
  if (!input) {
    return null;
  }

  const value = parseComparisonOption(input);
  return `COMPARE TO ${value}`;
}

export function parseComparisonOption(input: string): ComparisonOption {
  const normalized = input.trim().toLowerCase();

  if (!COMPARISON_OPTIONS.includes(normalized as ComparisonOption)) {
    throw new Error(
      `Invalid --compare-to value "${input}". Valid values: ${COMPARISON_OPTIONS.join(", ")}.`,
    );
  }

  return normalized as ComparisonOption;
}

export function parseTimeseries(input: string | undefined): TimeseriesOption | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();

  if (!TIMESERIES_OPTIONS.includes(normalized as TimeseriesOption)) {
    throw new Error(
      `Invalid --timeseries value "${input}". Valid values: ${TIMESERIES_OPTIONS.join(", ")}.`,
    );
  }

  return normalized as TimeseriesOption;
}

export function parseProductGroupBy(
  input: string | undefined,
): ProductGroupByOption[] {
  const raw = (input ?? "product_title,product_vendor")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (raw.length === 0) {
    throw new Error("--group-by must include at least one field.");
  }

  const unique = [...new Set(raw)];

  for (const field of unique) {
    if (!PRODUCT_GROUP_BY_OPTIONS.includes(field as ProductGroupByOption)) {
      throw new Error(
        `Invalid --group-by field "${field}". Valid fields: ${PRODUCT_GROUP_BY_OPTIONS.join(", ")}.`,
      );
    }
  }

  return unique as ProductGroupByOption[];
}

export function parseProductOrderBy(
  input: string | undefined,
): ProductOrderByOption {
  const normalized = (input ?? "total_sales").trim().toLowerCase();

  if (!PRODUCT_ORDER_BY_OPTIONS.includes(normalized as ProductOrderByOption)) {
    throw new Error(
      `Invalid --order-by value "${input}". Valid values: ${PRODUCT_ORDER_BY_OPTIONS.join(", ")}.`,
    );
  }

  return normalized as ProductOrderByOption;
}

export function parsePositiveLimit(input: string): number {
  const limit = Number(input);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  return limit;
}
