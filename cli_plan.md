# Store Manager CLI — Plan de Implementación

CLI de gestión multi-tienda para Shopify vía GraphQL Admin API.

## Estado actual

### Ya implementado

- `config add`
- `config remove`
- `config list`
- `config set-default`
- `shop info`
- `products list`
- `products get`
- `products search`

### En progreso

- endurecimiento de ayuda CLI y documentacion para agentes

### Pendiente

- resto del catalogo de comandos

## 1. Stack Técnico

| Decisión          | Elección                | Razón                                                    |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| Lenguaje          | TypeScript              | Tipado fuerte, autocompletado, ideal para GraphQL        |
| Runtime           | Node.js (>=20)          | Ecosistema Shopify nativo                                |
| CLI framework     | Commander.js            | Maduro, subcomandos, flags y help extensible             |
| GraphQL client    | `fetch` nativo          | Menos dependencias, suficiente para el MVP               |
| Output            | cli-table3 + chalk       | Tablas legibles y colores en terminal                    |
| Config            | archivo JSON en home dir | Simple de inspeccionar, depurar y compartir entre agentes |
| Package manager   | npm                     | Estándar                                                 |
| Build             | tsup                    | Bundler rápido para CLI en TS                            |
| Testing           | vitest                  | Rápido, compatible con TS out-of-the-box                 |

## 2. Estructura del Proyecto

```
store-manager/
├── src/
│   ├── index.ts                  # Entry point CLI
│   ├── client.ts                 # Cliente GraphQL (multi-store)
│   ├── config.ts                 # Gestión de configuración y tiendas
│   ├── types.ts                  # Tipos base
│   ├── commands/
│   │   ├── products.ts           # Comandos de productos
│   │   ├── orders.ts             # Comandos de pedidos
│   │   ├── customers.ts          # Comandos de clientes
│   │   ├── inventory.ts          # Comandos de inventario
│   │   ├── collections.ts        # Comandos de colecciones
│   │   ├── discounts.ts          # Comandos de descuentos
│   │   ├── fulfillment.ts        # Comandos de fulfillment
│   │   ├── financial.ts          # Comandos financieros
│   │   ├── gift-cards.ts         # Comandos de tarjetas regalo
│   │   ├── content.ts            # Páginas y blogs
│   │   ├── webhooks.ts           # Comandos de webhooks
│   │   ├── draft-orders.ts       # Borradores de pedidos
│   │   ├── metafields.ts         # Metafields y metaobjects
│   │   ├── analytics.ts          # Reportes y analytics
│   │   ├── shop.ts               # Info de tienda, locations, markets
│   │   └── redirects.ts          # Redirecciones URL
│   ├── graphql/
│   │   ├── products.ts           # Queries/mutations de productos
│   │   ├── orders.ts             # Queries de pedidos
│   │   ├── customers.ts          # Queries de clientes
│   │   ├── inventory.ts          # Queries/mutations de inventario
│   │   ├── collections.ts        # Queries de colecciones
│   │   ├── discounts.ts          # Queries/mutations de descuentos
│   │   ├── fulfillment.ts        # Queries/mutations de fulfillment
│   │   ├── financial.ts          # Queries de transacciones/refunds
│   │   ├── gift-cards.ts         # Queries/mutations de gift cards
│   │   ├── content.ts            # Queries/mutations de páginas/blogs
│   │   ├── webhooks.ts           # Queries/mutations de webhooks
│   │   ├── draft-orders.ts       # Queries/mutations de borradores
│   │   ├── metafields.ts         # Queries/mutations de metafields
│   │   ├── analytics.ts          # Queries de analytics
│   │   └── shop.ts               # Queries de tienda
│   └── utils/
│       ├── output.ts             # Formateo de tablas y JSON
│       └── pagination.ts         # Helper para cursor pagination
├── package.json
├── tsconfig.json
├── AGENTS.md
├── CLAUDE.md
├── .gitignore
└── README.md
```

