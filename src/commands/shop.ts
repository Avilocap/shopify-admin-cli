import { Command } from "commander";

import { ShopifyClient } from "../client.js";
import { resolveStore } from "../config.js";
import { SHOP_INFO_QUERY } from "../graphql/shop.js";
import type { OutputFormat } from "../types.js";
import { printJson, printTable } from "../utils/output.js";

interface ShopInfoResponse {
  shop: {
    currencyCode: string;
    email: string;
    myshopifyDomain: string;
    name: string;
    plan: {
      displayName: string;
    } | null;
  };
}

interface ShopInfoOptions {
  format: OutputFormat;
}

export function registerShopCommands(program: Command): void {
  const shop = program.command("shop").description("Read shop information");

  shop
    .command("info")
    .description("Show basic shop information")
    .option("--format <format>", "table or json", "table")
    .addHelpText(
      "after",
      `
Examples:
  store-manager shop info
  store-manager shop info --store main --format json

Returns:
  name, email, myshopify domain, plan and currency for the selected store.
      `,
    )
    .action(async (options: ShopInfoOptions, command: Command) => {
      const storeAlias = command.optsWithGlobals().store as string | undefined;
      const store = await resolveStore(storeAlias);
      const client = new ShopifyClient({ store });
      const data = await client.query<ShopInfoResponse>({
        query: SHOP_INFO_QUERY,
      });

      if (options.format === "json") {
        printJson(data.shop);
        return;
      }

      printTable(
        [
          {
            name: data.shop.name,
            email: data.shop.email,
            domain: data.shop.myshopifyDomain,
            plan: data.shop.plan?.displayName ?? "",
            currency: data.shop.currencyCode,
          },
        ],
        ["name", "email", "domain", "plan", "currency"],
      );
    });
}
