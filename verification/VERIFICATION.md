# Card-layout verification

Date: 2026-10-03 (America/Los_Angeles).

## Isolation

The POC is implemented in a managed worktree on the new `codex/card-layout` branch, based on `main` at `0b10b41b59e717da2cc6f83f9e950250541eac3d`. The original checkout remains on `main`. No production deploy or merge is part of this work.

Original local branch heads captured before implementation:

| Branch | Commit |
| --- | --- |
| main | `0b10b41b59e717da2cc6f83f9e950250541eac3d` |
| floating-card | `f5311c548a57cc409ef20773b6e45b17fdacf43e` |
| scrolling-reveal | `1733fa7bb7a5c53233da83df93b334ab78441611` |
| theme-2-pallette-1 | `e0b332ca07172745692d3e3060656ab0501acb64` |
| theme-2-pallette-1-heavy | `15c96a3d15e07d7f3505d3b51d1fac729e784fb1` |
| theme-2-pallette-2 | `de9cc08ed6feacc080ed3844bc925ce2aa1e8458` |

Existing remote branches are `main`, `floating-card`, and `scrolling-reveal`, with the same captured heads. The Cloudflare dashboard was checked: production branch is `main`, non-production builds are enabled, and the version command is `node build.mjs && npx wrangler versions upload`. These settings were not changed.

Production baseline: https://lynn-landing-page.nrct6ycww6.workers.dev/ returned HTTP 200. Its HTML SHA-256 (UTF-8 response content) before this work was `4e48750db67c9167ae8cde0d95bc5eaf4f326e9613143f39b976474e50c8cae3`. Active production version in the dashboard: `b19c9862` (100%).

## Automated and visual checks

- `node --test tests/*.test.mjs`: 36 passing tests for deterministic motion, measured stack depth, touch arbitration and interruption cleanup, cookie schema, query precedence, and persistence failures.
- `node build.mjs`: public static assets plus revision/hash metadata generated successfully.
- Updated local browser checks: 43 PASS, 0 FAIL, 1 UNVERIFIED (known unavailable WebKit engine). [local/browser-results.md](local/browser-results.md), with detailed measurements in [local/browser-results.json](local/browser-results.json). The precommit local build reports the prior HEAD with candidate asset hashes; the hosted release must identify the new committed revision.
- Root visual review covers the 390px deck, 1440px staggered layout, 320px reading fallback, reversible motion, expanded form, short form viewport, and honest completion state.

The first browser pass revealed two issues that were fixed before release: blank-area mouse drags could begin native text selection and block a subsequent flick; native dialog tabbing could briefly put focus on the document body. Regression checks now cover consecutive gestures and explicit modal Tab/Shift+Tab containment.

The October 3 update adds touch text-start swipes, native child-to-stage capture transfer and genuine loss, long-press yielding, multi-touch cancellation, later desktop entrances, settings cookies and reload-to-top, live reduced-motion cancellation, and the previously uncovered dialog settlement/backdrop cases. Independent review caught and resolved three desktop-observer cases: late animation under reduced motion behind a locked dialog, exact-edge intersection at ratio zero, and re-hiding cards read in conventional flow. Browser regressions cover each.

Measured settled edges are exactly 10px and 20px with a constant 396.5px active-card center at 390 × 844. Desktop observers use a -135px bottom margin at a 900px viewport height, with 80ms delay and 380ms duration. Local browser checks observed 591 GET requests, zero browser/asset errors, and no submission requests. Native Chromium CDP touch capture transferred from text to the stage without cancellation; pinch emulation reached scale 2.426 and switched to readable flow. These remain browser-emulation evidence, not physical-device results.

## Scope of evidence

The 320 × 568 layout intentionally falls back to document flow when the full content will not fit. At 390 × 844 the deck is enabled. Desktop comparisons, short landscape, 899/900px breakpoint, reduced motion, enlarged type, JavaScript-disabled fallback, long messages, and native scrolling overlays are included in browser coverage.

Mouse/pointer automation, synthesized pointer cancellation, browser viewport resizing, and Chromium page-scale emulation are explicitly identified in the detailed results. They do not establish native phone pinch, touch cancellation, on-screen keyboard behavior, or performance. Playwright WebKit on Windows, if available, is engine coverage rather than native Safari. Physical Android Chrome, iPhone Safari, native Safari, screen-reader behavior, and unavailable Firefox coverage remain unverified.

The owner reported that the earlier Cloudflare build was functional on a device. They explicitly did not QA local instances. No device/browser or detailed scenario results were provided, so that feedback is recorded as general hosted device QA for revision `58af3ff`, separately from automated checks and from this update.

Updated recordings cover [touch text-start reversal](local/touch-text-reversal.webm), [touch text-start flick](local/touch-text-flick.webm), and [contact expansion](local/contact-expansion.webm). The contact demonstration retains its draft only in the current page DOM. The review cookie stores preferences only, for 30 days on the preview hostname; ordinary reload returns to the top while fresh section links still work.

## Deployment

The baseline preview is already deployed at https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/, revision `58af3ff2d8073a4e7aefbc0904e2e0f88399b23f`, with 9 matching assets and unchanged production HTML. The updated fixes have passed local checks; the new branch commit, automatic non-production version upload, and hosted verification will be recorded here after release. Local checks alone are not claimed as a completed updated POC.