## 3. Configuración Multi-Tienda

### Archivo `~/.store-manager/stores.json`

```json
{
  "stores": {
    "tienda1": {
      "name": "Mi Tienda Principal",
      "domain": "mi-tienda.myshopify.com",
      "clientId": "client_id_xxxxx",
      "clientSecret": "client_secret_xxxxx"
    },
    "tienda2": {
      "name": "Mi Segunda Tienda",
      "domain": "otra-tienda.myshopify.com",
      "clientId": "client_id_yyyyy",
      "clientSecret": "client_secret_yyyyy"
    }
  },
  "defaultStore": "tienda1"
}
```

Notas:

- `domain` debe ser siempre el dominio admin `*.myshopify.com`, no el dominio público.
- El flujo principal usa `clientId` + `clientSecret`.
- `accessToken` legacy se mantiene solo como compatibilidad opcional para apps antiguas.

### Uso del flag `--store`

```bash
# Usa la tienda por defecto
store-manager products list

# Especifica tienda
store-manager products list --store tienda2

# Cambia tienda por defecto
store-manager config set-default tienda2
```

### Comandos de configuración

```bash
store-manager config add <alias> --domain <domain> --client-id <clientId> --client-secret <clientSecret>
store-manager config remove <alias>
store-manager config list
store-manager config set-default <alias>
```

## 4. Catálogo Completo de Operaciones

Referencia: operaciones del MCP @ajackus/shopify-mcp-server (47 tools) + extras útiles.

### 4.1 Productos (6 comandos)

| Estado | Comando                             | Operación GraphQL         | Descripción                          |
| ------ | ----------------------------------- | ------------------------- | ------------------------------------ |
| ✅     | `products list`                     | `products` query          | Listar productos con filtros         |
| ✅     | `products get <id>`                 | `product` query           | Detalle de un producto               |
| ⏳     | `products create`                   | `productCreate` mutation  | Crear producto                       |
| ⏳     | `products update <id>`              | `productUpdate` mutation  | Actualizar producto                  |
| ⏳     | `products delete <id>`              | `productDelete` mutation  | Eliminar producto                    |
| ✅     | `products search <query>`           | `products` query + filtro | Buscar por título, SKU, vendor, tipo |

**Flags comunes:** `--limit`, `--after`, `--sort`, `--reverse`, `--status`, `--vendor`, `--type`, `--tag`
**Flags create/update:** `--title`, `--description`, `--vendor`, `--type`, `--tags`, `--status`
**Output actual:** `--format table|json`

### 4.2 Pedidos (4 comandos)

| Comando                                | Operación GraphQL | Descripción                     |
| -------------------------------------- | ----------------- | ------------------------------- |
| `orders list`                          | `orders` query    | Listar pedidos con filtros      |
| `orders get <id>`                      | `order` query     | Detalle de un pedido            |
| `orders transactions <id>`             | `order` query     | Transacciones de un pedido      |
| `orders cancel <id>`                   | `orderCancel`     | Cancelar pedido                 |

**Flags:** `--status`, `--financial-status`, `--fulfillment-status`, `--from`, `--to`, `--limit`, `--cursor`

### 4.3 Clientes (4 comandos)

| Comando                                | Operación GraphQL     | Descripción                       |
| -------------------------------------- | --------------------- | --------------------------------- |
| `customers list`                       | `customers` query     | Listar clientes                   |
| `customers get <id>`                   | `customer` query      | Detalle de un cliente             |
| `customers search <query>`             | `customers` + filtro  | Buscar por nombre, email, teléfono|
| `customers orders <id>`               | `customer.orders`     | Pedidos de un cliente             |

**Flags:** `--limit`, `--cursor`, `--sort`, `--reverse`

### 4.4 Inventario (3 comandos)

