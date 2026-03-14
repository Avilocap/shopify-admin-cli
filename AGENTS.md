# AGENTS.md

Guia operativa para agentes que trabajen en este repositorio.

## Objetivo

Mantener una CLI privada de Shopify pequena, legible y facil de extender.

## Principios

- priorizar soluciones pequenas y mantenibles
- evitar abstracciones prematuras
- no introducir dependencias grandes para problemas pequenos
- mantener comportamiento explicito y nombres claros
- no abrir nuevas areas hasta cerrar el vertical actual

## Vertical actual

El MVP activo cubre:

- configuracion multi-tienda
- autenticacion Shopify con `clientId` y `clientSecret`
- compatibilidad opcional con `accessToken` legacy
- `shop info`
- `products list`
- `products get`

## Estructura esperada

- `src/index.ts`: entrada de la CLI
- `src/config.ts`: lectura y escritura de `~/.store-manager/stores.json`
- `src/client.ts`: token exchange y llamadas GraphQL
- `src/commands/*`: definicion de subcomandos
- `src/graphql/*`: queries GraphQL puras
- `src/utils/output.ts`: render de tabla y JSON

## Reglas de implementacion

- mantener el cliente HTTP en `fetch` nativo salvo necesidad clara
- fijar una `SHOPIFY_API_VERSION` por defecto y permitir override por env
- soportar tanto `clientId/clientSecret` como `accessToken` en config
- nunca imprimir secretos en logs o tablas
- no introducir analytics, webhooks o bulk operations en el MVP

## Reglas de documentacion

- escribir ayuda pensando en agentes, no en humanos con contexto implicito
- cada comando debe explicar con claridad que entrada espera
- cada comando debe indicar cuando espera un GID, un ID numerico o un handle
- cada comando debe incluir al menos un ejemplo realista en `--help`
- cuando un comando tenga una precondicion importante, debe aparecer en `--help`
- cuando cambie el contrato de un comando, actualizar a la vez codigo, `--help`, `README.md` y este archivo si aplica
- preferir lenguaje directo y operativo: que hace, que necesita, que devuelve
- evitar texto de marketing o descripciones vagas

## Convencion para ayuda CLI

Usar `addHelpText("after", ...)` en Commander para anadir:

1. una linea corta de contexto
2. ejemplos copiables
3. notas de formato o identificadores si hacen falta

Ejemplo de claridad correcta:

- `products get` debe dejar claro si acepta GID, ID numerico o `--handle`
- `config add` debe dejar claro que `--domain` tiene que ser `*.myshopify.com`

## Flujo de trabajo

1. Cambiar lo minimo necesario.
2. Compilar con `npm run build`.
3. Validar tipos con `npm run typecheck`.
4. Ejecutar tests si existen.
5. Actualizar documentacion cuando cambie el contrato.

## Documentacion espejo

`CLAUDE.md` debe apuntar a este mismo documento para evitar divergencia.
