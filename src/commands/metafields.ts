import chalk from "chalk";
import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import {
  CURRENT_APP_INSTALLATION_ID_QUERY,
  METAFIELDS_DELETE_MUTATION,
  METAFIELDS_LIST_QUERY,
  METAFIELDS_SET_MUTATION,
  OWNER_METAFIELD_GET_QUERY,
} from "../graphql/metafields.js";
import type { GraphQlUserError, OutputFormat, PageInfo } from "../types.js";
import { printJson, printOutput, printTable } from "../utils/output.js";

const MAX_METAFIELD_BATCH_SIZE = 25;

interface MetafieldItem {
  compareDigest: string | null;
  createdAt: string;
  description: string | null;
  id: string;
  key: string;
  namespace: string;
  type: string;
  updatedAt: string;
  value: string;
}

interface MetafieldsListResponse {
  metafields: {
    edges: Array<{
      cursor: string;
      node: MetafieldItem;
    }>;
    pageInfo: PageInfo;
  };
}

interface OwnerNodeWithMetafield {
  id: string;
  metafield?: MetafieldItem | null;
}

interface OwnerMetafieldGetResponse {
  node: OwnerNodeWithMetafield | null;
}

interface MetafieldsSetResponse {
  metafieldsSet: {
    metafields: MetafieldItem[];
    userErrors: GraphQlUserError[];
  };
}

interface DeletedMetafieldIdentifier {
  key: string;
  namespace: string;
  ownerId: string;
}

interface MetafieldsDeleteResponse {
  metafieldsDelete: {
    deletedMetafields: Array<DeletedMetafieldIdentifier | null>;
    userErrors: GraphQlUserError[];
  };
}

interface CurrentAppInstallationIdResponse {
  currentAppInstallation: {
    id: string;
  } | null;
}

interface MetafieldOwnerOptions {
  currentAppInstallation?: boolean;
  ownerId?: string;
}

interface MetafieldsListOptions extends MetafieldOwnerOptions {
  after?: string;
  format: OutputFormat;
  limit: string;
  namespace?: string;
}

interface MetafieldsGetOptions extends MetafieldOwnerOptions {
  format: OutputFormat;
}

interface MetafieldsSetOptions extends MetafieldOwnerOptions {
  entry?: string[];
  format: OutputFormat;
}

interface MetafieldsDeleteOptions extends MetafieldOwnerOptions {
  force?: boolean;
  format: OutputFormat;
  identifier?: string[];
}

