import { describe, expect, it } from "vitest";

import {
  buildGiftCardCreateInput,
  normalizeGiftCardId,
  parseGiftCardCode,
  parseGiftCardExpiration,
  parseGiftCardValue,
} from "./gift-cards.js";

describe("normalizeGiftCardId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeGiftCardId("gid://shopify/GiftCard/123")).toBe(
      "gid://shopify/GiftCard/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeGiftCardId("123")).toBe("gid://shopify/GiftCard/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeGiftCardId("GC-123")).toThrow(
      "Expected a gift card GID or numeric gift card ID.",
    );
  });
});

describe("parseGiftCardValue", () => {
  it("accepts positive decimals", () => {
    expect(parseGiftCardValue("25.50")).toBe("25.50");
  });

  it("rejects empty or non-positive values", () => {
    expect(() => parseGiftCardValue("0")).toThrow(
      "--value must be a positive number.",
    );
  });
});

describe("parseGiftCardCode", () => {
  it("accepts valid alphanumeric codes", () => {
    expect(parseGiftCardCode("SPRING2026")).toBe("SPRING2026");
  });

  it("rejects unsupported code formats", () => {
    expect(() => parseGiftCardCode("SPRING-2026")).toThrow(
      "--code must be 8-20 characters long and contain only letters and numbers.",
    );
  });
});

describe("parseGiftCardExpiration", () => {
  it("accepts valid calendar dates", () => {
    expect(parseGiftCardExpiration("2026-12-31")).toBe("2026-12-31");
  });

  it("rejects invalid date formats", () => {
    expect(() => parseGiftCardExpiration("31-12-2026")).toThrow(
      "--expires must use the YYYY-MM-DD format.",
    );
  });
});

describe("buildGiftCardCreateInput", () => {
  it("maps CLI options into Shopify gift card input", () => {
    expect(
      buildGiftCardCreateInput(
        {
          code: "SPRING2026",
          expires: "2026-12-31",
          format: "json",
          note: "Refund for Order #1001",
          notify: true,
          recipientEmail: "maria@example.com",
          recipientMessage: "Happy birthday",
          value: "100",
        },
        "gid://shopify/Customer/1",
      ),
    ).toEqual({
      code: "SPRING2026",
      customerId: "gid://shopify/Customer/1",
      expiresOn: "2026-12-31",
      initialValue: "100",
      note: "Refund for Order #1001",
      notify: true,
      recipientAttributes: {
        id: "gid://shopify/Customer/1",
        message: "Happy birthday",
      },
    });
  });

  it("requires a recipient email when a message is provided", () => {
    expect(() =>
      buildGiftCardCreateInput({
        format: "json",
        recipientMessage: "Happy birthday",
        value: "25",
      }),
    ).toThrow("--recipient-message requires --recipient-email.");
  });
});
