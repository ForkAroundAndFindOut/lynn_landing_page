# Safari QA preview release — 8 October 2026

Preview: https://codex-card-layout-safari-qa-lynn-landing-page.nrct6ycww6.workers.dev/?qa=1

Branch: codex/card-layout-safari-qa, forked from canonical revision 5c3b63d77af003f326483e083ae120c40969fa33. This release implements the approved investigation and local diagnostics, preserving card interaction and layout policy for review.

## Hosted validation

Functional release commit: 1ef26df88b6fa993199095fdab896eb0c5a29d49.
Cloudflare build: ed919106-43da-4be1-9c8c-0b56d54c1dd4, successful.
The alias served that revision and all 13 manifest hashes matched fetched asset bytes. See hosted-release.json.

- 10/10 hosted diagnostic checks passed.
- 14/14 hosted touch, link, wheel, preference, and fallback checks passed.
- 61/61 focused Node checks passed, including characterization of the reported recognition limitations.
- Local full interaction suite: 26/26. Canonical baseline: Chromium 19 layout checks, 18 wheel checks, and 1 resize characterization; Windows Chrome and Edge 14 comparative checks each.
- Independent code review findings were corrected and re-reviewed. Hosted diagnostics are opt-in at ?qa=1, bounded, and local to the tab. No remote telemetry or form values are collected.

The final evidence-only commit includes these hosted results and documentation corrections. It changes no public asset source. Its successful build and final alias revision will be checked again after push; the same asset hashes make the functional evidence above applicable without repeating unchanged tests.

## Isolation

The existing Git-connected workflow uploaded a Worker version for the new QA branch. No trigger configuration, production deployment, original branch, or original preview alias was changed. Local Wrangler upload lacked credentials; the configured build workflow supplied its own authentication.

integrity-after.json confirms all original local and remote branch heads, production HTML, and the three protected preview revisions/assets are unchanged. production-before.json and production-after.json confirm deployment ddc66df0-16e5-40ec-ad73-4674ac227f9a still routes 100% to version b19c9862-7fce-4372-9b27-aa4ee193189f.

## Outstanding native evidence

The exact physical iPhone fallback and Mac Safari trackpad cause remain unconfirmed. Follow DEVICE_CHECKS.md and share the local report; ordinary settings are scoped to this separate hostname. No Safari permission or security failure has been established. Native Safari, Firefox, trackpad momentum, pinch/selection, and a fresh Android comparison were unavailable here. The owner's earlier Android QA remains separate evidence.

Review QA-01 and QA-02 in FINDINGS.md before choosing gesture-boundary, layout-sizing, reduced-motion presentation, or queueing changes. Desktop entrance timing remains 80ms delay / 380ms duration.