export function registerMetafieldCommands(program: Command): void {
  const metafields = program
    .command("metafields")
    .description("Read and modify Shopify metafields by owner resource");

  metafields
    .command("list")
    .description("List metafields attached to one owner resource")
    .option("--owner-id <gid>", "Owner resource GID")
    .option(
      "--current-app-installation",
      "Use the current app installation GID as the owner instead of --owner-id",
    )
    .option("--namespace <namespace>", "Filter metafields by namespace")
    .option("--limit <n>", "Number of metafields to fetch", "20")
    .option("--after <cursor>", "Pagination cursor")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Context:
  This command reads metafields from exactly one Shopify owner resource.

Examples:
  shopfleet metafields list --owner-id gid://shopify/Product/1234567890
  shopfleet metafields list --owner-id gid://shopify/ProductVariant/1234567890 --namespace custom --format json
  shopfleet metafields list --current-app-installation --namespace app_config

Notes:
  --owner-id expects a Shopify owner GID such as gid://shopify/Product/1234567890.
  Use --current-app-installation to target AppInstallation metafields without knowing its GID ahead of time.
  Pagination is manual. Reuse the returned cursor with --after.
      `,
    )
    .action(async (options: MetafieldsListOptions, command: Command) => {
      await runMetafieldsList(options, command);
    });

  metafields
    .command("get")
    .description("Get one metafield by owner GID and namespace.key")
    .argument("<identifier>", "Metafield identifier in namespace.key format")
    .option("--owner-id <gid>", "Owner resource GID")
    .option(
      "--current-app-installation",
      "Use the current app installation GID as the owner instead of --owner-id",
    )
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet metafields get custom.material --owner-id gid://shopify/Product/1234567890
  shopfleet metafields get custom.release_year --owner-id gid://shopify/ProductVariant/1234567890 --format table
  shopfleet metafields get app_config.feature_tier --current-app-installation

Notes:
  The identifier must be namespace.key.
  --owner-id expects a Shopify owner GID such as gid://shopify/Product/1234567890.
  Use --current-app-installation to resolve the AppInstallation owner automatically.
      `,
    )
    .action(
      async (
        identifier: string,
        options: MetafieldsGetOptions,
        command: Command,
      ) => {
        const storeAlias = command.optsWithGlobals().store as string | undefined;
        const store = await resolveStore(storeAlias);
        const client = new ShopifyClient({ store });
        const ownerId = await resolveMetafieldOwnerId(client, options);
        const { key, namespace } = parseMetafieldIdentifier(identifier);
        const data = await client.query<OwnerMetafieldGetResponse>({
          query: OWNER_METAFIELD_GET_QUERY,
          variables: {
            key,
            namespace,
            ownerId,
          },
        });

        if (!data.node) {
          throw new Error(`Owner not found: ${ownerId}`);
        }

        if (data.node.metafield === undefined) {
          throw new Error(`Owner does not support metafields: ${ownerId}`);
        }

        if (!data.node.metafield) {
          throw new Error(`Metafield not found: ${identifier}`);
        }

        if (options.format === "json") {
          printJson(data.node.metafield);
          return;
        }

        printMetafieldDetails(data.node.metafield, ownerId);
      },
    );

  metafields
    .command("set")
    .description("Create or update one or more metafields on one owner resource")
    .option("--owner-id <gid>", "Owner resource GID")
    .option(
      "--current-app-installation",
      "Use the current app installation GID as the owner instead of --owner-id",
    )
    .requiredOption(
      "--entry <entry>",
      "Metafield entry in namespace.key:type:value format. Repeat the flag to send multiple metafields.",
      collectRepeatedOption,
    )
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Context:
  This command uses Shopify's metafieldsSet mutation, which creates and updates metafields in one atomic request.

Examples:
  shopfleet metafields set --owner-id gid://shopify/Product/1234567890 --entry custom.material:single_line_text_field:resin
  shopfleet metafields set --owner-id gid://shopify/ProductVariant/1234567890 --entry custom.season:single_line_text_field:2026 --entry custom.release_year:number_integer:2026
  shopfleet metafields set --current-app-installation --entry app_config.feature_tier:single_line_text_field:premium

Notes:
  --owner-id expects a Shopify owner GID such as gid://shopify/Product/1234567890.
  --entry must be namespace.key:type:value. The value is always sent as a string.
  For JSON metafields, pass a serialized JSON string as the value.
  Shopify allows at most 25 metafields per metafieldsSet request.
      `,
    )
    .action(async (options: MetafieldsSetOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const ownerId = await resolveMetafieldOwnerId(client, options);
      const data = await client.query<MetafieldsSetResponse>({
        query: METAFIELDS_SET_MUTATION,
        variables: {
          metafields: buildMetafieldsSetInput(ownerId, options.entry ?? []),
        },
      });

      assertNoMetafieldUserErrors(data.metafieldsSet.userErrors);

      if (options.format === "json") {
        printJson(data.metafieldsSet.metafields);
        return;
      }

      printMetafieldsTable(data.metafieldsSet.metafields, ownerId);
    });

  metafields
    .command("delete")
    .description("Delete one or more metafields by owner GID and namespace.key")
    .option("--owner-id <gid>", "Owner resource GID")
    .option(
      "--current-app-installation",
      "Use the current app installation GID as the owner instead of --owner-id",
    )
    .requiredOption(
      "--identifier <identifier>",
      "Metafield identifier in namespace.key format. Repeat the flag to delete multiple metafields.",
      collectRepeatedOption,
    )
    .option("--force", "Required to execute the delete")
    .option("--format <format>", "table or json", "json")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet metafields delete --owner-id gid://shopify/Product/1234567890 --identifier custom.material --force
  shopfleet metafields delete --owner-id gid://shopify/ProductVariant/1234567890 --identifier custom.season --identifier custom.release_year --force
  shopfleet metafields delete --current-app-installation --identifier app_config.feature_tier --force

Notes:
  --owner-id expects a Shopify owner GID such as gid://shopify/Product/1234567890.
  --identifier must be namespace.key.
  This command is destructive and requires --force.
  Shopify allows deleting up to 25 metafields per metafieldsDelete request.
      `,
    )
    .action(async (options: MetafieldsDeleteOptions, command: Command) => {
      if (!options.force) {
        throw new Error("Refusing to delete metafields without --force.");
      }

      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const ownerId = await resolveMetafieldOwnerId(client, options);
      const data = await client.query<MetafieldsDeleteResponse>({
        query: METAFIELDS_DELETE_MUTATION,
        variables: {
          metafields: buildMetafieldsDeleteInput(ownerId, options.identifier ?? []),
        },
      });

      assertNoMetafieldUserErrors(data.metafieldsDelete.userErrors);

      const deletedMetafields = data.metafieldsDelete.deletedMetafields.filter(
        (entry): entry is DeletedMetafieldIdentifier => Boolean(entry),
      );

      if (options.format === "json") {
        printJson(deletedMetafields);
        return;
      }

      printTable(deletedMetafields, ["ownerId", "namespace", "key"]);
    });
}

