import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  ARTICLE_CREATE_MUTATION,
  BLOGS_LIST_QUERY,
  PAGE_CREATE_MUTATION,
  PAGES_LIST_QUERY,
} from "../graphql/content.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const PAGE_SORT_KEYS = ["ID", "PUBLISHED_AT", "TITLE", "UPDATED_AT"] as const;
const BLOG_SORT_KEYS = ["HANDLE", "ID", "TITLE"] as const;

type PageSortKey = (typeof PAGE_SORT_KEYS)[number];
type BlogSortKey = (typeof BLOG_SORT_KEYS)[number];

interface PageListItem {
  bodySummary: string;
  handle: string;
  id: string;
  isPublished: boolean;
  publishedAt: string | null;
  title: string;
  updatedAt: string;
}

interface PageDetails extends PageListItem {
  templateSuffix: string | null;
}

interface BlogListItem {
  commentPolicy: string;
  createdAt: string;
  handle: string;
  id: string;
  title: string;
  updatedAt: string;
}

interface ArticleAuthor {
  name: string | null;
}

interface BlogSummary {
  handle: string;
  id: string;
  title: string;
}

interface ArticleDetails {
  author: ArticleAuthor | null;
  blog: BlogSummary | null;
  body: string | null;
  handle: string;
  id: string;
  isPublished: boolean;
  publishedAt: string | null;
  summary: string | null;
  tags: string[];
  templateSuffix: string | null;
  title: string;
  updatedAt: string | null;
}

