import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  GIFT_CARD_CREATE_MUTATION,
  GIFT_CARD_GET_QUERY,
  GIFT_CARD_RECIPIENT_LOOKUP_QUERY,
  GIFT_CARDS_LIST_QUERY,
} from "../graphql/gift-cards.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

interface Money {
  amount: string;
  currencyCode: string;
}

interface GiftCardCustomerSummary {
  displayName: string | null;
  email: string | null;
  id: string;
}

interface GiftCardRecipientAttributes {
  message: string | null;
  preferredName: string | null;
  recipient: GiftCardCustomerSummary;
  sendNotificationAt: string | null;
}

interface GiftCardListItem {
  balance: Money;
  createdAt: string;
  customer: GiftCardCustomerSummary | null;
  enabled: boolean;
  expiresOn: string | null;
  id: string;
  initialValue: Money;
  lastCharacters: string;
  maskedCode: string;
  note: string | null;
  updatedAt: string;
}

interface GiftCardDetails extends GiftCardListItem {
  deactivatedAt: string | null;
  recipientAttributes: GiftCardRecipientAttributes | null;
}

interface GiftCardsListResponse {
  giftCards: {
    edges: Array<{
      cursor: string;
      node: GiftCardListItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface GiftCardGetResponse {
  giftCard: GiftCardDetails | null;
}

interface GiftCardCreateResponse {
  giftCardCreate: {
    giftCard: GiftCardDetails | null;
    giftCardCode: string | null;
    userErrors: GraphQlUserError[];
  };
}

interface GiftCardRecipientLookupResponse {
  customers: {
    edges: Array<{
      node: GiftCardCustomerSummary;
    }>;
  };
}

interface GiftCardsListOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  query?: string;
  reverse?: boolean;
}

interface GiftCardGetOptions {
  format: OutputFormat;
}

interface GiftCardCreateOptions {
  code?: string;
  expires?: string;
  format: OutputFormat;
  note?: string;
  notify?: boolean;
  recipientEmail?: string;
  recipientMessage?: string;
  value: string;
}

export function registerGiftCardCommands(program: Command): void {
  const giftCards = program
    .command("gift-cards")
    .description("Read and create Shopify gift cards");

  giftCards
    .command("list")
    .description("List gift cards")
    .option("--limit <n>", "Number of gift cards to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--query <query>", "Raw Shopify gift card search query")
    .option("--reverse", "Reverse sort order")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet gift-cards list --limit 20
  shopfleet gift-cards list --query "status:enabled balance_status:partial"
  shopfleet gift-cards list --query "last_characters:1234" --format json

Notes:
  --query uses Shopify gift card search syntax directly.
  Pagination is manual. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: GiftCardsListOptions, command: Command) => {
      await runGiftCardsList(options, command);
    });

  giftCards
    .command("get")
    .description("Get a gift card by GID or numeric ID")
    .argument("<id>", "Gift card GID or numeric ID")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet gift-cards get gid://shopify/GiftCard/1234567890
  shopfleet gift-cards get 1234567890 --format table

Notes:
  The argument must be a Shopify gift card GID or numeric gift card ID.
      `,
    )
    .action(async (id: string, options: GiftCardGetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<GiftCardGetResponse>({
        query: GIFT_CARD_GET_QUERY,
        variables: { id: normalizeGiftCardId(id) },
      });

      if (!data.giftCard) {
        throw new Error(`Gift card not found: ${id}`);
      }

      if (options.format === "json") {
        printJson(data.giftCard);
        return;
      }

      printGiftCardDetails(data.giftCard);
    });

  giftCards
    .command("create")
    .description("Create a gift card")
    .requiredOption("--value <amount>", "Initial gift card value as a positive decimal")
    .option("--code <code>", "Custom gift card code, 8-20 alphanumeric characters")
    .option("--note <note>", "Internal note")
    .option("--expires <date>", "Expiration date in YYYY-MM-DD format")
    .option(
      "--recipient-email <email>",
      "Existing Shopify customer email that will receive the gift card",
    )
    .option("--recipient-message <message>", "Message for the recipient")
    .option("--notify", "Let Shopify send customer or recipient notifications")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet gift-cards create --value 25
  shopfleet gift-cards create --value 50 --code SPRING2026 --note "Refund for Order #1001"
  shopfleet gift-cards create --value 100 --recipient-email maria@example.com --recipient-message "Happy birthday" --notify

Notes:
  --expires expects a YYYY-MM-DD date.
  --recipient-email must match an existing Shopify customer email because Shopify recipient data uses customer IDs.
  Notifications are disabled by default. Pass --notify to let Shopify send them.
      `,
    )
    .action(async (options: GiftCardCreateOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const recipient = options.recipientEmail
        ? await resolveGiftCardRecipient(client, options.recipientEmail)
        : null;
      const data = await client.query<GiftCardCreateResponse>({
        query: GIFT_CARD_CREATE_MUTATION,
        variables: {
          input: buildGiftCardCreateInput(options, recipient?.id),
        },
      });

      assertNoGiftCardUserErrors(data.giftCardCreate.userErrors);

      if (!data.giftCardCreate.giftCard) {
        throw new Error("Shopify did not return the created gift card.");
      }

      printGiftCardCreateResult(
        data.giftCardCreate.giftCard,
        data.giftCardCreate.giftCardCode,
        options.format,
        Boolean(options.notify),
      );
    });
}

