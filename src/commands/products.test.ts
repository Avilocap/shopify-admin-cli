import { describe, expect, it } from "vitest";

import {
  buildProductSearchQuery,
  normalizeProductId,
  parseProductSortKey,
} from "./products.js";

describe("normalizeProductId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeProductId("gid://shopify/Product/123")).toBe(
      "gid://shopify/Product/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeProductId("123")).toBe("gid://shopify/Product/123");
  });

  it("rejects non ids without --handle", () => {
    expect(() => normalizeProductId("my-handle")).toThrow(
      "Expected a product GID or numeric product ID. Use --handle to fetch by handle.",
    );
  });
});

describe("buildProductSearchQuery", () => {
  it("combines free text and structured filters", () => {
    expect(
      buildProductSearchQuery({
        rawQuery: "corona",
        status: "active",
        type: "Semana Santa",
        vendor: "Pichardo",
      }),
    ).toBe('corona vendor:Pichardo product_type:"Semana Santa" status:active');
  });

  it("returns null when no filters are set", () => {
    expect(buildProductSearchQuery({})).toBeNull();
  });
});

describe("parseProductSortKey", () => {
  it("defaults to relevance when there is a query", () => {
    expect(parseProductSortKey(undefined, "corona")).toBe("RELEVANCE");
  });

  it("defaults to title when there is no query", () => {
    expect(parseProductSortKey(undefined, null)).toBe("TITLE");
  });

  it("rejects relevance without a query", () => {
    expect(() => parseProductSortKey("relevance", null)).toThrow(
      "--sort relevance requires a search query.",
    );
  });
});
