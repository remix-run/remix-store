# Remix Store

Welcome to the Remix Store built on Hydrogen!

## Getting Started

### Install dependencies

```sh
npm install
```

## Local development

TODO: make this work without needing access to the Shopify

```bash
npm run dev
```

## Building for production

```bash
npm run build
```

### Connecting to the Shopify Store

If you've never setup the Hydrogen CLI, run the following command

```sh
npx shopify hydrogen shortcut
```

If you have access to the Shopify store, go ahead and link via hydrogen

```sh
h2 link
```

```sh
h2 pull
```

## Hero component

The [large banner](./app/components/hero.tsx) at the top of most pages has some implicit rules for how it picks videos/images

1. If the page is on the index route `/`, it will use the [featured collection](./app/lib/context.ts) to fetch a collection and display the "Featured Video" if one exists.
2. Collection pages -- Displays the title, description, and image for the collection. If the collection is the featured collection, the description/subtitle will be overridden with "FEATURED"
3. The hero component has a fallback image hardcoded in the component. We can leverage another metafield on pages if we want to override this for individual pages
