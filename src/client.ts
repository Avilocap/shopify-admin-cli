import type {
  GraphQlEnvelope,
  StoreReference,
  TokenResponse,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

const tokenCache = new Map<string, string>();

export interface ShopifyClientOptions {
  store: StoreReference;
  timeoutMs?: number;
}

export interface GraphQlRequestOptions {
  query: string;
  variables?: Record<string, unknown>;
}

export class ShopifyClient {
  private readonly store: StoreReference;
  private readonly timeoutMs: number;

  constructor(options: ShopifyClientOptions) {
    this.store = options.store;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async query<TData>(options: GraphQlRequestOptions): Promise<TData> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetchJson<GraphQlEnvelope<TData>>(
      this.getGraphQlEndpoint(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: options.query,
          variables: options.variables ?? {},
        }),
      },
    );

    if (response.errors?.length) {
      throw new Error(response.errors.map((error) => error.message).join("\n"));
    }

    if (!response.data) {
      throw new Error("Shopify API returned an empty response.");
    }

    return response.data;
  }

  private getGraphQlEndpoint(): string {
    return `https://${this.store.config.domain}/admin/api/${DEFAULT_API_VERSION}/graphql.json`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.store.config.accessToken) {
      return this.store.config.accessToken;
    }

    const cacheKey = `${this.store.alias}:${this.store.config.clientId}`;
    const cachedToken = tokenCache.get(cacheKey);

    if (cachedToken) {
      return cachedToken;
    }

    const clientId = this.store.config.clientId;
    const clientSecret = this.store.config.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error(
        `Store "${this.store.alias}" is missing credentials. Expected accessToken or clientId/clientSecret.`,
      );
    }

    const tokenResponse = await this.fetchJson<TokenResponse>(
      `https://${this.store.config.domain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }).toString(),
      },
    );

    tokenCache.set(cacheKey, tokenResponse.access_token);

    return tokenResponse.access_token;
  }

  private async fetchJson<TResponse>(
    input: string,
    init: RequestInit,
  ): Promise<TResponse> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        redirect: "manual",
        signal: abortController.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const redirectHint = location ? ` Redirect target: ${location}` : "";

        throw new Error(
          `Request was redirected. Store domain must use the Shopify admin domain (*.myshopify.com).${redirectHint}`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      const responseText = await response.text();

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Shopify API returned non-JSON content (${contentType || "unknown"}). Check that the store domain is the *.myshopify.com admin domain.`,
        );
      }

      const payload = responseText ? (JSON.parse(responseText) as TResponse) : null;

      if (!response.ok) {
        const errorMessage =
          this.extractErrorMessage(payload) ??
          `Request failed with status ${response.status}.`;

        throw new Error(errorMessage);
      }

      if (payload === null) {
        throw new Error("Shopify API returned an empty body.");
      }

      return payload;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Request timed out.");
      }

      if (error instanceof SyntaxError) {
        throw new Error("Shopify API returned invalid JSON.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractErrorMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    if ("error_description" in payload && typeof payload.error_description === "string") {
      return payload.error_description;
    }

    if ("error" in payload && typeof payload.error === "string") {
      return payload.error;
    }

    if ("errors" in payload && Array.isArray(payload.errors)) {
      const messages = payload.errors
        .map((entry) => {
          if (entry && typeof entry === "object" && "message" in entry) {
            return entry.message;
          }

          return null;
        })
        .filter((entry): entry is string => Boolean(entry));

      if (messages.length > 0) {
        return messages.join("\n");
      }
    }

    return undefined;
  }
}
