import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  CUSTOMER_GET_QUERY,
  CUSTOMER_ORDERS_QUERY,
  CUSTOMERS_LIST_QUERY,
} from "../graphql/customers.js";
import type { OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const CUSTOMER_SORT_KEYS = [
  "CREATED_AT",
  "ID",
  "LOCATION",
  "NAME",
  "RELEVANCE",
  "UPDATED_AT",
] as const;

const CUSTOMER_ORDER_SORT_KEYS = [
  "CREATED_AT",
  "ID",
  "ORDER_NUMBER",
  "PROCESSED_AT",
  "RELEVANCE",
  "TOTAL_PRICE",
  "UPDATED_AT",
] as const;

type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];
type CustomerOrderSortKey = (typeof CUSTOMER_ORDER_SORT_KEYS)[number];

interface Money {
  amount: string;
  currencyCode: string;
}

interface CustomerEmailAddress {
  emailAddress: string;
}

interface CustomerPhoneNumber {
  phoneNumber: string;
}

interface CustomerAddress {
  address1: string | null;
  address2: string | null;
  city: string | null;
  country: string | null;
  name: string | null;
  phone: string | null;
  province: string | null;
  zip: string | null;
}

interface CustomerListItem {
  amountSpent: Money;
  createdAt: string;
  defaultEmailAddress: CustomerEmailAddress | null;
  defaultPhoneNumber: CustomerPhoneNumber | null;
  firstName: string | null;
  id: string;
  lastName: string | null;
  numberOfOrders: string;
  state: string;
  updatedAt: string;
}

interface CustomerDetails {
  amountSpent: Money;
  createdAt: string;
  defaultAddress: CustomerAddress | null;
  displayName: string | null;
  email: string | null;
  firstName: string | null;
  id: string;
  lastName: string | null;
  note: string | null;
  numberOfOrders: string;
  phone: string | null;
  state: string;
  tags: string[];
  taxExempt: boolean;
  updatedAt: string;
  verifiedEmail: boolean;
}

interface CustomerOrderItem {
  cancelledAt: string | null;
  currentTotalPriceSet: {
    shopMoney: Money;
  };
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  id: string;
  name: string;
  processedAt: string;
}

interface CustomersListResponse {
  customers: {
    edges: Array<{
      cursor: string;
      node: CustomerListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface CustomerGetResponse {
  customer: CustomerDetails | null;
}

interface CustomerOrdersResponse {
  customer: {
    displayName: string | null;
    email: string | null;
    id: string;
    orders: {
      edges: Array<{
        cursor: string;
        node: CustomerOrderItem;
      }>;
      pageInfo: PageInfo;
    };
  } | null;
}

interface CustomersListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
  sort?: string;
}

interface CustomerGetOptions {
  format: OutputFormat;
}

interface CustomerSearchOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  reverse?: boolean;
}

interface CustomerOrdersOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  reverse?: boolean;
  sort?: string;
}

