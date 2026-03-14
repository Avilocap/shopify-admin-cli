import { describe, expect, it } from "vitest";

import {
  buildFulfillmentSearchQuery,
  buildTrackingInfoInput,
  normalizeFulfillmentId,
  normalizeFulfillmentOrderId,
  normalizeFulfillmentOrderLineItemId,
  parseFulfillmentLineItems,
  parseFulfillmentSortKey,
} from "./fulfillment.js";

describe("normalizeFulfillmentOrderId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeFulfillmentOrderId("gid://shopify/FulfillmentOrder/123")).toBe(
      "gid://shopify/FulfillmentOrder/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeFulfillmentOrderId("123")).toBe(
      "gid://shopify/FulfillmentOrder/123",
    );
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeFulfillmentOrderId("FO-123")).toThrow(
      "Expected a fulfillment order GID or numeric fulfillment order ID.",
    );
  });
});

describe("normalizeFulfillmentOrderLineItemId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(
      normalizeFulfillmentOrderLineItemId(
        "gid://shopify/FulfillmentOrderLineItem/123",
      ),
    ).toBe("gid://shopify/FulfillmentOrderLineItem/123");
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeFulfillmentOrderLineItemId("123")).toBe(
      "gid://shopify/FulfillmentOrderLineItem/123",
    );
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeFulfillmentOrderLineItemId("line-item-123")).toThrow(
      "Expected a fulfillment order line item GID or numeric fulfillment order line item ID.",
    );
  });
});

describe("normalizeFulfillmentId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeFulfillmentId("gid://shopify/Fulfillment/123")).toBe(
      "gid://shopify/Fulfillment/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeFulfillmentId("123")).toBe("gid://shopify/Fulfillment/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeFulfillmentId("fulfillment-123")).toThrow(
      "Expected a fulfillment GID or numeric fulfillment ID.",
    );
  });
});

describe("buildFulfillmentSearchQuery", () => {
  it("combines raw query and structured filters", () => {
    expect(
      buildFulfillmentSearchQuery({
        rawQuery: "request_status:unsubmitted",
        status: "open",
      }),
    ).toBe("request_status:unsubmitted status:open");
  });

  it("returns null when no filters are present", () => {
    expect(buildFulfillmentSearchQuery({})).toBeNull();
  });
});

describe("parseFulfillmentSortKey", () => {
  it("defaults to updated_at", () => {
    expect(parseFulfillmentSortKey(undefined)).toBe("UPDATED_AT");
  });

  it("normalizes valid sort keys", () => {
    expect(parseFulfillmentSortKey("fulfill-by")).toBe("FULFILL_BY");
  });

  it("rejects invalid sort keys", () => {
    expect(() => parseFulfillmentSortKey("relevance")).toThrow(
      'Invalid --sort value "relevance". Valid values: created-at, fulfill-by, id, updated-at.',
    );
  });
});

describe("parseFulfillmentLineItems", () => {
  it("parses fulfillment order line item ids with optional quantities", () => {
    expect(parseFulfillmentLineItems("123:2,456")).toEqual([
      {
        id: "gid://shopify/FulfillmentOrderLineItem/123",
        quantity: 2,
      },
      {
        id: "gid://shopify/FulfillmentOrderLineItem/456",
      },
    ]);
  });

  it("returns an empty list when the option is omitted", () => {
    expect(parseFulfillmentLineItems(undefined)).toEqual([]);
  });

  it("rejects invalid quantities", () => {
    expect(() => parseFulfillmentLineItems("123:0")).toThrow(
      'Invalid quantity in --line-items entry "123:0".',
    );
  });
});

describe("buildTrackingInfoInput", () => {
  it("returns null when all fields are empty", () => {
    expect(buildTrackingInfoInput({})).toBeNull();
  });

  it("builds the Shopify tracking input payload", () => {
    expect(
      buildTrackingInfoInput({
        carrier: "UPS",
        trackingNumber: "1Z9999999999999999",
        trackingUrl: "https://example.com/track/1",
      }),
    ).toEqual({
      company: "UPS",
      number: "1Z9999999999999999",
      url: "https://example.com/track/1",
    });
  });
});
