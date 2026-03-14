export const FULFILLMENT_ORDERS_LIST_QUERY = `
  query FulfillmentOrdersList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: FulfillmentOrderSortKeys!,
    $reverse: Boolean!,
    $includeClosed: Boolean!
  ) {
    fulfillmentOrders(
      first: $first,
      after: $after,
      query: $query,
      sortKey: $sortKey,
      reverse: $reverse,
      includeClosed: $includeClosed
    ) {
      edges {
        cursor
        node {
          id
          orderId
          orderName
          orderProcessedAt
          status
          requestStatus
          updatedAt
          fulfillAt
          fulfillBy
          assignedLocation {
            name
            location {
              id
              name
            }
          }
          destination {
            city
            countryCode
            provinceCode
            zip
          }
          supportedActions {
            action
          }
          lineItems(first: 50) {
            nodes {
              id
              remainingQuantity
              totalQuantity
            }
          }
          fulfillments(first: 10) {
            nodes {
              id
              status
              trackingInfo(first: 10) {
                company
                number
                url
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

export const ORDER_FULFILLMENT_ORDERS_QUERY = `
  query OrderFulfillmentOrders($id: ID!) {
    order(id: $id) {
      id
      name
      fulfillmentOrders(first: 50) {
        nodes {
          id
          status
          requestStatus
          supportedActions {
            action
          }
          assignedLocation {
            name
            location {
              id
              name
            }
          }
          lineItems(first: 250) {
            nodes {
              id
              remainingQuantity
              totalQuantity
            }
          }
        }
      }
    }
  }
`;

export const FULFILLMENT_CREATE_MUTATION = `
  mutation FulfillmentCreate(
    $fulfillment: FulfillmentInput!,
    $message: String,
    $notifyCustomer: Boolean
  ) {
    fulfillmentCreate(
      fulfillment: $fulfillment,
      message: $message,
      notifyCustomer: $notifyCustomer
    ) {
      fulfillment {
        id
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const FULFILLMENT_TRACKING_UPDATE_MUTATION = `
  mutation FulfillmentTrackingInfoUpdate(
    $fulfillmentId: ID!,
    $trackingInfoInput: FulfillmentTrackingInput!,
    $notifyCustomer: Boolean
  ) {
    fulfillmentTrackingInfoUpdate(
      fulfillmentId: $fulfillmentId,
      trackingInfoInput: $trackingInfoInput,
      notifyCustomer: $notifyCustomer
    ) {
      fulfillment {
        id
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
