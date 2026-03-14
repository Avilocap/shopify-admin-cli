import { describe, expect, it } from "vitest";

import {
  buildArticleCreateInput,
  buildPageCreateInput,
  normalizeBlogId,
  parseBlogSortKey,
  parsePageSortKey,
  parseTags,
} from "./content.js";

describe("parsePageSortKey", () => {
  it("defaults to title", () => {
    expect(parsePageSortKey(undefined)).toBe("TITLE");
  });

  it("normalizes valid sort keys", () => {
    expect(parsePageSortKey("updated-at")).toBe("UPDATED_AT");
  });

  it("rejects invalid values", () => {
    expect(() => parsePageSortKey("relevance")).toThrow(
      'Invalid --sort value "relevance". Valid values: id, published-at, title, updated-at.',
    );
  });
});

describe("parseBlogSortKey", () => {
  it("defaults to title", () => {
    expect(parseBlogSortKey(undefined)).toBe("TITLE");
  });

  it("normalizes valid sort keys", () => {
    expect(parseBlogSortKey("handle")).toBe("HANDLE");
  });

  it("rejects invalid values", () => {
    expect(() => parseBlogSortKey("updated-at")).toThrow(
      'Invalid --sort value "updated-at". Valid values: handle, id, title.',
    );
  });
});

describe("normalizeBlogId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeBlogId("gid://shopify/Blog/123")).toBe("gid://shopify/Blog/123");
  });

  it("accepts the legacy online store blog gid as-is", () => {
    expect(normalizeBlogId("gid://shopify/OnlineStoreBlog/123")).toBe(
      "gid://shopify/OnlineStoreBlog/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeBlogId("123")).toBe("gid://shopify/Blog/123");
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeBlogId("company-news")).toThrow(
      "Expected a blog GID or numeric blog ID.",
    );
  });
});

describe("parseTags", () => {
  it("splits and trims comma-separated tags", () => {
    expect(parseTags(" news, launch , spring ")).toEqual([
      "news",
      "launch",
      "spring",
    ]);
  });
});

describe("buildPageCreateInput", () => {
  it("maps CLI options into Shopify page input", () => {
    expect(
      buildPageCreateInput({
        body: "<p>About us</p>",
        format: "json",
        handle: "about-us",
        template: "landing",
        title: "About us",
      }),
    ).toEqual({
      body: "<p>About us</p>",
      handle: "about-us",
      templateSuffix: "landing",
      title: "About us",
    });
  });

  it("rejects hidden pages with a publish date", () => {
    expect(() =>
      buildPageCreateInput({
        format: "json",
        hidden: true,
        publishDate: "2026-03-14T10:00:00Z",
        title: "Coming soon",
      }),
    ).toThrow("Do not combine --hidden with --publish-date.");
  });
});

describe("buildArticleCreateInput", () => {
  it("maps CLI options into Shopify article input", () => {
    expect(
      buildArticleCreateInput({
        authorName: "Store Team",
        blogId: "123",
        body: "<p>Hello</p>",
        format: "json",
        handle: "spring-release",
        summary: "<p>Summary</p>",
        tags: "launch,news",
        template: "feature",
        title: "Spring release",
      }),
    ).toEqual({
      author: { name: "Store Team" },
      blogId: "gid://shopify/Blog/123",
      body: "<p>Hello</p>",
      handle: "spring-release",
      summary: "<p>Summary</p>",
      tags: ["launch", "news"],
      templateSuffix: "feature",
      title: "Spring release",
    });
  });

  it("rejects hidden articles with a publish date", () => {
    expect(() =>
      buildArticleCreateInput({
        authorName: "Store Team",
        blogId: "123",
        format: "json",
        hidden: true,
        publishDate: "2026-03-14T10:00:00Z",
        title: "Coming soon",
      }),
    ).toThrow("Do not combine --hidden with --publish-date.");
  });
});
