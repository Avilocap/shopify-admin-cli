import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getConfigFilePath, loadConfig, normalizeDomain } from "./config.js";

const originalHome = process.env.HOME;

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
    return;
  }

  process.env.HOME = originalHome;
});

describe("normalizeDomain", () => {
  it("removes protocol, trailing slash and upper casing", () => {
    expect(normalizeDomain("HTTPS://My-Store.myshopify.com/")).toBe(
      "my-store.myshopify.com",
    );
  });
});

describe("loadConfig", () => {
  it("migrates the legacy config file to the new location", async () => {
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "shopfleet-config-"));
    process.env.HOME = tempHome;

    const legacyDir = path.join(tempHome, ".store-manager");
    const legacyFile = path.join(legacyDir, "stores.json");

    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      legacyFile,
      `${JSON.stringify({
        stores: {
          main: {
            domain: "main-store.myshopify.com",
            accessToken: "shpat_test",
          },
        },
        defaultStore: "main",
      })}\n`,
      "utf8",
    );

    const config = await loadConfig();
    const migratedRaw = await readFile(getConfigFilePath(), "utf8");

    expect(config.defaultStore).toBe("main");
    expect(config.stores.main?.domain).toBe("main-store.myshopify.com");
    expect(JSON.parse(migratedRaw)).toEqual(config);
    await expect(readFile(legacyFile, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });

    await rm(tempHome, { force: true, recursive: true });
  });
});
