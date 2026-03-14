#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";

import { registerConfigCommands } from "./commands/config.js";
import { registerProductCommands } from "./commands/products.js";
import { registerShopCommands } from "./commands/shop.js";

const program = new Command();

program
  .name("store-manager")
  .description("CLI privada para gestionar tiendas Shopify")
  .version("0.1.0")
  .option("--store <alias>", "Configured store alias");

registerConfigCommands(program);
registerShopCommands(program);
registerProductCommands(program);

program.showHelpAfterError();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
  process.exitCode = 1;
}
