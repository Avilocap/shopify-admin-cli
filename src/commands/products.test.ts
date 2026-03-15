import { describe, expect, it } from "vitest";

import {
  buildInventoryItemUpdateInput,
  buildProductCreateInput,
  buildProductUpdateInput,
  buildProductVariantUpdateInput,
  buildProductSearchQuery,
  extractProductImages,
  normalizeProductCategoryId,
  normalizeProductCategorySearchId,
  normalizeProductId,
  normalizeProductVariantId,
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

describe("normalizeProductVariantId", () => {
  it("accepts a GraphQL gid as-is", () => {
    expect(normalizeProductVariantId("gid://shopify/ProductVariant/123")).toBe(
      "gid://shopify/ProductVariant/123",
    );
  });

  it("converts numeric ids into GraphQL gids", () => {
    expect(normalizeProductVariantId("123")).toBe(
      "gid://shopify/ProductVariant/123",
    );
  });

  it("rejects unsupported values", () => {
    expect(() => normalizeProductVariantId("mini-001")).toThrow(
      "Expected a product variant GID or numeric variant ID.",
    );
  });
});

describe("buildProductSearchQuery", () => {
  it("combines free text and structured filters", () => {
    expect(
      buildProductSearchQuery({
        category: "sg-4-17-2-17",
        rawQuery: "corona",
        status: "active",
        type: "Semana Santa",
        vendor: "Pichardo",
      }),
    ).toBe(
      'corona category_id:sg-4-17-2-17 vendor:Pichardo product_type:"Semana Santa" status:active',
    );
  });

  it("returns null when no filters are set", () => {
    expect(buildProductSearchQuery({})).toBeNull();
  });
});

describe("normalizeProductCategoryId", () => {
  it("accepts a taxonomy category gid as-is", () => {
    expect(normalizeProductCategoryId("gid://shopify/TaxonomyCategory/sg-4-17-2-17")).toBe(
      "gid://shopify/TaxonomyCategory/sg-4-17-2-17",
    );
  });

  it("converts a raw taxonomy category id into a gid", () => {
    expect(normalizeProductCategoryId("sg-4-17-2-17")).toBe(
      "gid://shopify/TaxonomyCategory/sg-4-17-2-17",
    );
  });

  it("rejects other shopify gids", () => {
    expect(() =>
      normalizeProductCategoryId("gid://shopify/ProductTaxonomyNode/123"),
    ).toThrow(
      "Expected a taxonomy category GID in the gid://shopify/TaxonomyCategory/<id> format.",
    );
  });
});

describe("normalizeProductCategorySearchId", () => {
  it("returns the raw category id for search filters", () => {
    expect(
      normalizeProductCategorySearchId("gid://shopify/TaxonomyCategory/sg-4-17-2-17"),
    ).toBe("sg-4-17-2-17");
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
        category: "sg-4-17-2-17",
        description: "<p>Hola</p>",
        format: "json",
        handle: "test-product",
        seoDescription: "Short search snippet",
        seoTitle: "Buy Test product online",
        status: "draft",
        tags: "test,cli",
        title: "Test product",
        type: "Accesorio",
        vendor: "Pichardo",
      }),
    ).toEqual({
      category: "gid://shopify/TaxonomyCategory/sg-4-17-2-17",
      descriptionHtml: "<p>Hola</p>",
      handle: "test-product",
      productType: "Accesorio",
      seo: {
        description: "Short search snippet",
        title: "Buy Test product online",
      },
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
        category: "sg-4-17-2-17",
        deleteConflictingMetafields: true,
        format: "json",
        newHandle: "nuevo-handle",
        seoTitle: "Nuevo SEO title",
        title: "Nuevo titulo",
      }),
    ).toEqual({
      category: "gid://shopify/TaxonomyCategory/sg-4-17-2-17",
      deleteConflictingConstrainedMetafields: true,
      handle: "nuevo-handle",
      id: "gid://shopify/Product/1",
      seo: {
        title: "Nuevo SEO title",
      },
      title: "Nuevo titulo",
    });
  });

  it("supports clearing the current category", () => {
    expect(
      buildProductUpdateInput("gid://shopify/Product/1", {
        clearCategory: true,
        format: "json",
      }),
    ).toEqual({
      category: null,
      id: "gid://shopify/Product/1",
    });
  });

  it("rejects category updates that are internally inconsistent", () => {
    expect(() =>
      buildProductUpdateInput("gid://shopify/Product/1", {
        category: "sg-4-17-2-17",
        clearCategory: true,
        format: "json",
      }),
    ).toThrow("Use either --category or --clear-category, but not both.");
  });

  it("rejects deleteConflictingMetafields without a category change", () => {
    expect(() =>
      buildProductUpdateInput("gid://shopify/Product/1", {
        deleteConflictingMetafields: true,
        format: "json",
        title: "Nuevo titulo",
      }),
    ).toThrow(
      "--delete-conflicting-metafields can only be used when changing or clearing the product category.",
    );
  });
});

