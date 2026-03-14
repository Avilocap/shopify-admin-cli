export const FINANCIAL_TRANSACTIONS_QUERY = `
  query FinancialTransactions($id: ID!) {
    order(id: $id) {
      id
      name
      transactions(first: 50) {
        id
        kind
        status
        gateway
        createdAt
        amountSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export const FINANCIAL_REFUND_CONTEXT_QUERY = `
  query FinancialRefundContext($id: ID!) {
    order(id: $id) {
      id
      name
      lineItems(first: 250) {
        nodes {
          id
          name
          quantity
          refundableQuantity
        }
      }
    }
  }
`;

export const FINANCIAL_REFUND_MUTATION = `
  mutation FinancialRefund($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        note
        createdAt
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        transactions(first: 20) {
          edges {
            node {
              id
              kind
              status
              gateway
              createdAt
              amountSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
        refundLineItems(first: 50) {
          edges {
            node {
              quantity
              lineItem {
                id
                name
              }
            }
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

export const FINANCIAL_SUMMARY_ORDERS_QUERY = `
  query FinancialSummaryOrders($first: Int!, $after: String, $query: String) {
    orders(
      first: $first,
      after: $after,
      query: $query,
      sortKey: PROCESSED_AT,
      reverse: false
    ) {
      edges {
        cursor
        node {
          id
          name
          cancelledAt
          processedAt
          displayFinancialStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalRefundedSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalOutstandingSet {
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
`;