export function registerCustomerCommands(program: Command): void {
  const customers = program.command("customers").description("Read customer data");

  customers
    .command("list")
    .description("List customers")
    .option("--limit <n>", "Number of customers to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify customer search query")
    .option(
      "--sort <sortKey>",
      `Sort by ${CUSTOMER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet customers list --limit 20
  shopfleet customers list --query "state:enabled" --sort updated-at
  shopfleet customers list --query "tag:VIP" --reverse

Notes:
  --query uses Shopify customer search syntax directly.
  Pagination is manual for now. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: CustomersListOptions, command: Command) => {
      await runCustomersList(options, command);
    });

  customers
    .command("search")
    .description("Search customers by name, email or phone")
    .argument("<text>", "Customer name, email or phone")
    .option("--limit <n>", "Number of customers to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet customers search maria
  shopfleet customers search maria@example.com --limit 5
  shopfleet customers search +34123456789 --format json

Notes:
  This command builds a Shopify search query over first name, last name, email and phone.
      `,
    )
    .action(async (text: string, options: CustomerSearchOptions, command: Command) => {
      await runCustomersList(
        {
          after: options.after,
          format: options.format,
          limit: options.limit,
          query: buildCustomerSearchQuery(text) ?? undefined,
          reverse: options.reverse,
          sort: "relevance",
        },
        command,
      );
    });

  customers
    .command("get")
    .description("Get a customer by GID or numeric ID")
    .argument("<id>", "Customer GID or numeric ID")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet customers get gid://shopify/Customer/1234567890
  shopfleet customers get 1234567890 --format table

Notes:
  The argument must be a Shopify customer GID or numeric customer ID.
      `,
    )
    .action(async (id: string, options: CustomerGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<CustomerGetResponse>({
        query: CUSTOMER_GET_QUERY,
        variables: { id: normalizeCustomerId(id) },
      });

      if (!data.customer) {
        throw new Error(`Customer not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.customer);
        return;
      }

      printCustomerDetails(data.customer);
    });

  customers
    .command("orders")
    .description("List orders for a customer")
    .argument("<id>", "Customer GID or numeric ID")
    .option("--limit <n>", "Number of orders to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option(
      "--sort <sortKey>",
      `Sort by ${CUSTOMER_ORDER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}`,
    )
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet customers orders 1234567890
  shopfleet customers orders gid://shopify/Customer/1234567890 --limit 10 --sort processed-at
  shopfleet customers orders 1234567890 --format json

Notes:
  The argument must be a Shopify customer GID or numeric customer ID.
  This command reads the customer's order connection directly.
      `,
    )
    .action(async (id: string, options: CustomerOrdersOptions, command: Command) => {
      await runCustomerOrders(id, options, command);
    });
}

async function runCustomersList(
  options: CustomersListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = sanitizeRawQuery(options.query);
  const sortKey = parseCustomerSortKey(options.sort, query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<CustomersListResponse>({
    query: CUSTOMERS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  const rows = data.customers.edges.map((edge) => mapCustomerListRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.customers.edges.map((edge) => edge.node),
      pageInfo: data.customers.pageInfo,
      query,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "name",
    "email",
    "phone",
    "state",
    "numberOfOrders",
    "amountSpent",
  ]);

  if (data.customers.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.customers.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

async function runCustomerOrders(
  id: string,
  options: CustomerOrdersOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const customerId = normalizeCustomerId(id);
  const sortKey = parseCustomerOrderSortKey(options.sort);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<CustomerOrdersResponse>({
    query: CUSTOMER_ORDERS_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      id: customerId,
      reverse: Boolean(options.reverse),
      sortKey,
    },
  });

  if (!data.customer) {
    throw new Error(`Customer not found: ${id}`);
  }

  const rows = data.customer.orders.edges.map((edge) => mapCustomerOrderRow(edge.node));

  if (options.format === "json") {
    printJson({
      customer: {
        displayName: data.customer.displayName,
        email: data.customer.email,
        id: data.customer.id,
      },
      items: data.customer.orders.edges.map((edge) => edge.node),
      pageInfo: data.customer.orders.pageInfo,
      sortKey,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "name",
    "processedAt",
    "financialStatus",
    "fulfillmentStatus",
    "total",
    "cancelledAt",
  ]);

  if (data.customer.orders.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.customer.orders.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function mapCustomerListRow(customer: CustomerListItem): Record<string, unknown> {
  return {
    amountSpent: formatMoney(customer.amountSpent),
    email: customer.defaultEmailAddress?.emailAddress ?? "",
    id: customer.id,
    name: formatCustomerName(customer.firstName, customer.lastName),
    numberOfOrders: customer.numberOfOrders,
    phone: customer.defaultPhoneNumber?.phoneNumber ?? "",
    state: customer.state,
  };
}

function mapCustomerOrderRow(order: CustomerOrderItem): Record<string, unknown> {
  return {
    cancelledAt: order.cancelledAt ?? "",
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    id: order.id,
    name: order.name,
    processedAt: order.processedAt,
    total: formatMoney(order.currentTotalPriceSet.shopMoney),
  };
}

function printCustomerDetails(customer: CustomerDetails): void {
  printTable(
    [
      {
        amountSpent: formatMoney(customer.amountSpent),
        createdAt: customer.createdAt,
        defaultAddress: formatAddress(customer.defaultAddress),
        email: customer.email ?? "",
        id: customer.id,
        name:
          customer.displayName ?? formatCustomerName(customer.firstName, customer.lastName),
        note: customer.note ?? "",
        numberOfOrders: customer.numberOfOrders,
        phone: customer.phone ?? "",
        state: customer.state,
        tags: customer.tags,
        taxExempt: customer.taxExempt,
        updatedAt: customer.updatedAt,
        verifiedEmail: customer.verifiedEmail,
      },
    ],
    [
      "id",
      "name",
      "email",
      "phone",
      "state",
      "numberOfOrders",
      "amountSpent",
      "verifiedEmail",
      "taxExempt",
      "createdAt",
      "updatedAt",
      "note",
      "tags",
      "defaultAddress",
    ],
  );
}

function formatCustomerName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const value = [firstName ?? "", lastName ?? ""].filter(Boolean).join(" ").trim();
  return value || "";
}

function formatAddress(address: CustomerAddress | null): string {
  if (!address) {
    return "";
  }

  return [
    address.name,
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
    address.phone,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function formatMoney(money: Money): string {
  return `${money.amount} ${money.currencyCode}`;
}

export function normalizeCustomerId(input: string): string {
  if (input.startsWith("gid://shopify/Customer/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/Customer/${input}`;
  }

  throw new Error("Expected a customer GID or numeric customer ID.");
}

