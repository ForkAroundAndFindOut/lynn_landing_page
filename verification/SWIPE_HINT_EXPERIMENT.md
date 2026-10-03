# Delayed swipe-cue experiment

Date: 2026-10-03 (America/Los_Angeles).

Branch: `codex/card-layout-swipe-hint`, incorporating slower-touch parent `402ee6a6e1fd1b9b299fc3ac159ce33b74aa2848`. Core motion/input modules match that parent; the reminder remains child-only. Production and original branches are preserved.

## Android reminder follow-up

The earlier cue permanently dismissed itself on any pointerdown, wheel, or keydown, including ordinary taps and review-control use before its first appearance. A saved expanded review panel could obscure the bottom cue. These source-confirmed conditions explain plausible failure paths for the owner's report; physical Android Chrome is not available to establish the exact device cause.

Input now hides the cue and restarts a five-second idle interval. Held pointers, native selection, the expanded review panel, dialogs, hidden tabs, and unfocused windows pause the countdown. Returning to the first card, closing the panel, clearing selection, or restoring focus/visibility rearms it. Lost contacts are cleared during blur/tab hiding. The cue retains its first-card-only, decorative, non-interactive behavior, reserved space, opacity 0.45, 300ms fade, and two 4px nudges; reduced motion and native document flow still suppress it.

Focused source checks passed in Chromium, including Android Chrome emulation at 360×740 and 412×915. Merged-build and hosted checks are recorded under `slower-motion/hint/`; emulation is explicitly distinct from physical Android QA. The original results below are historical and do not validate the new rearming policy.

## Original reminder evidence (superseded dismissal policy)

The cue uses the reserved bottom instruction row, opacity 0.45, a 300ms fade, and two restrained 4px arrow nudges. It appears after five visible-tab seconds on the idle first card. Pointer press, wheel, keyboard, or navigation dismisses it until reload. Reading/desktop/reduced-motion modes, dialogs, and hidden tabs suppress it. Text instructions remain semantic and available through the stage description; decorative cue elements are aria-hidden and have pointer-events:none. No preference or contact data is stored by this feature.

Acceptance checks cover delay, dismissal and reload, hidden-tab countdown, dialog and mode suppression, lack of layout movement, input pass-through, and the combined input/settings/layout/dialog regression suite. The rebased local [reminder report](hint/local/hint-results.md) has 12 PASS and no browser/asset faults, timestamp `2026-10-03T20:04:25.552Z`. The [combined regression report](hint/local/browser-results.md) has 52 PASS, no failures, 1 UNVERIFIED (known unavailable WebKit), 986 GET requests, and zero browser/asset faults or submissions, timestamp `2026-10-03T20:05:58.265Z`. Its precommit build identifies the prior HEAD with candidate asset hashes. The 56 parent unit tests cover the identical input/motion modules.

Chromium measured the actual cue timer at approximately 5000ms at 390px and 800px widths, opacity 0.45, unchanged card/control geometry, unchanged focus, and two bounded 1200ms SVG animation cycles. Hidden-tab state is explicitly synthetic; this does not prove OS/browser background throttling. Root visual review confirms the faint bottom cue fits without overlap.

The separate hosted build passed the [12 reminder checks](hint/hosted/hint-results.md) at `2026-10-03T20:10:27.344Z` and [52 combined regression checks](hint/hosted/browser-results.md) at `2026-10-03T20:12:41.110Z`, with no failures or browser/asset faults, 986 GET requests, no submissions, and known unavailable WebKit explicitly unverified. Tested source is `eb0cf2998c2c8b5780fe4a9623ff9982d3335b91`, uploaded by Cloudflare build `00ecb1c9-7c73-4cc2-80ab-c86963318333`. [Integrity evidence](hint/hosted/integrity.json) verifies all eleven assets against source and manifest and preserves production and original branch heads. The parent preview remains on `fe62048bfa8f99e41dc03095ba80fb8d51cf413e`. The final evidence-only commit retains identical application assets and is checked again after upload. The child is an actual descendant of that fixed-speed parent, with identical controller, wheel, motion, layout, contact, and settings modules.

The research-backed browser compatibility target is modern Chrome, Edge, Firefox, and Safari; actual device coverage is listed separately from Chromium automation in [the compatibility record](BROWSER_COMPATIBILITY.md). Experimental preview: https://codex-card-layout-swipe-hint-lynn-landing-page.nrct6ycww6.workers.dev/.
