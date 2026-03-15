export const PRODUCTS_LIST_QUERY = `
  query ProductsList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: ProductSortKeys!,
    $reverse: Boolean!
  ) {
    products(
      first: $first,
      after: $after,
      query: $query,
      sortKey: $sortKey,
      reverse: $reverse
    ) {
      edges {
        cursor
        node {
          id
          handle
          title
          status
          vendor
          productType
          totalInventory
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const PRODUCT_GET_QUERY = `
  query ProductGet($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      category {
        id
        fullName
      }
      seo {
        title
        description
      }
      status
      vendor
      productType
      tags
      totalInventory
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
  }
`;

export const PRODUCT_GET_WITH_MEDIA_QUERY = `
  query ProductGetWithMedia($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      category {
        id
        fullName
      }
      descriptionHtml
      seo {
        title
        description
      }
      status
      vendor
      productType
      tags
      totalInventory
      media(first: 10) {
        nodes {
          id
          alt
          mediaContentType
          ... on MediaImage {
            image {
              altText
              url
              width
              height
            }
          }
        }
      }
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      category {
        id
        fullName
      }
      seo {
        title
        description
      }
      status
      vendor
      productType
      tags
      totalInventory
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_WITH_MEDIA_QUERY = `
  query ProductByHandleWithMedia($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      category {
        id
        fullName
      }
      descriptionHtml
      seo {
        title
        description
      }
      status
      vendor
      productType
      tags
      totalInventory
      media(first: 10) {
        nodes {
          id
          alt
          mediaContentType
          ... on MediaImage {
            image {
              altText
              url
              width
              height
            }
          }
        }
      }
      variants(first: 10) {
        nodes {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
  }
`;

export const PRODUCT_CREATE_MUTATION = `
  mutation ProductCreate($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        title
        handle
        category {
          id
          fullName
        }
        seo {
          title
          description
        }
        status
        vendor
        productType
        tags
        totalInventory
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PRODUCT_UPDATE_MUTATION = `
  mutation ProductUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        title
        handle
        category {
          id
          fullName
        }
        seo {
          title
          description
        }
        status
        vendor
        productType
        tags
        totalInventory
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PRODUCT_DELETE_MUTATION = `
  mutation ProductDelete($input: ProductDeleteInput!, $synchronous: Boolean!) {
    productDelete(input: $input, synchronous: $synchronous) {
      deletedProductId
      productDeleteOperation {
        id
        status
        deletedProductId
      }
      userErrors {
        field
        message
      }
    }
  }
`;
