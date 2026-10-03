# Browser verification

Preview: https://codex-card-layout-swipe-hint-lynn-landing-page.nrct6ycww6.workers.dev

Checked: 2026-10-03T20:12:41.110Z

- PASS: cold direct section links preserve destination
- PASS: native-dispatched touch text and background paths reverse, release, and respect bounds in every preset
- PASS: touch implicit capture transfers to stage and genuine capture loss cancels
- PASS: early touch selection attempt allows swipe while a held touch yields to selection
- PASS: touch hold, context menu, horizontal intent, and additional touch cancel cleanly
- PASS: two-touch pinch preserves browser zoom and cancels deck gesture
- PASS: wheel browser input keeps tiny intent idle and uses fixed preset transitions in touch and PC decks
- PASS: wheel long inertia tails and 180–350 ms gaps cannot skip cards; fresh reverse bursts navigate
- PASS: wheel line and page delta modes normalize and retain cancellable listener policy
- PASS: wheel horizontal intent and control-modified browser zoom input bypass the deck
- PASS: wheel nested scrolling and input controls retain their native paths
- PASS: wheel contact textarea scrolls while dialog locks deck position
- PASS: wheel desktop, reduced motion, and Read as page keep native document scrolling
- PASS: wheel lifecycle cancellation clears release timers across blur, resize, reading and reduced motion
- PASS: PC touchscreen and mouse pointer paths work alongside wheel navigation
- PASS: all review controls and panel persist, reload starts at top, fresh links survive
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
- PASS: slow reversible pointer path with partial release
- PASS: short flick commits and settles within 200–400 ms
- PASS: full traversal keeps settled geometry stable
- PASS: rapid input retains at most one pending transition
- PASS: pointer cancellation returns to origin
- PASS: emulated touch cancellation clears pointer and deck state
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