| Comando                                | Operación GraphQL               | Descripción                |
| -------------------------------------- | ------------------------------- | -------------------------- |
| `inventory levels`                     | `inventoryItems` query          | Niveles de inventario      |
| `inventory adjust`                     | `inventoryAdjustQuantities`     | Ajustar cantidad           |
| `inventory locations`                  | `locations` query               | Listar ubicaciones         |

**Flags adjust:** `--item-id`, `--location-id`, `--quantity`

### 4.5 Colecciones (3 comandos)

| Comando                                | Operación GraphQL          | Descripción                      |
| -------------------------------------- | -------------------------- | -------------------------------- |
| `collections list`                     | `collections` query        | Listar colecciones               |
| `collections get <id>`                 | `collection` query         | Detalle de colección             |
| `collections products <id>`            | `collection.products`      | Productos de una colección       |

**Flags:** `--limit`, `--cursor`, `--type smart|custom`

### 4.6 Descuentos (3 comandos)

| Comando                                | Operación GraphQL                    | Descripción              |
| -------------------------------------- | ------------------------------------ | ------------------------ |
| `discounts list`                       | `discountNodes` query                | Listar descuentos        |
| `discounts get <id>`                   | `discountNode` query                 | Detalle de descuento     |
| `discounts create`                     | `discountCodeBasicCreate`            | Crear código descuento   |

**Flags create:** `--title`, `--code`, `--starts`, `--ends`, `--usage-limit`, `--percentage`, `--amount`, `--once-per-customer`

### 4.7 Fulfillment (3 comandos)

| Comando                                | Operación GraphQL                    | Descripción                    |
| -------------------------------------- | ------------------------------------ | ------------------------------ |
| `fulfillment list`                     | `fulfillmentOrders` query            | Listar órdenes de fulfillment  |
| `fulfillment create`                   | `fulfillmentCreateV2`                | Crear fulfillment              |
| `fulfillment tracking <id>`            | `fulfillmentTrackingInfoUpdate`      | Actualizar tracking            |

**Flags create:** `--order-id`, `--line-items`, `--tracking-number`, `--tracking-url`, `--carrier`, `--notify`

### 4.8 Financiero (3 comandos)

| Comando                                | Operación GraphQL          | Descripción                |
| -------------------------------------- | -------------------------- | -------------------------- |
| `financial transactions <order-id>`    | `order.transactions`       | Transacciones de un pedido |
| `financial refund <order-id>`          | `refundCreate`             | Crear reembolso            |
| `financial summary`                    | Calculado desde orders     | Resumen financiero         |

**Flags refund:** `--line-items`, `--shipping-amount`, `--note`, `--notify`, `--restock`

### 4.9 Tarjetas Regalo (3 comandos)

| Comando                                | Operación GraphQL          | Descripción                |
| -------------------------------------- | -------------------------- | -------------------------- |
| `gift-cards list`                      | `giftCards` query          | Listar tarjetas regalo     |
| `gift-cards get <id>`                  | `giftCard` query           | Detalle de tarjeta         |
| `gift-cards create`                    | `giftCardCreate`           | Crear tarjeta regalo       |

**Flags create:** `--value`, `--code`, `--note`, `--expires`, `--recipient-email`, `--recipient-message`

### 4.10 Contenido (4 comandos)

| Comando                                | Operación GraphQL          | Descripción                |
| -------------------------------------- | -------------------------- | -------------------------- |
| `pages list`                           | `pages` query (REST/GQL)   | Listar páginas             |
| `pages create`                         | `pageCreate`               | Crear página               |
| `blogs list`                           | `blogs` query              | Listar blogs               |
| `blogs create-article`                 | `articleCreate`            | Crear artículo de blog     |

### 4.11 Webhooks (3 comandos)

