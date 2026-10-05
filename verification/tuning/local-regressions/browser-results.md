# Browser verification

Preview: http://127.0.0.1:4191

Checked: 2026-10-05T03:26:08.641Z

- PASS: cold direct section links preserve destination
- PASS: query settings override valid cookies, invalid inputs fall back, blocked cookies remain usable
- PASS: viewport desktop-1440
- PASS: viewport desktop-1280
- PASS: viewport mobile-390
- PASS: viewport mobile-320
- PASS: viewport landscape-844
- PASS: viewport breakpoint-899
- PASS: viewport breakpoint-900
- PASS: desktop comparison and native scrolling
- PASS: desktop entrances wait until 15 percent inside viewport, delay 80 ms, run 380 ms once without flash
- PASS: desktop direct links, resize, conventional layout, and reduced motion reveal reachable content
- PASS: desktop reduced motion while dialog is open suppresses late observer animations
- PASS: desktop cards read in conventional flow stay revealed when staggered layout returns
- PASS: desktop card exactly at entrance observer boundary does not remain pending
- PASS: contact opening during deck settlement freezes position and inside-to-outside release stays open
- PASS: live OS reduced motion finishes contact opening and closing immediately
- PASS: initial boundaries and keyboard navigation
- PASS: resize settles drag and switches short viewport to flow
- PASS: Read as page and card return preserve section
- PASS: contact direct jump, expansion, title focus, modal keyboard containment
- PASS: validation summary and invalid email preserve values
- PASS: 2000+ character message, optional blank organization, review and edit
- PASS: close and reopen preserve draft, opener focus, and section
- PASS: overlay viewport resize locks background mode and keeps fields reachable
- PASS: Finish demo states nothing was sent and makes no submission request
- PASS: reduced motion readable flow and immediate modal
- PASS: enlarged 200 percent text preserves content in flow
- PASS: two-times page-scale zoom keeps document reachable
- PASS: JavaScript disabled semantic fallback and disabled prototype form
- UNVERIFIED: WebKit desktop/mobile navigation and form smoke — Skipped because local installed WebKit launch created a context but hung creating its first page and exceeded a 25-second process timeout.
- PASS: no browser/asset errors or unexpected contact network

- Chromium 149.0.7827.55; installed browser executable explicitly selected.
- Firefox, native Safari, Android Chrome, and iPhone Safari are unavailable/unverified in this environment. No real-device performance, browser pinch behavior, or on-screen keyboard claim is made.

Detailed results, measurements, errors, and revision metadata: browser-results.json. Screenshots and short focused review recordings are alongside this log.