async function runGiftCardsList(
  options: GiftCardsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const limit = Number(options.limit);
  const query = sanitizeRawQuery(options.query);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<GiftCardsListResponse>({
    query: GIFT_CARDS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      query,
      reverse: Boolean(options.reverse),
    },
  });

  const rows = data.giftCards.edges.map((edge) => mapGiftCardListRow(edge.node));

  if (options.format === "json") {
    printJson({
      items: data.giftCards.edges.map((edge) => edge.node),
      pageInfo: data.giftCards.pageInfo,
      query,
    });
    return;
  }

  printOutput(options.format, rows, [
    "id",
    "maskedCode",
    "customer",
    "initialValue",
    "balance",
    "status",
    "expiresOn",
    "createdAt",
  ]);

  if (data.giftCards.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.giftCards.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function mapGiftCardListRow(giftCard: GiftCardListItem): Record<string, unknown> {
  return {
    balance: formatMoney(giftCard.balance),
    createdAt: giftCard.createdAt,
    customer: formatGiftCardCustomer(giftCard.customer),
    expiresOn: giftCard.expiresOn ?? "",
    id: giftCard.id,
    initialValue: formatMoney(giftCard.initialValue),
    maskedCode: giftCard.maskedCode,
    status: resolveGiftCardStatus(giftCard.enabled, giftCard.expiresOn),
  };
}

function printGiftCardDetails(giftCard: GiftCardDetails): void {
  printTable(
    [
      {
        balance: formatMoney(giftCard.balance),
        createdAt: giftCard.createdAt,
        customer: formatGiftCardCustomer(giftCard.customer),
        deactivatedAt: giftCard.deactivatedAt ?? "",
        expiresOn: giftCard.expiresOn ?? "",
        id: giftCard.id,
        initialValue: formatMoney(giftCard.initialValue),
        lastCharacters: giftCard.lastCharacters,
        maskedCode: giftCard.maskedCode,
        note: giftCard.note ?? "",
        recipient: formatGiftCardCustomer(giftCard.recipientAttributes?.recipient ?? null),
        recipientMessage: giftCard.recipientAttributes?.message ?? "",
        recipientName: giftCard.recipientAttributes?.preferredName ?? "",
        recipientSendNotificationAt:
          giftCard.recipientAttributes?.sendNotificationAt ?? "",
        status: resolveGiftCardStatus(giftCard.enabled, giftCard.expiresOn),
        updatedAt: giftCard.updatedAt,
      },
    ],
    [
      "id",
      "maskedCode",
      "lastCharacters",
      "status",
      "initialValue",
      "balance",
      "customer",
      "recipient",
      "expiresOn",
      "createdAt",
      "updatedAt",
      "deactivatedAt",
      "note",
      "recipientName",
      "recipientMessage",
      "recipientSendNotificationAt",
    ],
  );
}

function printGiftCardCreateResult(
  giftCard: GiftCardDetails,
  giftCardCode: string | null,
  format: OutputFormat,
  notify: boolean,
): void {
  const result = {
    balance: formatMoney(giftCard.balance),
    code: giftCardCode ?? "",
    createdAt: giftCard.createdAt,
    customer: formatGiftCardCustomer(giftCard.customer),
    expiresOn: giftCard.expiresOn ?? "",
    id: giftCard.id,
    initialValue: formatMoney(giftCard.initialValue),
    maskedCode: giftCard.maskedCode,
    note: giftCard.note ?? "",
    notify,
    recipient: formatGiftCardCustomer(giftCard.recipientAttributes?.recipient ?? null),
    recipientMessage: giftCard.recipientAttributes?.message ?? "",
    status: resolveGiftCardStatus(giftCard.enabled, giftCard.expiresOn),
  };

  if (format === "json") {
    printJson({
      giftCard,
      giftCardCode,
      notify,
    });
    return;
  }

  printTable(
    [result],
    [
      "id",
      "code",
      "maskedCode",
      "status",
      "initialValue",
      "balance",
      "customer",
      "recipient",
      "expiresOn",
      "notify",
      "note",
      "recipientMessage",
    ],
  );
}

async function resolveGiftCardRecipient(
  client: ShopifyClient,
  email: string,
): Promise<GiftCardCustomerSummary> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("--recipient-email cannot be empty.");
  }

  const data = await client.query<GiftCardRecipientLookupResponse>({
    query: GIFT_CARD_RECIPIENT_LOOKUP_QUERY,
    variables: {
      query: `email:${quoteSearchValue(normalizedEmail)}`,
    },
  });

  const matches = data.customers.edges
    .map((edge) => edge.node)
    .filter((customer) => customer.email?.trim().toLowerCase() === normalizedEmail);

  if (matches.length === 0) {
    throw new Error(
      `No Shopify customer found for --recipient-email "${email}". Create the customer first or omit the recipient fields.`,
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple Shopify customers matched --recipient-email "${email}". Use a unique customer email.`,
    );
  }

  const [match] = matches;

  if (!match) {
    throw new Error("Shopify did not return a recipient customer.");
  }

  return match;
}

function assertNoGiftCardUserErrors(userErrors: GraphQlUserError[]): void {
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

function formatMoney(money: Money): string {
  return `${money.amount} ${money.currencyCode}`;
}

function formatGiftCardCustomer(customer: GiftCardCustomerSummary | null): string {
  if (!customer) {
    return "";
  }

  const displayName = customer.displayName ?? "";
  const email = customer.email ?? "";

  if (displayName && email) {
    return `${displayName} <${email}>`;
  }

  return displayName || email || customer.id;
}

function resolveGiftCardStatus(enabled: boolean, expiresOn: string | null): string {
  if (!enabled) {
    return "DISABLED";
  }

  if (expiresOn && expiresOn < new Date().toISOString().slice(0, 10)) {
    return "EXPIRED";
  }

  return "ENABLED";
}

export function normalizeGiftCardId(input: string): string {
  if (input.startsWith("gid://shopify/GiftCard/")) {
    return input;
  }

  if (/^\d+$/.test(input)) {
    return `gid://shopify/GiftCard/${input}`;
  }

  throw new Error("Expected a gift card GID or numeric gift card ID.");
}

