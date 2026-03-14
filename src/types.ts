export type OutputFormat = "json" | "table";

export interface StoreConfig {
  name?: string;
  domain: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export interface AppConfig {
  stores: Record<string, StoreConfig>;
  defaultStore?: string;
}

export interface StoreReference {
  alias: string;
  config: StoreConfig;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

export interface GraphQlError {
  message: string;
}

export interface GraphQlUserError {
  field?: string[];
  message: string;
}

export interface GraphQlEnvelope<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface ProductListItem {
  id: string;
  handle: string;
  title: string;
  status: string;
  vendor: string;
  productType: string;
  totalInventory: number | null;
}

export interface ProductVariantItem {
  id: string;
  title: string;
  sku: string | null;
  price: string | null;
  inventoryQuantity: number | null;
}
