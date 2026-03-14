import { describe, expect, it } from "vitest";

import {
  buildComparisonClause,
  buildOverviewQuery,
  buildProductsQuery,
  buildSalesQuery,
  buildTimeRangeClause,
  parseComparisonOption,
  parsePositiveLimit,
  parseProductGroupBy,
  parseProductOrderBy,
  parseTimeseries,
} from "./analytics.js";

describe("buildTimeRangeClause", () => {
  it("defaults to last_month", () => {
    expect(buildTimeRangeClause({})).toBe("DURING last_month");
  });

  it("builds a DURING clause", () => {
    expect(buildTimeRangeClause({ during: "last_week" })).toBe("DURING last_week");
  });

  it("builds SINCE and UNTIL clauses", () => {
    expect(
      buildTimeRangeClause({ since: "2026-03-01", until: "2026-03-14" }),
    ).toBe("SINCE 2026-03-01 UNTIL 2026-03-14");
  });

  it("rejects mixing DURING with SINCE/UNTIL", () => {
    expect(() =>
      buildTimeRangeClause({ during: "last_week", since: "-7d" }),
    ).toThrow("Use either --during or --since/--until, not both.");
  });
});

describe("parseComparisonOption", () => {
  it("accepts supported comparison options", () => {
    expect(parseComparisonOption("previous_period")).toBe("previous_period");
  });

  it("rejects invalid comparison options", () => {
    expect(() => parseComparisonOption("yoy")).toThrow(
      'Invalid --compare-to value "yoy". Valid values: previous_period, previous_year, previous_month, this_month, last_month, previous_year_match_day_of_week.',
    );
  });
});

describe("parseTimeseries", () => {
  it("accepts supported timeseries options", () => {
    expect(parseTimeseries("day")).toBe("day");
  });

  it("rejects invalid timeseries options", () => {
    expect(() => parseTimeseries("quarter")).toThrow(
      'Invalid --timeseries value "quarter". Valid values: day, week, month.',
    );
  });
});

describe("parseProductGroupBy", () => {
  it("parses comma-separated product grouping fields", () => {
    expect(parseProductGroupBy("product_title,product_vendor")).toEqual([
      "product_title",
      "product_vendor",
    ]);
  });

  it("rejects unsupported grouping fields", () => {
    expect(() => parseProductGroupBy("sku")).toThrow(
      'Invalid --group-by field "sku". Valid fields: product_title, product_vendor, product_type, product_id, product_variant_title, product_variant_sku, product_variant_id, product_variant_vendor, product_variant_product_title, product_variant_product_type.',
    );
  });
});

describe("parseProductOrderBy", () => {
  it("parses a supported order-by metric", () => {
    expect(parseProductOrderBy("net_items_sold")).toBe("net_items_sold");
  });

  it("rejects unsupported order-by metrics", () => {
    expect(() => parseProductOrderBy("orders")).toThrow(
      'Invalid --order-by value "orders". Valid values: total_sales, net_items_sold.',
    );
  });
});

describe("parsePositiveLimit", () => {
  it("accepts positive integer limits", () => {
    expect(parsePositiveLimit("10")).toBe(10);
  });

  it("rejects invalid limits", () => {
    expect(() => parsePositiveLimit("0")).toThrow(
      "--limit must be an integer between 1 and 250.",
    );
  });
});

describe("buildComparisonClause", () => {
  it("returns null when comparison is omitted", () => {
    expect(buildComparisonClause(undefined)).toBeNull();
  });

  it("builds a comparison clause", () => {
    expect(buildComparisonClause("previous_period")).toBe(
      "COMPARE TO previous_period",
    );
  });
});

describe("buildSalesQuery", () => {
  it("builds a timeseries sales query", () => {
    expect(
      buildSalesQuery({
        compareTo: "previous_period",
        during: "last_week",
        format: "json",
        timeseries: "day",
      }),
    ).toBe(
      "FROM sales SHOW total_sales, orders, average_order_value, net_items_sold TIMESERIES day DURING last_week COMPARE TO previous_period",
    );
  });
});

describe("buildProductsQuery", () => {
  it("builds a grouped product analytics query", () => {
    expect(
      buildProductsQuery({
        during: "last_month",
        format: "json",
        groupBy: "product_title,product_vendor",
        limit: "5",
        orderBy: "total_sales",
      }),
    ).toBe(
      "FROM sales SHOW product_title, product_vendor, total_sales, net_items_sold GROUP BY product_title, product_vendor DURING last_month ORDER BY total_sales DESC LIMIT 5",
    );
  });
});

describe("buildOverviewQuery", () => {
  it("builds an overview query with a comparison", () => {
    expect(
      buildOverviewQuery({
        compareTo: "previous_period",
        during: "last_month",
        format: "json",
      }),
    ).toBe(
      "FROM sales SHOW total_sales, orders, average_order_value, net_items_sold DURING last_month COMPARE TO previous_period",
    );
  });
});
