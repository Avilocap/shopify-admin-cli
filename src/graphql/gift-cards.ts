export const GIFT_CARDS_LIST_QUERY = `
  query GiftCardsList(
    $first: Int!,
    $after: String,
    $query: String,
    $reverse: Boolean!
  ) {
    giftCards(
      first: $first,
      after: $after,
      query: $query,
      reverse: $reverse
    ) {
      edges {
        cursor
        node {
          id
          maskedCode
          lastCharacters
          enabled
          expiresOn
          createdAt
          updatedAt
          note
          initialValue {
            amount
            currencyCode
          }
          balance {
            amount
            currencyCode
          }
          customer {
            id
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

export const GIFT_CARD_GET_QUERY = `
  query GiftCardGet($id: ID!) {
    giftCard(id: $id) {
      id
      maskedCode
      lastCharacters
      enabled
      expiresOn
      createdAt
      updatedAt
      deactivatedAt
      note
      initialValue {
        amount
        currencyCode
      }
      balance {
        amount
        currencyCode
      }
      customer {
        id
        displayName
        email
      }
      recipientAttributes {
        message
        preferredName
        sendNotificationAt
        recipient {
          id
          displayName
          email
        }
      }
    }
  }
`;

export const GIFT_CARD_CREATE_MUTATION = `
  mutation GiftCardCreate($input: GiftCardCreateInput!) {
    giftCardCreate(input: $input) {
      giftCard {
        id
        maskedCode
        lastCharacters
        enabled
        expiresOn
        createdAt
        updatedAt
        deactivatedAt
        note
        initialValue {
          amount
          currencyCode
        }
        balance {
          amount
          currencyCode
        }
        customer {
          id
          displayName
          email
        }
        recipientAttributes {
          message
          preferredName
          sendNotificationAt
          recipient {
            id
            displayName
            email
          }
        }
      }
      giftCardCode
      userErrors {
        field
        message
      }
    }
  }
`;

export const GIFT_CARD_RECIPIENT_LOOKUP_QUERY = `
  query GiftCardRecipientLookup($query: String!) {
    customers(first: 10, query: $query) {
      edges {
        node {
          id
          displayName
          email
        }
      }
    }
  }
`;
