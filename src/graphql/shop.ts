export const SHOP_INFO_QUERY = `
  query ShopInfo {
    shop {
      id
      name
      email
      myshopifyDomain
      currencyCode
      plan {
        displayName
      }
    }
  }
`;
