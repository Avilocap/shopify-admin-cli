import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./config.js";

describe("normalizeDomain", () => {
  it("removes protocol, trailing slash and upper casing", () => {
    expect(normalizeDomain("HTTPS://My-Store.myshopify.com/")).toBe(
      "my-store.myshopify.com",
    );
  });
});
