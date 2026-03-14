import chalk from "chalk";
import { Command } from "commander";

import {
  addStore,
  getConfigFilePath,
  loadConfig,
  removeStore,
  setDefaultStore,
} from "../config.js";
import { printTable } from "../utils/output.js";

interface AddStoreOptions {
  clientId?: string;
  clientSecret?: string;
  domain: string;
  name?: string;
  token?: string;
}

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage store configuration");

  config
    .command("add")
    .description("Add a store")
    .argument("<alias>", "Store alias")
    .requiredOption(
      "--domain <domain>",
      "Shopify admin domain, e.g. my-shop.myshopify.com",
    )
    .option("--name <name>", "Display name")
    .option("--client-id <clientId>", "Dev Dashboard client ID")
    .option("--client-secret <clientSecret>", "Dev Dashboard client secret")
    .option("--token <token>", "Legacy Admin API access token")
    .addHelpText(
      "after",
      `
Examples:
  shopfleet config add main --domain my-shop.myshopify.com --client-id xxx --client-secret yyy
  shopfleet config add legacy --domain old-shop.myshopify.com --token shpat_xxx

Notes:
  --domain must be the Shopify admin domain (*.myshopify.com), not the public storefront domain.
      `,
    )
    .action(async (alias: string, options: AddStoreOptions) => {
      const hasLegacyToken = Boolean(options.token);
      const hasClientCredentials = Boolean(
        options.clientId && options.clientSecret,
      );

      if (!hasLegacyToken && !hasClientCredentials) {
        throw new Error(
          "Pass either --token or both --client-id and --client-secret.",
        );
      }

      await addStore(alias, {
        accessToken: options.token,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        domain: options.domain,
        name: options.name,
      });

      process.stdout.write(
        `${chalk.green("Store added:")} ${alias}\n${chalk.dim(getConfigFilePath())}\n`,
      );
    });

  config
    .command("remove")
    .description("Remove a store")
    .argument("<alias>", "Store alias")
    .addHelpText(
      "after",
      `
Example:
  shopfleet config remove main
      `,
    )
    .action(async (alias: string) => {
      await removeStore(alias);
      process.stdout.write(`${chalk.green("Store removed:")} ${alias}\n`);
    });

  config
    .command("list")
    .description("List configured stores")
    .addHelpText(
      "after",
      `
Example:
  shopfleet config list
      `,
    )
    .action(async () => {
      const configData = await loadConfig();
      const rows = Object.entries(configData.stores).map(([alias, store]) => ({
        alias,
        default: configData.defaultStore === alias ? "yes" : "",
        name: store.name ?? "",
        domain: store.domain,
        auth: store.accessToken ? "legacy-token" : "client-credentials",
      }));

      printTable(rows, ["alias", "default", "name", "domain", "auth"]);
      process.stdout.write(`${chalk.dim(getConfigFilePath())}\n`);
    });

  config
    .command("set-default")
    .description("Set the default store")
    .argument("<alias>", "Store alias")
    .addHelpText(
      "after",
      `
Example:
  shopfleet config set-default main
      `,
    )
    .action(async (alias: string) => {
      await setDefaultStore(alias);
      process.stdout.write(`${chalk.green("Default store:")} ${alias}\n`);
    });
}
