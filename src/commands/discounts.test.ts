import { describe, expect, it } from "vitest";

import {
  buildDiscountCreateInput,
  buildDiscountSearchQuery,
  normalizeDiscountId,
  parseDiscountSortKey,
} from "./discounts.js";

describe("normalizeDiscountId", () => {
  it("accepts a generic discount node gid as-is", () => {
    expect(normalizeDiscountId("gid://shopify/DiscountNode/123")).toBe(
      "gid://shopify/DiscountNode/123",
    );
  });

  it("accepts a discount code node gid as-is", () => {
    expect(normalizeDiscountId("gid://shopify/DiscountCodeNode/123")).toBe(
      "gid://shopify/DiscountCodeNode/123",
    );
  });

  it("rejects numeric ids", () => {
    expect(() => normalizeDiscountId("123")).toThrow(
      "Expected a discount GID returned by discounts list or discounts create.",
    );
  });
});

describe("buildDiscountSearchQuery", () => {
  it("combines raw query and structured filters", () => {
    expect(
      buildDiscountSearchQuery({
        code: "SPRING10",
        method: "code",
        rawQuery: 'status:active title:"Spring"',
        type: "percentage",
      }),
    ).toBe('status:active title:"Spring" code:SPRING10 method:code type:percentage');
  });

  it("returns null when no filters are present", () => {
    expect(buildDiscountSearchQuery({})).toBeNull();
  });
});

describe("parseDiscountSortKey", () => {
  it("defaults to relevance when there is a query", () => {
    expect(parseDiscountSortKey(undefined, "status:active")).toBe("RELEVANCE");
  });

  it("defaults to title without a query", () => {
    expect(parseDiscountSortKey(undefined, null)).toBe("TITLE");
  });

  it("rejects relevance without a query", () => {
    expect(() => parseDiscountSortKey("relevance", null)).toThrow(
      "--sort relevance requires a search query.",
    );
  });
});

describe("buildDiscountCreateInput", () => {
  it("builds a percentage discount payload", () => {
    expect(
      buildDiscountCreateInput({
        code: "SPRING10",
        format: "json",
        percentage: "10",
        starts: "2026-03-14",
        title: "Spring 10",
      }),
    ).toEqual({
      appliesOncePerCustomer: false,
      code: "SPRING10",
      context: {
        all: "ALL",
      },
      customerGets: {
        items: {
          all: true,
        },
        value: {
          percentage: 0.1,
        },
      },
      startsAt: "2026-03-14T00:00:00.000Z",
      title: "Spring 10",
    });
  });

  it("builds a fixed amount discount payload", () => {
    expect(
      buildDiscountCreateInput({
        amount: "20",
        code: "VIP20",
        ends: "2026-03-31T23:59:59Z",
        format: "json",
        oncePerCustomer: true,
        starts: "2026-03-14T09:00:00Z",
        title: "VIP 20",
        usageLimit: "50",
      }),
    ).toEqual({
      appliesOncePerCustomer: true,
      code: "VIP20",
      context: {
        all: "ALL",
      },
      customerGets: {
        items: {
          all: true,
        },
        value: {
          discountAmount: {
            amount: "20.00",
            appliesOnEachItem: false,
          },
        },
      },
      endsAt: "2026-03-31T23:59:59.000Z",
      startsAt: "2026-03-14T09:00:00.000Z",
      title: "VIP 20",
      usageLimit: 50,
    });
  });

  it("requires exactly one discount value input", () => {
    expect(() =>
      buildDiscountCreateInput({
        code: "SPRING10",
        format: "json",
        percentage: "10",
        amount: "20",
        starts: "2026-03-14",
        title: "Spring 10",
      }),
    ).toThrow("Pass either --percentage or --amount, not both.");
  });

  it("rejects invalid date ranges", () => {
    expect(() =>
      buildDiscountCreateInput({
        code: "SPRING10",
        ends: "2026-03-14",
        format: "json",
        percentage: "10",
        starts: "2026-03-14",
        title: "Spring 10",
      }),
    ).toThrow("--ends must be later than --starts.");
  });
});
