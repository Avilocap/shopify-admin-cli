#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";

import { registerCollectionCommands } from "./commands/collections.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerCustomerCommands } from "./commands/customers.js";
import { registerDiscountCommands } from "./commands/discounts.js";
import { registerFinancialCommands } from "./commands/financial.js";
import { registerInventoryCommands } from "./commands/inventory.js";
import { registerOrderCommands } from "./commands/orders.js";
import { registerProductCommands } from "./commands/products.js";
import { registerShopCommands } from "./commands/shop.js";

const program = new Command();

program
  .name("shopfleet")
  .description("Private CLI for managing Shopify stores")
  .version("0.1.0")
  .option("--store <alias>", "Configured store alias");

registerConfigCommands(program);
registerShopCommands(program);
registerProductCommands(program);
registerOrderCommands(program);
registerCustomerCommands(program);
registerInventoryCommands(program);
registerCollectionCommands(program);
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
