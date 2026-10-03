# Delayed swipe-cue experiment

Date: 2026-10-03 (America/Los_Angeles).

Branch: `codex/card-layout-swipe-hint`, based on input-support parent `10aa8407bc7713654f3d1d4d4999e74b2150b3b0`. No parent or production changes are included in this experiment.

The cue uses the reserved bottom instruction row, opacity 0.45, a 300ms fade, and two restrained 4px arrow nudges. It appears after five visible-tab seconds on the idle first card. Pointer press, wheel, keyboard, or navigation dismisses it until reload. Reading/desktop/reduced-motion modes, dialogs, and hidden tabs suppress it. Text instructions remain semantic and available through the stage description; decorative cue elements are aria-hidden and have pointer-events:none. No preference or contact data is stored by this feature.

Acceptance checks cover delay, dismissal and reload, hidden-tab countdown, dialog and mode suppression, lack of layout movement, input pass-through, and the combined input/settings/layout/dialog regression suite. Results are recorded after local and hosted preview verification. The research-backed browser compatibility target is modern Chrome, Edge, Firefox, and Safari; actual device coverage is listed separately from Chromium automation.
