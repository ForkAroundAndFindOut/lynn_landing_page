# Delayed swipe-cue experiment

Date: 2026-10-03 (America/Los_Angeles).

Branch: `codex/card-layout-swipe-hint`, rebased on fixed-speed input-support parent `fe62048bfa8f99e41dc03095ba80fb8d51cf413e`. It includes the one-card request correction; the child adds only the reminder and its evidence. No parent or production changes are included in this experiment.

The cue uses the reserved bottom instruction row, opacity 0.45, a 300ms fade, and two restrained 4px arrow nudges. It appears after five visible-tab seconds on the idle first card. Pointer press, wheel, keyboard, or navigation dismisses it until reload. Reading/desktop/reduced-motion modes, dialogs, and hidden tabs suppress it. Text instructions remain semantic and available through the stage description; decorative cue elements are aria-hidden and have pointer-events:none. No preference or contact data is stored by this feature.

Acceptance checks cover delay, dismissal and reload, hidden-tab countdown, dialog and mode suppression, lack of layout movement, input pass-through, and the combined input/settings/layout/dialog regression suite. The rebased local [reminder report](hint/local/hint-results.md) has 12 PASS and no browser/asset faults, timestamp `2026-10-03T20:04:25.552Z`. The [combined regression report](hint/local/browser-results.md) has 52 PASS, no failures, 1 UNVERIFIED (known unavailable WebKit), 986 GET requests, and zero browser/asset faults or submissions, timestamp `2026-10-03T20:05:58.265Z`. Its precommit build identifies the prior HEAD with candidate asset hashes. The 56 parent unit tests cover the identical input/motion modules.

Chromium measured the actual cue timer at approximately 5000ms at 390px and 800px widths, opacity 0.45, unchanged card/control geometry, unchanged focus, and two bounded 1200ms SVG animation cycles. Hidden-tab state is explicitly synthetic; this does not prove OS/browser background throttling. Root visual review confirms the faint bottom cue fits without overlap. Hosted results are recorded after the separate version-preview upload.

The research-backed browser compatibility target is modern Chrome, Edge, Firefox, and Safari; actual device coverage is listed separately from Chromium automation in [the compatibility record](BROWSER_COMPATIBILITY.md). Experimental preview: https://codex-card-layout-swipe-hint-lynn-landing-page.nrct6ycww6.workers.dev/.
