import { describe, expect, it } from "vitest";

import {
  normalizeLineItemId,
  parseRefundLineItems,
  parseShippingAmount,
  summarizeFinancialOrders,
} from "./financial.js";

describe("normalizeLineItemId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeLineItemId("gid://shopify/LineItem/123")).toBe(
      "gid://shopify/LineItem/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeLineItemId("123")).toBe("gid://shopify/LineItem/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeLineItemId("line-item-123")).toThrow(
      "Expected a line item GID or numeric line item ID.",
    );
  });
});

describe("parseRefundLineItems", () => {
  it("parses comma-separated line item quantities", () => {
    expect(parseRefundLineItems("123:1,gid://shopify/LineItem/456:2")).toEqual([
      {
        lineItemId: "gid://shopify/LineItem/123",
        quantity: 1,
      },
      {
        lineItemId: "gid://shopify/LineItem/456",
        quantity: 2,
      },
    ]);
  });

  it("rejects duplicate line items", () => {
    expect(() => parseRefundLineItems("123:1,gid://shopify/LineItem/123:2")).toThrow(
      "Duplicate line item in --line-items: gid://shopify/LineItem/123",
    );
  });

  it("rejects invalid quantity formats", () => {
    expect(() => parseRefundLineItems("123:one")).toThrow(
      'Invalid refund quantity "one" for line item 123. Expected a positive integer.',
    );
  });
});

describe("parseShippingAmount", () => {
  it("returns null when the option is omitted", () => {
    expect(parseShippingAmount(undefined)).toBeNull();
  });

  it("accepts positive decimal amounts", () => {
    expect(parseShippingAmount("6.99")).toBe("6.99");
  });

  it("rejects zero amounts", () => {
    expect(() => parseShippingAmount("0")).toThrow(
      "--shipping-amount must be greater than 0.",
    );
  });
});

describe("summarizeFinancialOrders", () => {
  it("aggregates financial totals and status counts", () => {
    expect(
      summarizeFinancialOrders(
        [
          {
            cancelledAt: null,
            currentTotalPriceSet: {
              shopMoney: {
                amount: "10.50",
                currencyCode: "EUR",
              },
            },
            displayFinancialStatus: "PAID",
            id: "gid://shopify/Order/1",
            name: "#1001",
            processedAt: "2026-03-14T10:00:00Z",
            totalOutstandingSet: {
              shopMoney: {
                amount: "0.00",
                currencyCode: "EUR",
              },
            },
            totalPriceSet: {
              shopMoney: {
                amount: "12.00",
                currencyCode: "EUR",
              },
            },
            totalRefundedSet: {
              shopMoney: {
                amount: "1.50",
                currencyCode: "EUR",
              },
            },
          },
          {
            cancelledAt: "2026-03-14T12:00:00Z",
            currentTotalPriceSet: {
              shopMoney: {
                amount: "5.00",
                currencyCode: "EUR",
              },
            },
            displayFinancialStatus: "REFUNDED",
            id: "gid://shopify/Order/2",
            name: "#1002",
            processedAt: "2026-03-14T11:00:00Z",
            totalOutstandingSet: {
              shopMoney: {
                amount: "2.25",
                currencyCode: "EUR",
              },
            },
            totalPriceSet: {
              shopMoney: {
                amount: "8.75",
                currencyCode: "EUR",
              },
            },
            totalRefundedSet: {
              shopMoney: {
                amount: "3.75",
                currencyCode: "EUR",
              },
            },
          },
        ],
        "financial_status:paid",
        true,
      ),
    ).toEqual({
      cancelledOrders: 1,
      currentSales: "15.5 EUR",
      financialStatusBreakdown: {
        PAID: 1,
        REFUNDED: 1,
      },
      grossSales: "20.75 EUR",
      hasMore: true,
      orderCount: 2,
      outstanding: "2.25 EUR",
      query: "financial_status:paid",
      refunded: "5.25 EUR",
    });
  });
});
