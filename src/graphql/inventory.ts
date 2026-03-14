export const INVENTORY_LEVELS_QUERY = `
  query InventoryLevels(
    $first: Int!,
    $after: String,
    $query: String,
    $quantityNames: [String!]!
  ) {
    inventoryItems(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          legacyResourceId
          sku
          tracked
          inventoryLevels(first: 250) {
            nodes {
              id
              location {
                id
                name
              }
              quantities(names: $quantityNames) {
                name
                quantity
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

export const INVENTORY_LEVEL_AT_LOCATION_QUERY = `
  query InventoryLevelsAtLocation(
    $first: Int!,
    $after: String,
    $query: String,
    $locationId: ID!,
    $quantityNames: [String!]!
  ) {
    inventoryItems(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          legacyResourceId
          sku
          tracked
          inventoryLevel(locationId: $locationId) {
            id
            location {
              id
              name
            }
            quantities(names: $quantityNames) {
              name
              quantity
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

export const INVENTORY_ADJUST_MUTATION = `
  mutation InventoryAdjustQuantities(
    $input: InventoryAdjustQuantitiesInput!,
    $quantityNames: [String!]
  ) {
    inventoryAdjustQuantities(input: $input) {
      inventoryAdjustmentGroup {
        id
        createdAt
        reason
        referenceDocumentUri
        changes(quantityNames: $quantityNames) {
          name
          delta
          quantityAfterChange
          ledgerDocumentUri
          item {
            id
            sku
          }
          location {
            id
            name
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

export const LOCATIONS_LIST_QUERY = `
  query LocationsList(
    $first: Int!,
    $after: String,
    $query: String,
    $includeInactive: Boolean!,
    $includeLegacy: Boolean!
  ) {
    locations(
      first: $first,
      after: $after,
      query: $query,
      includeInactive: $includeInactive,
      includeLegacy: $includeLegacy
    ) {
      edges {
        cursor
        node {
          id
          legacyResourceId
          name
          deactivatedAt
          fulfillsOnlineOrders
          hasActiveInventory
          hasUnfulfilledOrders
          address {
            formatted
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
