const DISCOUNT_VALUE_FRAGMENT = `
  customerGets {
    value {
      __typename
      ... on DiscountAmount {
        amount {
          amount
          currencyCode
        }
        appliesOnEachItem
      }
      ... on DiscountPercentage {
        percentage
      }
    }
  }
`;

const COMBINES_WITH_FRAGMENT = `
  combinesWith {
    orderDiscounts
    productDiscounts
    shippingDiscounts
  }
`;

export const DISCOUNTS_LIST_QUERY = `
  query DiscountsList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: DiscountSortKeys!,
    $reverse: Boolean!
  ) {
    discountNodes(
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
          discount {
            __typename
            ... on DiscountCodeBasic {
              title
              summary
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
              ${DISCOUNT_VALUE_FRAGMENT}
            }
            ... on DiscountAutomaticBasic {
              title
              summary
              status
              startsAt
              endsAt
              ${DISCOUNT_VALUE_FRAGMENT}
            }
            ... on DiscountCodeBxgy {
              title
              summary
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
            ... on DiscountAutomaticBxgy {
              title
              summary
              status
              startsAt
              endsAt
            }
            ... on DiscountCodeFreeShipping {
              title
              summary
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
            ... on DiscountAutomaticFreeShipping {
              title
              summary
              status
              startsAt
              endsAt
            }
            ... on DiscountCodeApp {
              title
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
              appDiscountType {
                functionId
                title
              }
            }
            ... on DiscountAutomaticApp {
              title
              status
              startsAt
              endsAt
              appDiscountType {
                functionId
                title
              }
            }
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const DISCOUNT_GET_QUERY = `
  query DiscountGet($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        __typename
        ... on DiscountCodeBasic {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          usageLimit
          appliesOncePerCustomer
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          codes(first: 20) {
            nodes {
              code
            }
          }
          ${DISCOUNT_VALUE_FRAGMENT}
        }
        ... on DiscountAutomaticBasic {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          ${DISCOUNT_VALUE_FRAGMENT}
        }
        ... on DiscountCodeBxgy {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          codes(first: 20) {
            nodes {
              code
            }
          }
        }
        ... on DiscountAutomaticBxgy {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
        }
        ... on DiscountCodeFreeShipping {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          codes(first: 20) {
            nodes {
              code
            }
          }
        }
        ... on DiscountAutomaticFreeShipping {
          title
          summary
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
        }
        ... on DiscountCodeApp {
          title
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          codes(first: 20) {
            nodes {
              code
            }
          }
          appDiscountType {
            functionId
            title
          }
        }
        ... on DiscountAutomaticApp {
          title
          status
          startsAt
          endsAt
          asyncUsageCount
          discountClasses
          ${COMBINES_WITH_FRAGMENT}
          appDiscountType {
            functionId
            title
          }
        }
      }
    }
  }
`;

export const DISCOUNT_CREATE_MUTATION = `
  mutation DiscountCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic {
            title
            summary
            status
            startsAt
            endsAt
            asyncUsageCount
            usageLimit
            appliesOncePerCustomer
            discountClasses
            ${COMBINES_WITH_FRAGMENT}
            codes(first: 20) {
              nodes {
                code
              }
            }
            ${DISCOUNT_VALUE_FRAGMENT}
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
