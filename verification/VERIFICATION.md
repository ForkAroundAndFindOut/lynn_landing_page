# Card-layout verification

Date: 2026-10-03 (America/Los_Angeles).

The discrete wheel-request follow-up below records the latest input-support work. The proportional-wheel prototype and earlier selection, settings, layout, and recording evidence are retained as historical acceptance baselines.

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

## Discrete wheel-request follow-up

After device review of the proportional-wheel preview, the owner reported excessive speed, partial cards, and occasional multiple-card advances. The revised contract separates scroll detection from animation: a deliberate wheel/trackpad burst requests exactly one adjacent card and starts the selected preset's fixed-duration animation. Pixel/line/page input is used only to recognize direction and commitment, never to position the card. Continuous reversible touch dragging remains unchanged.

Committed wheel bursts consume their momentum tails without queued navigation and release only after both animation completion and 400ms of quiet input. Small opposite deltas can cancel an uncommitted candidate; after commitment, reversal belongs to the next distinct burst. The wheel listener is installed only while card mode is enabled, retaining native desktop/reading scroll performance. Zoom, horizontal gestures, native controls and nested scroll regions retain browser behavior. The quiet threshold is provisional application tuning, not a standardized OS gesture boundary.

The focused unit suite passes 56 tests, including 18 wheel cases that verify fixed 240/300/380ms preset durations across small, large, and slowly accumulated input; no manual partial positioning; single-card gates across 180–350ms tail gaps; the 399/400ms quiet boundary; delayed animation completion; and native/listener/lifecycle handling. The [focused local browser report](wheel/fixed-speed/local/browser-results.md) passes all nine input checks with zero failures; known unavailable WebKit is explicitly unverified. Trusted Chromium input measured similar durations for 16px and 2000px deltas in phone and PC-sized decks. [Browser compatibility research](BROWSER_COMPATIBILITY.md) records the Chrome/Edge/Firefox/Safari target, standards basis, accepted listener-lifecycle change, and hardware limits.

Hosted evidence will be recorded after the corrected version upload. The delayed swipe reminder remains a child-branch experiment and will be rebased on this verified fix before upload.

## Proportional wheel prototype (superseded)

The owner reported that two-finger PC trackpad scrolling did not advance cards on the hosted preview. Chromium wheel input reproduced that failure on revision `8b368c6` at both 390 × 844 and 800 × 900; the 1280 × 900 desktop flow scrolled normally. [Wheel baseline](wheel/baseline.json) records the separate delivery paths.

Card mode now handles vertical wheel input over its stage. Pixel, line (16px), and page (stage-height) deltas drive the existing motion path with 80px of normalized travel per card, a 16px wheel commitment threshold, and a 180ms quiet interval. A burst is bounded to one adjacent card, reversal discards overshoot and retraces immediately, and residual settlement input is consumed without queued navigation. Touch drag thresholds and presets are unchanged. Wide desktop, reading, reduced-motion, form fields, nested scroll areas, zoom, horizontal input, and selected text retain native behavior. Pointer input, explicit navigation, resizing, overlays, mode changes, tab hiding, and blur clear wheel state.

The focused unit suite has 50 passing tests, including 12 new wheel cases. The [local combined browser report](wheel/local/browser-results.md) and [hosted combined report](wheel/hosted/browser-results.md) each record 52 PASS, 0 FAIL, and 1 UNVERIFIED (known unavailable WebKit engine), with 797 GET requests and no browser errors or submissions. They cover real Chromium wheel-event delivery, synthetic line/page units, touch-pointer delivery at phone and PC widths, and the previous touch/settings/desktop/dialog regressions. Existing motion recordings are retained; the recording-generation check was not repeated. The precommit local report identifies the prior HEAD with candidate asset hashes.

Hosted acceptance completed at `2026-10-03T19:22:31.521Z`, application source `b6bc3f85e9f1d1374451c1578077f024fe263b15`. Cloudflare build `b37aa4f5-c9c9-475d-a2d2-27d23d42bb44` succeeded using the existing non-production version-upload workflow. The [wheel release integrity record](wheel/hosted/integrity.json) verifies all ten assets against the commit and manifest, unchanged original local/remote branches, and unchanged production HTML. The final evidence-only commit advances the preview metadata with identical application assets; it is checked again after upload. The parent preview remains https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/.

The provisional wheel thresholds are application tuning; there is no reliable cross-browser signal separating a wheel notch from a trackpad momentum stream. Automated Chromium input does not establish physical PC/Mac trackpad inertia, actual desktop touchscreen behavior, native Safari, or phone/tablet keyboard and long-press behavior. These remain device-QA requirements. The experimental delayed swipe hint is excluded from this parent branch.

## Earlier automated and visual checks

