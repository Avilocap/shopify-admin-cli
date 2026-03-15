import { describe, expect, it } from "vitest";

import {
  buildMetafieldsDeleteInput,
  buildMetafieldsSetInput,
  normalizeMetafieldOwnerId,
  parseMetafieldIdentifier,
  parseMetafieldSetEntry,
} from "./metafields.js";

describe("normalizeMetafieldOwnerId", () => {
  it("accepts Shopify gids as-is", () => {
    expect(normalizeMetafieldOwnerId("gid://shopify/Product/123")).toBe(
      "gid://shopify/Product/123",
    );
  });

  it("rejects non gids", () => {
    expect(() => normalizeMetafieldOwnerId("123")).toThrow(
      "Expected an owner GID in the gid://shopify/<Resource>/<id> format.",
    );
  });
});

describe("parseMetafieldIdentifier", () => {
  it("parses namespace.key values", () => {
    expect(parseMetafieldIdentifier("custom.material")).toEqual({
      key: "material",
      namespace: "custom",
    });
  });

  it("supports app-reserved namespaces", () => {
    expect(parseMetafieldIdentifier("$app:shopfleet.feature_tier")).toEqual({
      key: "feature_tier",
      namespace: "$app:shopfleet",
    });
  });

  it("rejects invalid identifiers", () => {
    expect(() => parseMetafieldIdentifier("custom")).toThrow(
      'Invalid metafield identifier "custom". Expected namespace.key.',
    );
  });
});

describe("parseMetafieldSetEntry", () => {
  it("parses namespace.key:type:value entries", () => {
    expect(
      parseMetafieldSetEntry("custom.material:single_line_text_field:resin"),
    ).toEqual({
      key: "material",
      namespace: "custom",
      type: "single_line_text_field",
      value: "resin",
    });
  });

  it("keeps colons in the value", () => {
    expect(
      parseMetafieldSetEntry(
        "custom.payload:json:{\"title\":\"Semana Santa: 2026\"}",
      ),
    ).toEqual({
      key: "payload",
      namespace: "custom",
      type: "json",
      value: "{\"title\":\"Semana Santa: 2026\"}",
    });
  });
});

describe("buildMetafieldsSetInput", () => {
  it("adds the owner id to each entry", () => {
    expect(
      buildMetafieldsSetInput("gid://shopify/Product/1", [
        "custom.material:single_line_text_field:resin",
      ]),
    ).toEqual([
      {
        key: "material",
        namespace: "custom",
        ownerId: "gid://shopify/Product/1",
        type: "single_line_text_field",
        value: "resin",
      },
    ]);
  });

  it("rejects empty batches", () => {
    expect(() => buildMetafieldsSetInput("gid://shopify/Product/1", [])).toThrow(
      "Nothing to set. Pass at least one --entry.",
    );
  });
});

describe("buildMetafieldsDeleteInput", () => {
  it("maps namespace.key identifiers into delete inputs", () => {
    expect(
      buildMetafieldsDeleteInput("gid://shopify/Product/1", ["custom.material"]),
    ).toEqual([
      {
        key: "material",
        namespace: "custom",
        ownerId: "gid://shopify/Product/1",
      },
    ]);
  });

  it("rejects empty batches", () => {
    expect(
      () => buildMetafieldsDeleteInput("gid://shopify/Product/1", []),
    ).toThrow("Nothing to delete. Pass at least one --identifier.");
  });
});
