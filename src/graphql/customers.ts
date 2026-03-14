export const CUSTOMERS_LIST_QUERY = `
  query CustomersList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: CustomerSortKeys!,
    $reverse: Boolean!
  ) {
    customers(
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
          firstName
          lastName
          defaultEmailAddress {
            emailAddress
          }
          defaultPhoneNumber {
            phoneNumber
          }
          createdAt
          updatedAt
          numberOfOrders
          state
          amountSpent {
            amount
            currencyCode
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

export const CUSTOMER_GET_QUERY = `
  query CustomerGet($id: ID!) {
    customer(id: $id) {
      id
      firstName
      lastName
      displayName
      email
      phone
      createdAt
      updatedAt
      numberOfOrders
      state
      amountSpent {
        amount
        currencyCode
      }
      note
      verifiedEmail
      taxExempt
      tags
      defaultAddress {
        address1
        address2
        city
        province
        country
        zip
        phone
        name
      }
    }
  }
`;

export const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrders(
    $id: ID!,
    $first: Int!,
    $after: String,
    $sortKey: OrderSortKeys!,
    $reverse: Boolean!
  ) {
    customer(id: $id) {
      id
      displayName
      email
      orders(
        first: $first,
        after: $after,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        edges {
          cursor
          node {
            id
            name
            processedAt
            cancelledAt
            displayFinancialStatus
            displayFulfillmentStatus
            currentTotalPriceSet {
              shopMoney {
                amount
                currencyCode
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
  }
`;
