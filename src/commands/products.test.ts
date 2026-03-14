import { describe, expect, it } from "vitest";

import {
  buildProductCreateInput,
  buildProductUpdateInput,
  buildProductSearchQuery,
  normalizeProductId,
  parseProductStatus,
  parseProductSortKey,
  parseTags,
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

describe("parseProductStatus", () => {
  it("normalizes valid statuses", () => {
    expect(parseProductStatus("draft")).toBe("DRAFT");
  });

  it("rejects invalid statuses", () => {
    expect(() => parseProductStatus("published")).toThrow(
      'Invalid --status value "published". Valid values: active, archived, draft.',
    );
  });
});

describe("parseTags", () => {
  it("splits and trims comma-separated tags", () => {
    expect(parseTags(" test, cli , shopify ")).toEqual(["test", "cli", "shopify"]);
  });
});

describe("buildProductCreateInput", () => {
  it("maps CLI options into Shopify product input", () => {
    expect(
      buildProductCreateInput({
        description: "<p>Hola</p>",
        format: "json",
        handle: "test-product",
        status: "draft",
        tags: "test,cli",
        title: "Test product",
        type: "Accesorio",
        vendor: "Pichardo",
      }),
    ).toEqual({
      descriptionHtml: "<p>Hola</p>",
      handle: "test-product",
      productType: "Accesorio",
      status: "DRAFT",
      tags: ["test", "cli"],
      title: "Test product",
      vendor: "Pichardo",
    });
  });
});

describe("buildProductUpdateInput", () => {
  it("requires at least one field beyond id", () => {
    expect(() =>
      buildProductUpdateInput("gid://shopify/Product/1", {
        format: "json",
      }),
    ).toThrow("Nothing to update. Pass at least one field to modify.");
  });

  it("uses newHandle for handle updates", () => {
    expect(
      buildProductUpdateInput("gid://shopify/Product/1", {
        format: "json",
        newHandle: "nuevo-handle",
        title: "Nuevo titulo",
      }),
    ).toEqual({
      handle: "nuevo-handle",
      id: "gid://shopify/Product/1",
      title: "Nuevo titulo",
    });
  });
});