describe("buildProductVariantUpdateInput", () => {
  it("maps CLI options into Shopify product variant input", () => {
    expect(
      buildProductVariantUpdateInput("gid://shopify/ProductVariant/1", {
        barcode: "8437000000012",
        compareAtPrice: "49.95",
        format: "json",
        inventoryPolicy: "continue",
        metafield: ["custom.material:single_line_text_field:resin"],
        price: "39.95",
        showUnitPrice: "true",
        taxCode: "P0000000",
        taxable: "false",
      }),
    ).toEqual({
      barcode: "8437000000012",
      compareAtPrice: "49.95",
      id: "gid://shopify/ProductVariant/1",
      inventoryPolicy: "CONTINUE",
      metafields: [
        {
          key: "material",
          namespace: "custom",
          type: "single_line_text_field",
          value: "resin",
        },
      ],
      price: "39.95",
      showUnitPrice: true,
      taxCode: "P0000000",
      taxable: false,
    });
  });

  it("supports clearing nullable fields", () => {
    expect(
      buildProductVariantUpdateInput("gid://shopify/ProductVariant/1", {
        clearBarcode: true,
        clearCompareAtPrice: true,
        clearTaxCode: true,
        format: "json",
      }),
    ).toEqual({
      barcode: null,
      compareAtPrice: null,
      id: "gid://shopify/ProductVariant/1",
      taxCode: null,
    });
  });

  it("rejects conflicting clear flags", () => {
    expect(() =>
      buildProductVariantUpdateInput("gid://shopify/ProductVariant/1", {
        compareAtPrice: "49.95",
        clearCompareAtPrice: true,
        format: "json",
      }),
    ).toThrow(
      "Use either --compare-at-price or --clear-compare-at-price, but not both.",
    );
  });

  it("accepts zero for price-like decimal fields", () => {
    expect(
      buildProductVariantUpdateInput("gid://shopify/ProductVariant/1", {
        format: "json",
        price: "0",
      }),
    ).toEqual({
      id: "gid://shopify/ProductVariant/1",
      price: "0",
    });
  });
});

describe("buildInventoryItemUpdateInput", () => {
  it("maps CLI options into Shopify inventory item input", () => {
    expect(
      buildInventoryItemUpdateInput({
        cost: "12.50",
        countryCodeOfOrigin: " es ",
        format: "json",
        harmonizedSystemCode: "950300",
        provinceCodeOfOrigin: " se ",
        requiresShipping: "false",
        sku: " MINI-001 ",
        tracked: "true",
      }),
    ).toEqual({
      cost: "12.50",
      countryCodeOfOrigin: "es",
      harmonizedSystemCode: "950300",
      provinceCodeOfOrigin: "se",
      requiresShipping: false,
      sku: "MINI-001",
      tracked: true,
    });
  });

  it("requires at least one field", () => {
    expect(() =>
      buildInventoryItemUpdateInput({
        format: "json",
      }),
    ).toThrow(
      "Nothing to update. Pass at least one variant or inventory item field to modify.",
    );
  });

  it("accepts zero cost", () => {
    expect(
      buildInventoryItemUpdateInput({
        cost: "0",
        format: "json",
      }),
    ).toEqual({
      cost: "0",
    });
  });
});

describe("extractProductImages", () => {
  it("keeps only image media and falls back to media alt text", () => {
    expect(
      extractProductImages({
        category: null,
        handle: "my-product",
        id: "gid://shopify/Product/1",
        media: {
          nodes: [
            {
              alt: "Primary image",
              id: "gid://shopify/MediaImage/1",
              image: {
                altText: null,
                height: 1200,
                url: "https://cdn.example.com/image-1.jpg",
                width: 1200,
              },
              mediaContentType: "IMAGE",
            },
            {
              alt: "Video preview",
              id: "gid://shopify/Video/2",
              image: null,
              mediaContentType: "VIDEO",
            },
          ],
        },
        productType: "Accesorio",
        seo: null,
        status: "ACTIVE",
        tags: [],
        title: "My product",
        totalInventory: 5,
        variants: {
          nodes: [],
        },
        vendor: "Pichardo",
      }),
    ).toEqual([
      {
        altText: "Primary image",
        height: 1200,
        id: "gid://shopify/MediaImage/1",
        url: "https://cdn.example.com/image-1.jpg",
        width: 1200,
      },
    ]);
  });
});