async function runMetafieldsList(
  options: MetafieldsListOptions,
  command: Command,
): Promise<void> {
  const storeAlias = command.optsWithGlobals().store as string | undefined;
  const store = await resolveStore(storeAlias);
  const client = new ShopifyClient({ store });
  const ownerId = await resolveMetafieldOwnerId(client, options);
  const limit = Number(options.limit);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 250) {
    throw new Error("--limit must be an integer between 1 and 250.");
  }

  const data = await client.query<MetafieldsListResponse>({
    query: METAFIELDS_LIST_QUERY,
    variables: {
      after: options.after ?? null,
      first: limit,
      namespace: normalizeOptionalNamespace(options.namespace),
      owner: ownerId,
    },
  });

  const rows = data.metafields.edges.map((edge) => edge.node);

  if (options.format === "json") {
    printJson({
      items: rows,
      ownerId,
      pageInfo: data.metafields.pageInfo,
    });
    return;
  }

  printMetafieldsTable(rows, ownerId);

  if (data.metafields.pageInfo.hasNextPage) {
    process.stdout.write(
      `${chalk.dim(`Next cursor: ${data.metafields.pageInfo.endCursor ?? ""}`)}\n`,
    );
  }
}

function printMetafieldDetails(metafield: MetafieldItem, ownerId: string): void {
  printTable(
    [
      {
        id: metafield.id,
        ownerId,
        namespace: metafield.namespace,
        key: metafield.key,
        type: metafield.type,
        value: metafield.value,
        description: metafield.description ?? "",
        createdAt: metafield.createdAt,
        updatedAt: metafield.updatedAt,
        compareDigest: metafield.compareDigest ?? "",
      },
    ],
    [
      "id",
      "ownerId",
      "namespace",
      "key",
      "type",
      "value",
      "description",
      "createdAt",
      "updatedAt",
      "compareDigest",
    ],
  );
}

function printMetafieldsTable(metafields: MetafieldItem[], ownerId: string): void {
  printOutput(
    "table",
    metafields.map((metafield) => ({
      id: metafield.id,
      ownerId,
      namespace: metafield.namespace,
      key: metafield.key,
      type: metafield.type,
      value: metafield.value,
      description: metafield.description ?? "",
      updatedAt: metafield.updatedAt,
    })),
    ["id", "ownerId", "namespace", "key", "type", "value", "description", "updatedAt"],
  );
}

async function resolveMetafieldOwnerId(
  client: ShopifyClient,
  options: MetafieldOwnerOptions,
): Promise<string> {
  const normalizedOwnerId = options.ownerId
    ? normalizeMetafieldOwnerId(options.ownerId)
    : undefined;

  if (options.currentAppInstallation && normalizedOwnerId) {
    throw new Error(
      "Use either --owner-id or --current-app-installation, but not both.",
    );
  }

  if (options.currentAppInstallation) {
    const data = await client.query<CurrentAppInstallationIdResponse>({
      query: CURRENT_APP_INSTALLATION_ID_QUERY,
    });

    if (!data.currentAppInstallation?.id) {
      throw new Error("Shopify did not return currentAppInstallation.id.");
    }

    return data.currentAppInstallation.id;
  }

  if (!normalizedOwnerId) {
    throw new Error("Pass --owner-id or use --current-app-installation.");
  }

  return normalizedOwnerId;
}

