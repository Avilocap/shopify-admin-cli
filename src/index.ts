#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";

import { registerAnalyticsCommands } from "./commands/analytics.js";
import { registerCollectionCommands } from "./commands/collections.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerContentCommands } from "./commands/content.js";
import { registerCustomerCommands } from "./commands/customers.js";
import { registerGiftCardCommands } from "./commands/gift-cards.js";
import { registerFulfillmentCommands } from "./commands/fulfillment.js";
import { registerDiscountCommands } from "./commands/discounts.js";
import { registerFinancialCommands } from "./commands/financial.js";
import { registerInventoryCommands } from "./commands/inventory.js";
import { registerMetafieldCommands } from "./commands/metafields.js";
import { registerOrderCommands } from "./commands/orders.js";
import { registerProductCommands } from "./commands/products.js";
import { registerShopCommands } from "./commands/shop.js";

const program = new Command();

program
  .name("shopfleet")
  .description("Private CLI for managing Shopify stores")
  .version("0.1.9")
  .option("--store <alias>", "Configured store alias");

registerConfigCommands(program);
registerShopCommands(program);
registerAnalyticsCommands(program);
registerProductCommands(program);
registerOrderCommands(program);
registerCustomerCommands(program);
registerGiftCardCommands(program);
registerContentCommands(program);
registerInventoryCommands(program);
registerMetafieldCommands(program);
registerCollectionCommands(program);
registerFulfillmentCommands(program);
registerDiscountCommands(program);
registerFinancialCommands(program);

program.showHelpAfterError();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
  process.exitCode = 1;
}
