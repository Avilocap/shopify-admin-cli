# Store Manager

CLI privada para gestionar tiendas Shopify desde terminal.

## Estado actual

MVP en construccion con foco en:

- configuracion multi-tienda
- autenticacion contra Shopify Admin GraphQL
- `shop info`
- `products list`
- `products get`

## Requisitos

- Node.js 20 o superior
- Una app creada en Shopify Dev Dashboard e instalada en cada tienda
- Credenciales por tienda:
  - `domain` (`*.myshopify.com`, no el dominio publico)
  - `clientId`
  - `clientSecret`

Tambien se admite `accessToken` legacy de forma opcional para tiendas con apps antiguas.

## Instalar dependencias

```bash
npm install
```

## Desarrollo

```bash
npm run dev -- --help
```

## Build

```bash
npm run build
```

## Configuracion de tiendas

La CLI guarda la configuracion en:

```text
~/.store-manager/stores.json
```

Ejemplo:

```json
{
  "stores": {
    "main": {
      "name": "Main Store",
      "domain": "main-store.myshopify.com",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret"
    }
  },
  "defaultStore": "main"
}
```

## Primeros comandos

```bash
store-manager config add main --domain main-store.myshopify.com --client-id xxx --client-secret yyy
store-manager config list
store-manager shop info
store-manager products list --limit 10
store-manager products search "corona"
store-manager products get gid://shopify/Product/1234567890
store-manager products get 1234567890
store-manager products get paso-macarena-miniatura --handle
```

## API version

Por defecto se usa `2026-01`. Se puede sobreescribir con:

```bash
SHOPIFY_API_VERSION=2026-01 store-manager shop info
```

## Productos

`products list` soporta filtros sencillos:

```bash
store-manager products list --vendor Pichardo --type Pasito --status active
store-manager products list --query 'tag:"miniatura" status:active' --sort updated-at
```

`products search` usa la busqueda por defecto de Shopify y ordena por relevancia.
