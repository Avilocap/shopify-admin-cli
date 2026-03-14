import { describe, expect, it } from "vitest";

import {
  buildOrderCancelRefundMethod,
  buildOrderSearchQuery,
  normalizeOrderId,
  parseOrderCancelReason,
  parseOrderSortKey,
  parseRefundMethod,
} from "./orders.js";

describe("normalizeOrderId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeOrderId("gid://shopify/Order/123")).toBe(
      "gid://shopify/Order/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeOrderId("123")).toBe("gid://shopify/Order/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeOrderId("#1001")).toThrow(
      "Expected an order GID or numeric order ID.",
    );
  });
});

describe("buildOrderSearchQuery", () => {
  it("combines raw query and structured filters", () => {
    expect(
      buildOrderSearchQuery({
        financialStatus: "paid",
        from: "2026-03-01",
        rawQuery: "tag:test",
        status: "open",
        to: "2026-03-14",
      }),
    ).toBe(
      "tag:test status:open financial_status:paid processed_at:>=2026-03-01 processed_at:<=2026-03-14",
    );
  });

  it("returns null when no filters are present", () => {
    expect(buildOrderSearchQuery({})).toBeNull();
  });
});

describe("parseOrderSortKey", () => {
  it("defaults to relevance when there is a query", () => {
    expect(parseOrderSortKey(undefined, "tag:test")).toBe("RELEVANCE");
  });

  it("defaults to processed_at without a query", () => {
    expect(parseOrderSortKey(undefined, null)).toBe("PROCESSED_AT");
  });

  it("rejects relevance without a query", () => {
    expect(() => parseOrderSortKey("relevance", null)).toThrow(
      "--sort relevance requires a search query.",
    );
  });
});

describe("parseOrderCancelReason", () => {
  it("normalizes valid reasons", () => {
    expect(parseOrderCancelReason("customer")).toBe("CUSTOMER");
  });

  it("rejects invalid reasons", () => {
    expect(() => parseOrderCancelReason("shipping")).toThrow(
      'Invalid --reason value "shipping". Valid values: customer, declined, fraud, inventory, staff, other.',
    );
  });
});

describe("parseRefundMethod", () => {
  it("accepts none and original", () => {
    expect(parseRefundMethod("none")).toBe("none");
    expect(parseRefundMethod("original")).toBe("original");
  });

  it("rejects unsupported refund methods", () => {
    expect(() => parseRefundMethod("store-credit")).toThrow(
      'Invalid --refund-method value "store-credit". Valid values: none, original.',
    );
  });
});

describe("buildOrderCancelRefundMethod", () => {
  it("returns null for no refund", () => {
    expect(buildOrderCancelRefundMethod("none")).toBeNull();
  });

  it("returns the original payment refund payload when requested", () => {
    expect(buildOrderCancelRefundMethod("original")).toEqual({
      originalPaymentMethodsRefund: true,
    });
  });
});