| Comando                                | Operación GraphQL                    | Descripción              |
| -------------------------------------- | ------------------------------------ | ------------------------ |
| `webhooks list`                        | `webhookSubscriptions` query         | Listar webhooks          |
| `webhooks create`                      | `webhookSubscriptionCreate`          | Crear webhook            |
| `webhooks delete <id>`                 | `webhookSubscriptionDelete`          | Eliminar webhook         |

### 4.12 Borradores de Pedido (3 comandos)

| Comando                                | Operación GraphQL          | Descripción                    |
| -------------------------------------- | -------------------------- | ------------------------------ |
| `draft-orders list`                    | `draftOrders` query        | Listar borradores              |
| `draft-orders get <id>`               | `draftOrder` query         | Detalle de borrador            |
| `draft-orders create`                  | `draftOrderCreate`         | Crear borrador de pedido       |

### 4.13 Metafields y Metaobjects (4 comandos)

| Comando                                | Operación GraphQL                | Descripción                |
| -------------------------------------- | -------------------------------- | -------------------------- |
| `metafields get <owner-id>`            | `resource.metafields` query      | Metafields de un recurso   |
| `metafields set`                       | `metafieldsSet`                  | Establecer metafield       |
| `metaobjects list <type>`             | `metaobjects` query              | Listar metaobjects         |
| `metaobjects create`                   | `metaobjectCreate`               | Crear metaobject           |

### 4.14 Analytics y Reportes (10 comandos)

| Comando                                | Descripción                                    |
| -------------------------------------- | ---------------------------------------------- |
| `analytics sales`                      | Reporte de ventas (por día/semana/mes)          |
| `analytics products`                   | Rendimiento de productos (ventas, vistas)       |
| `analytics customers`                  | Análisis de clientes (nuevos, recurrentes, LTV) |
| `analytics inventory`                  | Reporte de inventario + forecasting             |
| `analytics marketing`                  | Rendimiento de campañas por canal               |
| `analytics financial`                  | Resumen financiero (revenue, gastos, profit)    |
| `analytics conversion`                 | Funnel de conversión                            |
| `analytics abandonment`               | Carritos y checkouts abandonados                |
| `analytics traffic`                    | Tráfico web y visitantes                        |
| `analytics custom`                     | Reporte personalizado                           |

**Flags comunes:** `--from`, `--to`, `--granularity hour|day|week|month|quarter|year`

### 4.15 Tienda y Configuración (4 comandos)

| Estado | Comando                                | Operación GraphQL          | Descripción                |
| ------ | -------------------------------------- | -------------------------- | -------------------------- |
| ✅     | `shop info`                            | `shop` query               | Info general de la tienda  |
| ⏳     | `shop locations`                       | `locations` query          | Ubicaciones                |
| ⏳     | `shop markets`                         | `markets` query            | Mercados configurados      |
| ⏳     | `shop themes`                          | `themes` query             | Temas instalados           |

### 4.16 Otros (3 comandos)

| Comando                                | Operación GraphQL          | Descripción                |
| -------------------------------------- | -------------------------- | -------------------------- |
| `redirects create`                     | `urlRedirectCreate`        | Crear redirección URL      |
| `price-rules list`                     | `priceRules` query         | Listar reglas de precio    |
| `abandoned-checkouts list`             | `abandonedCheckouts` query | Checkouts abandonados      |

## 5. Funcionalidades Transversales

### 5.1 Output multi-formato

Comandos implementados soportan `--format`:

```bash
store-manager products list --format table   # (default) tabla bonita
store-manager products list --format json    # JSON crudo
```

`csv` sigue planificado, pero no está implementado todavía.

### 5.2 Paginación manual

```bash
store-manager products list --limit 50           # primeros 50
store-manager products list --after <cursor>      # página siguiente manual
```

`--all` queda diferido hasta que haya una necesidad real.

### 5.3 Confirmación en operaciones destructivas

```bash
store-manager products delete 123456
# ⚠️  ¿Eliminar producto "Camiseta Azul" (ID: 123456) de tienda1? (y/N)
```