export function buildGiftCardCreateInput(
  options: GiftCardCreateOptions,
  recipientId?: string,
): Record<string, unknown> {
  const recipientMessage = sanitizeOptionalText(options.recipientMessage);

  if (recipientMessage && !recipientId) {
    throw new Error("--recipient-message requires --recipient-email.");
  }

  return omitUndefined({
    code: parseGiftCardCode(options.code),
    customerId: recipientId,
    expiresOn: parseGiftCardExpiration(options.expires),
    initialValue: parseGiftCardValue(options.value),
    note: sanitizeOptionalText(options.note),
    notify: Boolean(options.notify),
    recipientAttributes: recipientId
      ? omitUndefined({
          id: recipientId,
          message: recipientMessage,
        })
      : undefined,
  });
}

export function parseGiftCardValue(input: string): string {
  const trimmed = input.trim();
  const value = Number(trimmed);

  if (!trimmed || !Number.isFinite(value) || value <= 0) {
    throw new Error("--value must be a positive number.");
  }

  return trimmed;
}

export function parseGiftCardCode(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim();

  if (!/^[A-Za-z0-9]{8,20}$/.test(trimmed)) {
    throw new Error(
      "--code must be 8-20 characters long and contain only letters and numbers.",
    );
  }

  return trimmed;
}

export function parseGiftCardExpiration(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("--expires must use the YYYY-MM-DD format.");
  }

  const parsed = new Date(`${trimmed}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error("--expires must be a valid calendar date.");
  }

  return trimmed;
}

function sanitizeRawQuery(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function quoteSearchValue(value: string): string {
  if (!/[\s:()]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}
