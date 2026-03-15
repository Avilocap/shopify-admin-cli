import { describe, expect, it } from "vitest";

import {
  buildCollectionUpdateInput,
  buildCollectionSearchQuery,
  normalizeCollectionId,
  parseCollectionProductSortKey,
  parseCollectionSortKey,
  parseCollectionUpdateSortOrder,
} from "./collections.js";

describe("normalizeCollectionId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeCollectionId("gid://shopify/Collection/123")).toBe(
      "gid://shopify/Collection/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeCollectionId("123")).toBe("gid://shopify/Collection/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeCollectionId("miniaturas")).toThrow(
      "Expected a collection GID or numeric collection ID.",
    );
  });
});

describe("buildCollectionSearchQuery", () => {
  it("combines raw query and type filter", () => {
    expect(
      buildCollectionSearchQuery({
        rawQuery: "title:miniatura",
        type: "custom",
      }),
    ).toBe("title:miniatura collection_type:custom");
  });

  it("returns null when no filters are present", () => {
    expect(buildCollectionSearchQuery({})).toBeNull();
  });

  it("rejects invalid type filters", () => {
    expect(() => buildCollectionSearchQuery({ type: "manual" })).toThrow(
      "Invalid --type value. Valid values: custom, smart.",
    );
  });
});

describe("parseCollectionSortKey", () => {
  it("defaults to relevance when there is a query", () => {
    expect(parseCollectionSortKey(undefined, "title:miniatura")).toBe("RELEVANCE");
  });

  it("defaults to updated_at without a query", () => {
    expect(parseCollectionSortKey(undefined, null)).toBe("UPDATED_AT");
  });

  it("rejects relevance without a query", () => {
    expect(() => parseCollectionSortKey("relevance", null)).toThrow(
      "--sort relevance requires a search query.",
    );
  });
});

describe("parseCollectionProductSortKey", () => {
  it("defaults to title", () => {
    expect(parseCollectionProductSortKey(undefined)).toBe("TITLE");
  });

  it("normalizes valid sort keys", () => {
    expect(parseCollectionProductSortKey("best-selling")).toBe("BEST_SELLING");
  });

  it("rejects invalid sort keys", () => {
    expect(() => parseCollectionProductSortKey("updated-at")).toThrow(
      'Invalid --sort value "updated-at". Valid values: best-selling, collection-default, created, id, manual, price, relevance, title.',
    );
  });
});

describe("buildCollectionUpdateInput", () => {
  it("maps top-level collection fields into CollectionInput", () => {
    expect(
      buildCollectionUpdateInput("gid://shopify/Collection/1", {
        description: "<p>Destacados</p>",
        format: "json",
        handle: "semana-santa-2026",
        redirectNewHandle: true,
        seoDescription: "Coleccion destacada",
        seoTitle: "Semana Santa",
        sortOrder: "alpha-asc",
        templateSuffix: "seasonal",
        title: "Semana Santa 2026",
      }),
    ).toEqual({
      descriptionHtml: "<p>Destacados</p>",
      handle: "semana-santa-2026",
      id: "gid://shopify/Collection/1",
      redirectNewHandle: true,
      seo: {
        description: "Coleccion destacada",
        title: "Semana Santa",
      },
      sortOrder: "ALPHA_ASC",
      templateSuffix: "seasonal",
      title: "Semana Santa 2026",
    });
  });

  it("requires at least one field beyond id", () => {
    expect(() =>
      buildCollectionUpdateInput("gid://shopify/Collection/1", {
        format: "json",
      }),
    ).toThrow("Nothing to update. Pass at least one field to modify.");
  });

  it("requires handle when redirecting the old handle", () => {
    expect(() =>
      buildCollectionUpdateInput("gid://shopify/Collection/1", {
        format: "json",
        redirectNewHandle: true,
      }),
    ).toThrow("--redirect-new-handle requires --handle.");
  });
});

describe("parseCollectionUpdateSortOrder", () => {
  it("normalizes valid sort orders", () => {
    expect(parseCollectionUpdateSortOrder("price-desc")).toBe("PRICE_DESC");
  });

  it("rejects invalid sort orders", () => {
    expect(() => parseCollectionUpdateSortOrder("updated-at")).toThrow(
      'Invalid --sort-order value "updated-at". Valid values: alpha-asc, alpha-desc, best-selling, created, created-desc, manual, price-asc, price-desc.',
    );
  });
});