### 5.4 Output verboso

```bash
store-manager products list -v   # Muestra la query GraphQL ejecutada
```

## 6. Fases de Implementación

### Fase 1 — Fundación (Primero)
1. ✅ Inicializar proyecto (package.json, tsconfig, tsup)
2. ✅ Sistema de configuración multi-tienda (`config` commands)
3. ✅ Cliente GraphQL reutilizable con auth
4. ✅ Sistema de output (table/json)
5. ✅ Helper de paginación por cursor manual
6. ✅ Comando `shop info` como smoke test

### Fase 2 — Lectura (Core de gestión)
7. ✅ `products list/get/search`
8. ⏳ `orders list/get/transactions`
9. ⏳ `customers list/get/search/orders`
10. ⏳ `inventory levels/locations`
11. ⏳ `collections list/get/products`

### Fase 3 — Escritura (Operaciones de modificación)
12. `products create/update/delete`
13. `inventory adjust`
14. `discounts list/get/create`
15. `fulfillment list/create/tracking`
16. `draft-orders list/get/create`

### Fase 4 — Analytics
17. `analytics sales/products/customers`
18. `analytics financial/inventory`
19. `analytics conversion/abandonment/traffic`
20. `analytics marketing/custom`

### Fase 5 — Extras
21. `gift-cards list/get/create`
22. `pages list/create`, `blogs list/create-article`
23. `webhooks list/create/delete`
24. `metafields get/set`, `metaobjects list/create`
25. `redirects create`, `price-rules list`, `abandoned-checkouts list`
26. `shop markets/themes`

## 7. Requisitos Previos (lo que necesito del usuario)

1. **Crear una app por tienda con el flujo actual de Shopify:**
   - Shopify Admin → `Settings > Apps`
   - `Develop apps`
   - `Build apps in Dev Dashboard`
   - Crear app en Dev Dashboard
   - Crear una versión
   - Añadir scopes de Admin API
   - Publicar la versión
   - Instalar la app en la tienda
   - Copiar `Client ID` y `Client secret`

2. **Scopes mínimos recomendados:**
   - MVP actual:
     - `read_products`
     - `read_inventory`
   - Para expansión futura:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_customers`
   - `read_inventory`, `write_inventory`
   - `read_discounts`, `write_discounts`
   - `read_fulfillments`, `write_fulfillments`
   - `read_gift_cards`, `write_gift_cards`
   - `read_content`, `write_content`
   - `read_themes`
   - `read_shipping`, `write_shipping`
   - `read_analytics`
   - `read_metaobject_definitions`, `write_metaobject_definitions`
   - `read_metaobjects`, `write_metaobjects`

3. **Datos necesarios por tienda:**
   - Dominio: `xxx.myshopify.com`
   - Client ID
   - Client secret
   - Alias para la CLI: ej. `tienda1`, `tienda2`

4. **Notas de autenticación:**
   - Con apps nuevas, la CLI obtiene el `access_token` mediante `client_credentials`
   - El token devuelto por Shopify caduca aproximadamente cada 24 horas
   - La CLI debe encargarse de pedirlo cuando haga falta; no se guarda manualmente

## 8. Total de Operaciones

| Categoría             | Comandos |
| --------------------- | -------- |
| Productos             | 6        |
| Pedidos               | 4        |
| Clientes              | 4        |
| Inventario            | 3        |
| Colecciones           | 3        |
| Descuentos            | 3        |
| Fulfillment           | 3        |
| Financiero            | 3        |
| Tarjetas Regalo       | 3        |
| Contenido             | 4        |
| Webhooks              | 3        |
| Borradores de Pedido  | 3        |
| Metafields/Metaobjects| 4        |
| Analytics             | 10       |
| Tienda/Config         | 4        |
| Otros                 | 3        |
| Config CLI            | 4        |
| **Total**             | **67**   |
