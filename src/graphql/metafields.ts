const METAFIELD_FIELDS = `
  id
  namespace
  key
  type
  value
  description
  createdAt
  updatedAt
  compareDigest
`;

export const CURRENT_APP_INSTALLATION_ID_QUERY = `
  query CurrentAppInstallationId {
    currentAppInstallation {
      id
    }
  }
`;

export const METAFIELDS_LIST_QUERY = `
  query MetafieldsList(
    $owner: ID!,
    $first: Int!,
    $after: String,
    $namespace: String
  ) {
    metafields(
      owner: $owner,
      first: $first,
      after: $after,
      namespace: $namespace
    ) {
      edges {
        cursor
        node {
          ${METAFIELD_FIELDS}
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const OWNER_METAFIELD_GET_QUERY = `
  query OwnerMetafieldGet($ownerId: ID!, $namespace: String!, $key: String!) {
    node(id: $ownerId) {
      id
      ... on HasMetafields {
        metafield(namespace: $namespace, key: $key) {
          ${METAFIELD_FIELDS}
        }
      }
    }
  }
`;

export const METAFIELDS_SET_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        ${METAFIELD_FIELDS}
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const METAFIELDS_DELETE_MUTATION = `
  mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields {
        ownerId
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;
