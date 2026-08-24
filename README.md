# Lynn Renezeder Fractional HR Consulting

Single-page static landing-page implementation for Lynn Renezeder — Fractional HR Consulting.

The approved plan and verification contract live in [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md). The color/type source of truth lives in [color_palette_and_font.txt](color_palette_and_font.txt).

## Local preview

This site has no package dependencies. Build the same clean static asset bundle used by Cloudflare Workers, then serve it from the generated directory:

    node build.mjs
    py -m http.server 4173 --directory dist

Then open http://127.0.0.1:4173.

To preview directly from the repository root during content work, you can also run:

    py -m http.server 4173

## Cloudflare Workers previews

The repository is configured as one asset-only Worker named `lynn-landing-page`. `build.mjs` copies only the public site files into `dist/`; project documentation and source-control files are not included in the deployment.

Workers Builds should use these commands:

    Build command: None
    Production deploy command: node build.mjs && npx wrangler deploy
    Non-production version command: node build.mjs && npx wrangler versions upload

The deploy and version commands build `dist/` themselves so each deployment is self-contained even when Workers Builds omits the separate build step.

`main` is the production branch. Enable non-production branch builds for `scrolling-reveal` and `floating-card`. Each successful non-production build creates a Worker version preview and a stable branch preview alias without changing production. Preview URLs remain enabled in `wrangler.jsonc`.

## Current form behavior

The Contact Us form intentionally performs client-side validation only. It does not send data and explicitly tells visitors that protected delivery is not connected. The later Cloudflare phase must add bot protection, server-side validation, rate limiting, delivery handling, and real accessible success/failure feedback before any public launch.

## Preview SEO behavior

The page is intentionally marked noindex, nofollow until a production domain exists. Before production, replace the preview SEO configuration with the canonical URL, robots/sitemap configuration, Open Graph image metadata, and approved Organization JSON-LD described in the implementation specification.

## Verification checklist

- Test desktop and responsive layouts at 320, 375, 768, 1024, and 1440 CSS pixels.
- Test keyboard navigation, focus states, form validation, FAQ controls, menu controls, testimonial controls, and the service carousel.
- Test prefers-reduced-motion and the backdrop-filter fallback. For a repeatable local reduced-motion check, open http://127.0.0.1:4173/?motion=reduce.
- Inspect the browser console and network panel for errors, rejected promises, and failed required assets.
- Run accessibility, performance, and SEO audits before release.

## Important launch gates

- Replace or remove every Sample testimonial — replace before launch card.
- Approve all credentials, service copy, FAQ copy, and metadata.
- Add the separate bot-protected form backend.
- Remove preview indexing restrictions only after the production domain is configured and verified.