function assertNoMetafieldUserErrors(userErrors: GraphQlUserError[]): void {
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

export function normalizeMetafieldOwnerId(input: string): string {
  const trimmed = input.trim();

  if (!trimmed.startsWith("gid://shopify/") || /\s/.test(trimmed)) {
    throw new Error(
      "Expected an owner GID in the gid://shopify/<Resource>/<id> format.",
    );
  }

  return trimmed;
}

export function parseMetafieldIdentifier(
  input: string,
): { key: string; namespace: string } {
  const trimmed = input.trim();
  const lastDot = trimmed.lastIndexOf(".");

  if (!trimmed || lastDot <= 0 || lastDot === trimmed.length - 1) {
    throw new Error(
      `Invalid metafield identifier "${input}". Expected namespace.key.`,
    );
  }

  const namespace = trimmed.slice(0, lastDot).trim();
  const key = trimmed.slice(lastDot + 1).trim();

  if (!namespace || !key || /\s/.test(namespace) || !/^[A-Za-z0-9_-]{2,64}$/.test(key)) {
    throw new Error(
      `Invalid metafield identifier "${input}". Expected namespace.key.`,
    );
  }

  return { key, namespace };
}

export function parseMetafieldSetEntry(input: string): {
  key: string;
  namespace: string;
  type: string;
  value: string;
} {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("--entry values must be non-empty.");
  }

  const firstColon = trimmed.indexOf(":");
  const secondColon = trimmed.indexOf(":", firstColon + 1);

  if (firstColon <= 0 || secondColon <= firstColon + 1) {
    throw new Error(
      `Invalid --entry value "${input}". Expected namespace.key:type:value.`,
    );
  }

  const identifier = trimmed.slice(0, firstColon);
  const type = trimmed.slice(firstColon + 1, secondColon).trim();
  const value = trimmed.slice(secondColon + 1).trim();
  const { key, namespace } = parseMetafieldIdentifier(identifier);

  if (!type || !value) {
    throw new Error(
      `Invalid --entry value "${input}". Expected namespace.key:type:value.`,
    );
  }

  return {
    key,
    namespace,
    type,
    value,
  };
}

export function buildMetafieldsSetInput(
  ownerId: string,
  entries: string[],
): Array<{ key: string; namespace: string; ownerId: string; type: string; value: string }> {
  if (entries.length === 0) {
    throw new Error("Nothing to set. Pass at least one --entry.");
  }

  if (entries.length > MAX_METAFIELD_BATCH_SIZE) {
    throw new Error(
      `Shopify allows at most ${MAX_METAFIELD_BATCH_SIZE} metafields per request.`,
    );
  }

  return entries.map((entry) => ({
    ...parseMetafieldSetEntry(entry),
    ownerId,
  }));
}

export function buildMetafieldsDeleteInput(
  ownerId: string,
  identifiers: string[],
): Array<{ key: string; namespace: string; ownerId: string }> {
  if (identifiers.length === 0) {
    throw new Error("Nothing to delete. Pass at least one --identifier.");
  }

  if (identifiers.length > MAX_METAFIELD_BATCH_SIZE) {
    throw new Error(
      `Shopify allows at most ${MAX_METAFIELD_BATCH_SIZE} metafields per request.`,
    );
  }

  return identifiers.map((identifier) => ({
    ...parseMetafieldIdentifier(identifier),
    ownerId,
  }));
}

function normalizeOptionalNamespace(input?: string): string | undefined {
  const trimmed = input?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/\s/.test(trimmed)) {
    throw new Error("--namespace must not contain spaces.");
  }

  return trimmed;
}

function collectRepeatedOption(value: string, previous?: string[]): string[] {
  return [...(previous ?? []), value];
}
