export const ORDERS_LIST_QUERY = `
  query OrdersList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: OrderSortKeys!,
    $reverse: Boolean!
  ) {
    orders(
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
          name
          displayFinancialStatus
          displayFulfillmentStatus
          processedAt
          cancelledAt
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            displayName
            email
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

export const ORDER_GET_QUERY = `
  query OrderGet($id: ID!) {
    order(id: $id) {
      id
      name
      displayFinancialStatus
      displayFulfillmentStatus
      processedAt
      cancelledAt
      cancelReason
      canNotifyCustomer
      note
      tags
      currentSubtotalPriceSet {
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
      customer {
        id
        displayName
        email
      }
      transactions(first: 10) {
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

export const ORDER_TRANSACTIONS_QUERY = `
  query OrderTransactions($id: ID!) {
    order(id: $id) {
      id
      name
      transactions(first: 20) {
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

export const ORDER_CANCEL_MUTATION = `
  mutation OrderCancel(
    $orderId: ID!,
    $reason: OrderCancelReason!,
    $restock: Boolean!,
    $notifyCustomer: Boolean,
    $staffNote: String,
    $refundMethod: OrderCancelRefundMethodInput
  ) {
    orderCancel(
      orderId: $orderId,
      reason: $reason,
      restock: $restock,
      notifyCustomer: $notifyCustomer,
      staffNote: $staffNote,
      refundMethod: $refundMethod
    ) {
      job {
        id
        done
      }
      orderCancelUserErrors {
        field
        message
      }
    }
  }
`;
