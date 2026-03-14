import { describe, expect, it } from "vitest";

import {
  buildCollectionSearchQuery,
  normalizeCollectionId,
  parseCollectionProductSortKey,
  parseCollectionSortKey,
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
