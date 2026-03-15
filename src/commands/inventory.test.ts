import { describe, expect, it } from "vitest";

import {
  buildInventoryAdjustInput,
  buildInventoryItemSearchQuery,
  buildInventorySetInput,
  normalizeInventoryItemId,
  normalizeLocationId,
  parseInventoryAbsoluteQuantity,
  parseInventoryDelta,
  parseInventoryQuantityName,
} from "./inventory.js";

describe("normalizeInventoryItemId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeInventoryItemId("gid://shopify/InventoryItem/123")).toBe(
      "gid://shopify/InventoryItem/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeInventoryItemId("123")).toBe(
      "gid://shopify/InventoryItem/123",
    );
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeInventoryItemId("sku-123")).toThrow(
      "Expected an inventory item GID or numeric ID.",
    );
  });
});

describe("normalizeLocationId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeLocationId("gid://shopify/Location/123")).toBe(
      "gid://shopify/Location/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeLocationId("123")).toBe("gid://shopify/Location/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeLocationId("warehouse")).toThrow(
      "Expected a location GID or numeric ID.",
    );
  });
});

describe("buildInventoryItemSearchQuery", () => {
  it("combines raw query, inventory item id, and sku", () => {
    expect(
      buildInventoryItemSearchQuery({
        itemId: "gid://shopify/InventoryItem/30322695",
        rawQuery: "updated_at:>=2026-03-01",
        sku: "ABC 123",
      }),
    ).toBe('updated_at:>=2026-03-01 id:30322695 sku:"ABC 123"');
  });

  it("returns null when no filters are present", () => {
    expect(buildInventoryItemSearchQuery({})).toBeNull();
  });
});

describe("parseInventoryDelta", () => {
  it("accepts negative and positive integers", () => {
    expect(parseInventoryDelta("-4")).toBe(-4);
    expect(parseInventoryDelta("7")).toBe(7);
  });

  it("rejects zero and non-integers", () => {
    expect(() => parseInventoryDelta("0")).toThrow(
      "--quantity must be different from zero.",
    );
    expect(() => parseInventoryDelta("2.5")).toThrow(
      "--quantity must be a whole number. Use negative values to subtract.",
    );
  });
});

describe("parseInventoryQuantityName", () => {
  it("normalizes the quantity name", () => {
    expect(parseInventoryQuantityName(" Available ")).toBe("available");
  });
});

describe("parseInventoryAbsoluteQuantity", () => {
  it("accepts zero and positive integers", () => {
    expect(parseInventoryAbsoluteQuantity("0")).toBe(0);
    expect(parseInventoryAbsoluteQuantity("7")).toBe(7);
  });

  it("rejects negatives and non-integers", () => {
    expect(() => parseInventoryAbsoluteQuantity("-1")).toThrow(
      "--quantity must be zero or greater.",
    );
    expect(() => parseInventoryAbsoluteQuantity("2.5")).toThrow(
      "--quantity must be a whole number.",
    );
  });
});

describe("buildInventoryAdjustInput", () => {
  it("maps CLI options into Shopify inventory adjustment input", () => {
    expect(
      buildInventoryAdjustInput({
        format: "json",
        itemId: "30322695",
        locationId: "124656943",
        quantity: "-4",
        reason: "correction",
        reference: "gid://shopfleet/InventoryAdjustment/test-1",
      }),
    ).toEqual({
      changes: [
        {
          changeFromQuantity: null,
          delta: -4,
          inventoryItemId: "gid://shopify/InventoryItem/30322695",
          locationId: "gid://shopify/Location/124656943",
        },
      ],
      name: "available",
      reason: "correction",
      referenceDocumentUri: "gid://shopfleet/InventoryAdjustment/test-1",
    });
  });

  it("requires a ledger document URI for non-available quantities", () => {
    expect(() =>
      buildInventoryAdjustInput({
        format: "json",
        itemId: "30322695",
        locationId: "124656943",
        name: "committed",
        quantity: "4",
      }),
    ).toThrow(
      "Shopify requires --ledger-document-uri when --name is not available.",
    );
  });
});

describe("buildInventorySetInput", () => {
  it("maps CLI options into Shopify inventory set input", () => {
    expect(
      buildInventorySetInput({
        changeFrom: "10",
        format: "json",
        itemId: "30322695",
        locationId: "124656943",
        quantity: "12",
        reason: "correction",
        reference: "gid://shopfleet/InventorySet/test-1",
      }),
    ).toEqual({
      name: "available",
      quantities: [
        {
          changeFromQuantity: 10,
          inventoryItemId: "gid://shopify/InventoryItem/30322695",
          locationId: "gid://shopify/Location/124656943",
          quantity: 12,
        },
      ],
      reason: "correction",
      referenceDocumentUri: "gid://shopfleet/InventorySet/test-1",
    });
  });

  it("uses a null compare quantity when omitted", () => {
    expect(
      buildInventorySetInput({
        format: "json",
        itemId: "30322695",
        locationId: "124656943",
        quantity: "12",
      }),
    ).toEqual({
      name: "available",
      quantities: [
        {
          changeFromQuantity: null,
          inventoryItemId: "gid://shopify/InventoryItem/30322695",
          locationId: "gid://shopify/Location/124656943",
          quantity: 12,
        },
      ],
      reason: "correction",
      referenceDocumentUri: undefined,
    });
  });
});
