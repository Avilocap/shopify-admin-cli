import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AppConfig, StoreConfig, StoreReference } from "./types.js";

const CONFIG_DIR_NAME = ".store-manager";
const CONFIG_FILE_NAME = "stores.json";
const MYSHOPIFY_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function getConfigDirPath(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

export function getConfigFilePath(): string {
  return path.join(getConfigDirPath(), CONFIG_FILE_NAME);
}

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(getConfigDirPath(), { recursive: true });
}

function createEmptyConfig(): AppConfig {
  return {
    stores: {},
  };
}

function validateStoreConfig(store: StoreConfig): void {
  if (!store.domain) {
    throw new Error("Store domain is required.");
  }

  if (!MYSHOPIFY_DOMAIN_PATTERN.test(store.domain)) {
    throw new Error(
      `Store domain must be the Shopify admin domain (*.myshopify.com). Received "${store.domain}".`,
    );
  }

  const hasLegacyToken = Boolean(store.accessToken);
  const hasClientCredentials = Boolean(store.clientId && store.clientSecret);

  if (!hasLegacyToken && !hasClientCredentials) {
    throw new Error(
      "Store config must include either accessToken or both clientId and clientSecret.",
    );
  }
}

export async function loadConfig(): Promise<AppConfig> {
  const filePath = getConfigFilePath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AppConfig;

    return {
      stores: parsed.stores ?? {},
      defaultStore: parsed.defaultStore,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyConfig();
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${filePath}`);
    }

    throw error;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  if (config.defaultStore && !config.stores[config.defaultStore]) {
    throw new Error(`Default store "${config.defaultStore}" does not exist.`);
  }

  for (const store of Object.values(config.stores)) {
    validateStoreConfig(store);
  }

  await ensureConfigDir();

  await writeFile(getConfigFilePath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function addStore(
  alias: string,
  storeConfig: StoreConfig,
): Promise<AppConfig> {
  const config = await loadConfig();

  if (config.stores[alias]) {
    throw new Error(`Store alias "${alias}" already exists.`);
  }

  config.stores[alias] = {
    ...storeConfig,
    domain: normalizeDomain(storeConfig.domain),
  };

  if (!config.defaultStore) {
    config.defaultStore = alias;
  }

  await saveConfig(config);

  return config;
}

export async function removeStore(alias: string): Promise<AppConfig> {
  const config = await loadConfig();

  if (!config.stores[alias]) {
    throw new Error(`Store alias "${alias}" does not exist.`);
  }

  delete config.stores[alias];

  if (config.defaultStore === alias) {
    config.defaultStore = Object.keys(config.stores)[0];
  }

  if (Object.keys(config.stores).length === 0) {
    config.defaultStore = undefined;
  }

  await saveConfig(config);

  return config;
}

export async function setDefaultStore(alias: string): Promise<AppConfig> {
  const config = await loadConfig();

  if (!config.stores[alias]) {
    throw new Error(`Store alias "${alias}" does not exist.`);
  }

  config.defaultStore = alias;
  await saveConfig(config);

  return config;
}

export async function resolveStore(alias?: string): Promise<StoreReference> {
  const config = await loadConfig();
  const effectiveAlias = alias ?? config.defaultStore;

  if (!effectiveAlias) {
    throw new Error(
      "No store selected. Add a store with `store-manager config add ...` first.",
    );
  }

  const store = config.stores[effectiveAlias];

  if (!store) {
    throw new Error(`Store alias "${effectiveAlias}" does not exist.`);
  }

  validateStoreConfig(store);

  return {
    alias: effectiveAlias,
    config: {
      ...store,
      domain: normalizeDomain(store.domain),
    },
  };
}

export async function resetConfigForTests(): Promise<void> {
  await rm(getConfigDirPath(), { force: true, recursive: true });
}