export function buildCustomerSearchQuery(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const clauses = [
    buildFilterTerm("email", trimmed),
    buildFilterTerm("phone", trimmed),
    parts.length === 1
      ? buildFilterTerm("first_name", trimmed)
      : buildCombinedNameClause(parts),
    parts.length === 1 ? buildFilterTerm("last_name", trimmed) : null,
  ].filter((value): value is string => Boolean(value));

  if (clauses.length === 1) {
    return clauses[0] ?? null;
  }

  return `(${clauses.join(" OR ")})`;
}

export function parseCustomerSortKey(
  input: string | undefined,
  query: string | null,
): CustomerSortKey {
  if (!input) {
    return query ? "RELEVANCE" : "NAME";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!CUSTOMER_SORT_KEYS.includes(normalized as CustomerSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${CUSTOMER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE" && !query) {
    throw new Error("--sort relevance requires a search query.");
  }

  return normalized as CustomerSortKey;
}

export function parseCustomerOrderSortKey(
  input: string | undefined,
): CustomerOrderSortKey {
  if (!input) {
    return "PROCESSED_AT";
  }

  const normalized = input.trim().toUpperCase().replaceAll("-", "_");

  if (!CUSTOMER_ORDER_SORT_KEYS.includes(normalized as CustomerOrderSortKey)) {
    throw new Error(
      `Invalid --sort value "${input}". Valid values: ${CUSTOMER_ORDER_SORT_KEYS.join(", ").toLowerCase().replaceAll("_", "-")}.`,
    );
  }

  if (normalized === "RELEVANCE") {
    throw new Error("--sort relevance is not supported for customer orders.");
  }

  return normalized as CustomerOrderSortKey;
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildCombinedNameClause(parts: string[]): string | null {
  const firstName = buildFilterTerm("first_name", parts[0]);
  const lastName = buildFilterTerm("last_name", parts.slice(1).join(" "));

  if (!firstName || !lastName) {
    return null;
  }

  return `(${firstName} ${lastName})`;
}

function buildFilterTerm(field: string, value?: string): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return `${field}:${quoteSearchValue(trimmed)}`;
}

function quoteSearchValue(value: string): string {
  if (!/[\s:()]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