interface PagesListResponse {
  pages: {
    edges: Array<{
      cursor: string;
      node: PageListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface PageCreateResponse {
  pageCreate: {
    page: PageDetails | null;
    userErrors: GraphQlUserError[];
  };
}

interface BlogsListResponse {
  blogs: {
    edges: Array<{
      cursor: string;
      node: BlogListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface ArticleCreateResponse {
  articleCreate: {
    article: ArticleDetails | null;
    userErrors: GraphQlUserError[];
  };
}

interface PagesListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
}

interface PageCreateOptions {
  body?: string;
  format: OutputFormat;
  handle?: string;
  hidden?: boolean;
  publishDate?: string;
  template?: string;
  title: string;
}

interface BlogsListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
}

interface ArticleCreateOptions {
  authorName: string;
  blogId: string;
  body?: string;
  format: OutputFormat;
  handle?: string;
  hidden?: boolean;
  publishDate?: string;
  summary?: string;
  tags?: string;
  template?: string;
  title: string;
}

export function registerContentCommands(program: Command): void {
  const pages = program.command("pages").description("Read and create online store pages");

  pages
    .command("list")
    .description("List pages")
    .option("--limit <n>", "Number of pages to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify page search query")
    .option(
      "--sort <sortKey>",
      `Sort by ${PAGE_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet pages list --limit 20
  shopfleet pages list --query "title:about" --sort updated-at
  shopfleet pages list --query "published_status:published" --format json

Notes:
  --query uses Shopify page search syntax directly.
  Pagination is manual. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: PagesListOptions, command: Command) => {
      await runPagesList(options, command);
    });

  pages
    .command("create")
    .description("Create an online store page")
    .requiredOption("--title <title>", "Page title")
    .option("--body <html>", "HTML body content")
    .option("--handle <handle>", "Page handle")
    .option("--template <suffix>", "Template suffix")
    .option("--publish-date <date>", "Publish date in ISO 8601 format")
    .option("--hidden", "Create the page unpublished")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet pages create --title "About us"
  shopfleet pages create --title "Shipping policy" --handle shipping-policy --body "<p>Ships in 24h</p>"
  shopfleet pages create --title "Coming soon" --hidden

Notes:
  --publish-date expects a full ISO 8601 date-time.
  Use --hidden to keep the page unpublished. Do not combine --hidden with --publish-date.
      `,
    )
    .action(async (options: PageCreateOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<PageCreateResponse>({
        query: PAGE_CREATE_MUTATION,
        variables: {
          page: buildPageCreateInput(options),
        },
      });

      assertNoContentUserErrors(data.pageCreate.userErrors);

      if (!data.pageCreate.page) {
        throw new Error("Shopify did not return the created page.");
      }

      printPageMutationResult(data.pageCreate.page, options.format);
    });

  const blogs = program
    .command("blogs")
    .description("Read blogs and create articles in existing blogs");

  blogs
    .command("list")
    .description("List blogs")
    .option("--limit <n>", "Number of blogs to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify blog search query")
    .option(
      "--sort <sortKey>",
      `Sort by ${BLOG_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet blogs list --limit 20
  shopfleet blogs list --query "title:news" --sort handle
  shopfleet blogs list --query "handle:journal" --format json

Notes:
  --query uses Shopify blog search syntax directly.
  Pagination is manual. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: BlogsListOptions, command: Command) => {
      await runBlogsList(options, command);
    });

  blogs
    .command("create-article")
    .description("Create an article in an existing blog")
    .requiredOption("--blog-id <id>", "Blog GID or numeric ID returned by blogs list")
    .requiredOption("--title <title>", "Article title")
    .requiredOption("--author-name <name>", "Article author full name")
    .option("--body <html>", "HTML body content")
    .option("--summary <html>", "HTML summary content")
    .option("--handle <handle>", "Article handle")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--template <suffix>", "Template suffix")
    .option("--publish-date <date>", "Publish date in ISO 8601 format")
    .option("--hidden", "Create the article unpublished")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet blogs create-article --blog-id 1234567890 --title "Spring release" --author-name "Store Team"
  shopfleet blogs create-article --blog-id gid://shopify/Blog/1234567890 --title "Launch day" --author-name "Store Team" --tags launch,news
  shopfleet blogs create-article --blog-id 1234567890 --title "Coming soon" --author-name "Store Team" --hidden

Notes:
  --blog-id must be a Shopify blog GID or numeric blog ID.
  --publish-date expects a full ISO 8601 date-time.
  Use --hidden to keep the article unpublished. Do not combine --hidden with --publish-date.
      `,
    )
    .action(async (options: ArticleCreateOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<ArticleCreateResponse>({
        query: ARTICLE_CREATE_MUTATION,
        variables: {
          article: buildArticleCreateInput(options),
        },
      });

      assertNoContentUserErrors(data.articleCreate.userErrors);

      if (!data.articleCreate.article) {
        throw new Error("Shopify did not return the created article.");
      }

      printArticleMutationResult(data.articleCreate.article, options.format);
    });
}

async function runPagesList(
  options: PagesListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = sanitizeRawQuery(options.query);
  const sortKey = parsePageSortKey(options.sort);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<PagesListResponse>({
    query: PAGES_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.pages.edges.map((edge) => mapPageListRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.pages.edges.map((edge) => edge.node),
      pageInfo: data.pages.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "title",
    "handle",
    "isPublished",
    "publishedAt",
    "updatedAt",
    "bodySummary",
  ]);

  if (data.pages.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.pages.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

async function runBlogsList(
  options: BlogsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = sanitizeRawQuery(options.query);
  const sortKey = parseBlogSortKey(options.sort);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<BlogsListResponse>({
    query: BLOGS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.blogs.edges.map((edge) => edge.node);

  if (options.format === "json") {
    printJson({
      items: rows,
      pageInfo: data.blogs.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "title",
    "handle",
    "commentPolicy",
    "createdAt",
    "updatedAt",
  ]);

  if (data.blogs.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.blogs.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function mapPageListRow(page: PageListItem): Record<string, unknown> {
  return {
    bodySummary: page.bodySummary,
    handle: page.handle,
    id: page.id,
    isPublished: page.isPublished,
    publishedAt: page.publishedAt ?? "",
    title: page.title,
    updatedAt: page.updatedAt,
  };
}

function printPageMutationResult(page: PageDetails, format: OutputFormat): void {
  if (format === "json") {
    printJson(page);
    return;
  }

  printTable(
    [
      {
        bodySummary: page.bodySummary,
        handle: page.handle,
        id: page.id,
        isPublished: page.isPublished,
        publishedAt: page.publishedAt ?? "",
        templateSuffix: page.templateSuffix ?? "",
        title: page.title,
        updatedAt: page.updatedAt,
      },
    ],
    [
      "id",
      "title",
      "handle",
      "isPublished",
      "publishedAt",
      "updatedAt",
      "templateSuffix",
      "bodySummary",
    ],
  );
}

function printArticleMutationResult(
  article: ArticleDetails,
  format: OutputFormat,
): void {
  if (format === "json") {
    printJson(article);
    return;
  }

  printTable(
    [
      {
        author: article.author?.name ?? "",
        blog: formatBlogSummary(article.blog),
        handle: article.handle,
        id: article.id,
        isPublished: article.isPublished,
        publishedAt: article.publishedAt ?? "",
        tags: article.tags,
        title: article.title,
        updatedAt: article.updatedAt ?? "",
      },
    ],
    [
      "id",
      "title",
      "handle",
      "blog",
      "author",
      "isPublished",
      "publishedAt",
      "updatedAt",
      "tags",
    ],
  );
}

function formatBlogSummary(blog: BlogSummary | null): string {
  if (!blog) {
    return "";
  }

  return `${blog.title} (${blog.handle})`;
}

function assertNoContentUserErrors(userErrors: GraphQlUserError[]): void {
  if (userErrors.length === 0) {
    return;
  }

  const message = userErrors
    .map((error) => {
      const field = error.field?.join(".") ?? "";
      return field ? `${field}: ${error.message}` : error.message;
    })
    .join("\n");

  throw new Error(message);
}

function sanitizeRawQuery(query: string | undefined): string | null {
  const value = query?.trim();
  return value ? value : null;
}

export function parsePageSortKey(input: string | undefined): PageSortKey {
  if (!input) {
    return "TITLE";
  }

  const normalized = input.trim().replaceAll("-", "_").toUpperCase();

  if ((PAGE_SORT_KEYS as readonly string[]).includes(normalized)) {
    return normalized as PageSortKey;
  }

  throw new Error(
    `Invalid --sort value "${input}". Valid values: ${PAGE_SORT_KEYS.join(", ")
      .toLowerCase()
      .replaceAll("_", "-")}.`,
  );
}

export function parseBlogSortKey(input: string | undefined): BlogSortKey {
  if (!input) {
    return "TITLE";
  }

  const normalized = input.trim().replaceAll("-", "_").toUpperCase();

  if ((BLOG_SORT_KEYS as readonly string[]).includes(normalized)) {
    return normalized as BlogSortKey;
  }

  throw new Error(
    `Invalid --sort value "${input}". Valid values: ${BLOG_SORT_KEYS.join(", ")
      .toLowerCase()
      .replaceAll("_", "-")}.`,
  );
}

export function normalizeBlogId(input: string): string {
  if (
    input.startsWith("gid://shopify/Blog/") ||
    input.startsWith("gid://shopify/OnlineStoreBlog/")
  ) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Blog/${input}`;
  }

  throw new Error("Expected a blog GID or numeric blog ID.");
}

export function parseTags(input: string | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const tags = input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

export function buildPageCreateInput(
  options: PageCreateOptions,
): Record<string, unknown> {
  if (options.hidden && options.publishDate) {
    throw new Error("Do not combine --hidden with --publish-date.");
  }

  const page: Record<string, unknown> = {
    title: options.title,
  };

  if (options.body) {
    page.body = options.body;
  }

  if (options.handle) {
    page.handle = options.handle;
  }

  if (options.template) {
    page.templateSuffix = options.template;
  }

  if (options.publishDate) {
    page.publishDate = options.publishDate;
  } else if (options.hidden) {
    page.isPublished = false;
  }

  return page;
}

export function buildArticleCreateInput(
  options: ArticleCreateOptions,
): Record<string, unknown> {
  if (options.hidden && options.publishDate) {
    throw new Error("Do not combine --hidden with --publish-date.");
  }

  const article: Record<string, unknown> = {
    author: { name: options.authorName },
    blogId: normalizeBlogId(options.blogId),
    title: options.title,
  };

  if (options.body) {
    article.body = options.body;
  }

  if (options.summary) {
    article.summary = options.summary;
  }

  if (options.handle) {
    article.handle = options.handle;
  }

  if (options.template) {
    article.templateSuffix = options.template;
  }

  const tags = parseTags(options.tags);

  if (tags) {
    article.tags = tags;
  }

  if (options.publishDate) {
    article.publishDate = options.publishDate;
  } else if (options.hidden) {
    article.isPublished = false;
  }

  return article;
}
