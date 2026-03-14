export const PAGES_LIST_QUERY = `
  query PagesList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: PageSortKeys!,
    $reverse: Boolean!
  ) {
    pages(
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
          title
          handle
          bodySummary
          isPublished
          publishedAt
          updatedAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const PAGE_CREATE_MUTATION = `
  mutation PageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page {
        id
        title
        handle
        bodySummary
        isPublished
        publishedAt
        updatedAt
        templateSuffix
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const BLOGS_LIST_QUERY = `
  query BlogsList(
    $first: Int!,
    $after: String,
    $query: String,
    $sortKey: BlogSortKeys!,
    $reverse: Boolean!
  ) {
    blogs(
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
          title
          handle
          commentPolicy
          createdAt
          updatedAt
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const ARTICLE_CREATE_MUTATION = `
  mutation ArticleCreate($article: ArticleCreateInput!) {
    articleCreate(article: $article) {
      article {
        id
        title
        handle
        body
        summary
        tags
        isPublished
        publishedAt
        updatedAt
        templateSuffix
        author {
          name
        }
        blog {
          id
          title
          handle
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
