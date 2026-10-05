# Link-origin swipe correction

The owner reported a dead swipe region on or near “Explore the possibilities.” The cause was confirmed in deck-controller.js: links, buttons, and their interactive roles were excluded before gesture arbitration. Their enlarged hit areas also made nearby space feel inactive.

Active-card links, buttons, nested text, and arrows now participate in swipe recognition. Actionable starts require the full configured swipe distance, default 48px; the optional fast 16px flick shortcut does not bypass this protection. The existing 6px direction dead zone distinguishes a tap from an acquired gesture. A stationary tap or jitter below 6px activates normally. An acquired but incomplete 6–47px vertical gesture neither shuffles a card nor activates its starting control, preventing navigation from an aborted swipe. Long stationary holds still yield to native selection/context menus.

Once acquired, only the associated pointer-generated click is suppressed, including gate or endpoint rejection. Keyboard/programmatic activation is preserved, and a fresh primary press starts a new activation. Native anchor dragging is prevented while recognition owns that pointer. Animation duration, tuning controls, gate, one-contact request consumption, and wheel pacing are unchanged. Editable fields, modal/review controls, and native reading behavior retain their established paths.

## Verification

The focused suite passes **55/55**, adding link/button child starts, full-distance versus flick recognition, pointer-click suppression, legacy MouseEvent start/release coordinates, short jitter, and gate/endpoint behavior. [Focused browser checks](link-swipes/local/tuning-results.md) pass **7/7** using trusted Chromium touch/mouse/keyboard events on actual links/buttons. They verify forward/backward shuffle, threshold crossing, incomplete gestures, normal section/contact taps, keyboard activation after a rejected swipe, and immediate unrelated controls. The [combined tuning suite](link-swipes/local-combined/tuning-results.md) passes **26/26**, with zero browser/asset errors. Independent bounded review found no material correctness issues. Local reports identify the prior commit with candidate asset hashes; hosted evidence records the committed correction below.

Modern Chrome, Edge, Firefox, and Safari remain targets; native Safari/Firefox/Edge and physical mobile/trackpad behavior remain unverified here. No new runtime packages or environments were introduced. User device QA refers to earlier Cloudflare builds, not these local tests.

## Rollout

The correction uses the existing non-production version-preview workflow on `codex/card-layout-tuning`, then fast-forwards the approved prototype parent `codex/card-layout` after hosted checks. Production `main`, unrelated branch heads, and the original reminder baseline are preserved. Exact hosted revision, public-asset hashes, and final alias checks are verified separately from local behavior.

Cloudflare build `da2c59a3-2615-4c82-8bef-463668ee310a` successfully uploaded source `6a1816843665222477da86f6027e1fa0e8cb0c9f`. [Hosted integrity](link-swipes/hosted/integrity.json) verifies all twelve public assets against commit and manifest and confirms unchanged production HTML/original branch heads. The [complete hosted tuning suite](link-swipes/hosted/tuning-results.md) passes **26/26** with zero browser/asset faults; [retained contact, keyboard, reading, reduced-motion, and no-JavaScript checks](link-swipes/hosted-contact/browser-results.md) pass **13/13**, with the known unavailable WebKit engine identified separately. No contact submissions were made.

The evidence-only follow-up retains identical public assets. Both prototype aliases are checked for its final revision and exact assets after upload, with final integrity and parent link-swipe smoke evidence generated under ignored `dist/final-verification/link-swipes`. Current prototype: https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/. Tuning preview: https://codex-card-layout-tuning-lynn-landing-page.nrct6ycww6.workers.dev/.
