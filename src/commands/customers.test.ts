import { describe, expect, it } from "vitest";

import {
  buildCustomerSearchQuery,
  normalizeCustomerId,
  parseCustomerOrderSortKey,
  parseCustomerSortKey,
} from "./customers.js";

describe("normalizeCustomerId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeCustomerId("gid://shopify/Customer/123")).toBe(
      "gid://shopify/Customer/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeCustomerId("123")).toBe("gid://shopify/Customer/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeCustomerId("customer@example.com")).toThrow(
      "Expected a customer GID or numeric customer ID.",
    );
  });
});

describe("buildCustomerSearchQuery", () => {
  it("builds a single-term OR search across supported fields", () => {
    expect(buildCustomerSearchQuery("maria")).toBe(
      "(email:maria OR phone:maria OR first_name:maria OR last_name:maria)",
    );
  });

  it("builds a combined first and last name clause for multi-word names", () => {
    expect(buildCustomerSearchQuery("Maria Pichardo")).toBe(
      '(email:"Maria Pichardo" OR phone:"Maria Pichardo" OR (first_name:Maria last_name:Pichardo))',
    );
  });
});

describe("parseCustomerSortKey", () => {
  it("defaults to relevance when there is a query", () => {
    expect(parseCustomerSortKey(undefined, "tag:VIP")).toBe("RELEVANCE");
  });

  it("defaults to name when there is no query", () => {
    expect(parseCustomerSortKey(undefined, null)).toBe("NAME");
  });

  it("rejects relevance without a query", () => {
    expect(() => parseCustomerSortKey("relevance", null)).toThrow(
      "--sort relevance requires a search query.",
    );
  });
});

describe("parseCustomerOrderSortKey", () => {
  it("defaults to processed_at", () => {
    expect(parseCustomerOrderSortKey(undefined)).toBe("PROCESSED_AT");
  });

  it("rejects relevance for nested customer orders", () => {
    expect(() => parseCustomerOrderSortKey("relevance")).toThrow(
      "--sort relevance is not supported for customer orders.",
    );
  });
});