- `node --test tests/*.test.mjs`: 38 passing tests for deterministic motion, measured stack depth, touch arbitration and interruption cleanup, cookie schema, query precedence, and persistence failures.
- `node build.mjs`: public static assets plus revision/hash metadata generated successfully.
- Updated local and hosted browser checks each returned 44 PASS, 0 FAIL, 1 UNVERIFIED (known unavailable WebKit engine), including the final swipe-first selection refinement. [local/browser-results.md](local/browser-results.md) and [hosted/browser-results.md](hosted/browser-results.md) contain the logs; their JSON companions include measurements and build metadata. The precommit local build reports the prior HEAD with candidate asset hashes; the hosted release identifies committed application revision `c8162e94d6398de1ebcdce4c3e4036bb6cfddeec`.
- Root visual review covers the 390px deck, 1440px staggered layout, 320px reading fallback, reversible motion, expanded form, short form viewport, and honest completion state.

The first browser pass revealed two issues that were fixed before release: blank-area mouse drags could begin native text selection and block a subsequent flick; native dialog tabbing could briefly put focus on the document body. Regression checks now cover consecutive gestures and explicit modal Tab/Shift+Tab containment.

The October 3 update adds touch text-start swipes, native child-to-stage capture transfer and genuine loss, long-press yielding, multi-touch cancellation, later desktop entrances, settings cookies and reload-to-top, live reduced-motion cancellation, and the previously uncovered dialog settlement/backdrop cases. Independent review caught and resolved three desktop-observer cases: late animation under reduced motion behind a locked dialog, exact-edge intersection at ratio zero, and re-hiding cards read in conventional flow. Browser regressions cover each.

The final selection refinement gives eligible touch swipes priority over early `selectstart` events while retaining the pending gesture. At the 350ms hold deadline, selection yields to the browser even if the timer callback is delayed. Actual noncollapsed selection and context menus cancel acquisition; mouse text selection and interactive controls retain native behavior. The deadline is application tuning, not a universal browser threshold. Browser evidence combines real Chromium CDP touch delivery with explicitly synthetic cancelable `selectstart` events; physical-device long-press selection remains unverified.

Measured settled edges are exactly 10px and 20px with a constant 396.5px active-card center at 390 × 844. Desktop observers use a -135px bottom margin at a 900px viewport height, with 80ms delay and 380ms duration. Local browser checks observed 600 GET requests, zero browser/asset errors, and no submission requests. Native Chromium CDP touch capture transferred from text to the stage without cancellation; pinch emulation reached scale 2.426 and switched to readable flow. These remain browser-emulation evidence, not physical-device results.

## Scope of evidence

The 320 × 568 layout intentionally falls back to document flow when the full content will not fit. At 390 × 844 the deck is enabled. Desktop comparisons, short landscape, 899/900px breakpoint, reduced motion, enlarged type, JavaScript-disabled fallback, long messages, and native scrolling overlays are included in browser coverage.

Mouse/pointer automation, synthesized pointer cancellation, browser viewport resizing, and Chromium page-scale emulation are explicitly identified in the detailed results. They do not establish native phone pinch, touch cancellation, on-screen keyboard behavior, or performance. Playwright WebKit on Windows, if available, is engine coverage rather than native Safari. Physical Android Chrome, iPhone Safari, native Safari, screen-reader behavior, and unavailable Firefox coverage remain unverified.

The owner reported that the earlier Cloudflare build was functional on a device. They explicitly did not QA local instances. No device/browser or detailed scenario results were provided, so that feedback is recorded as general hosted device QA for revision `58af3ff`, separately from automated checks and from this update.

Updated hosted recordings cover [touch text-start reversal](hosted/touch-text-reversal.webm), [touch text-start flick](hosted/touch-text-flick.webm), and [contact expansion](hosted/contact-expansion.webm). [Recording metadata](hosted/recordings.json) verifies format, dimensions, durations, and input method. The contact demonstration retains its draft only in the current page DOM. The review cookie stores preferences only, for 30 days on the preview hostname; ordinary reload returns to the top while fresh section links still work.

## Deployment

The updated application is deployed at https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/, tested application source revision `c8162e94d6398de1ebcdce4c3e4036bb6cfddeec`. Cloudflare build `0ad1157a-532e-4b2f-801f-4d4d16092856` succeeded through the existing non-production `node build.mjs && npx wrangler versions upload` command. No production command or preview-system migration was used.

Hosted Chromium verification completed at `2026-10-03T18:51:57.174Z`: 44 PASS, no failures, zero browser/asset errors, and 600 GET requests with no contact submissions. All nine assets match the committed source and build manifest. [Hosted integrity evidence](hosted/integrity.json) also verifies all six original local branch heads, the three original remote heads, and the original checkout on `main`. Production HTML retains SHA-256 `4e48750db67c9167ae8cde0d95bc5eaf4f326e9613143f39b976474e50c8cae3`.

Cloudflare's production deployment remains `ddc66df0-16e5-40ec-ad73-4674ac227f9a`, version `b19c9862-7fce-4372-9b27-aa4ee193189f` at 100% traffic. The final documentation/evidence commit may advance the preview revision without changing any application asset; `/revision.json` reports the current build. Integrity is checked again after that commit, while the full browser evidence above applies to the identical tested application assets.

All requested fixes and automated POC acceptance checks are complete. Physical-device selection, pinch, keyboard behavior, native Safari/Firefox, screen-reader behavior, and performance remain explicitly unverified in this environment. Contact delivery remains simulated, and desktop/motion defaults remain exploratory design choices.
