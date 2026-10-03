# Browser verification

Preview: http://127.0.0.1:4188

Checked: 2026-10-03T19:52:47.495Z

- PASS: wheel browser input keeps tiny intent idle and uses fixed preset transitions in touch and PC decks
- PASS: wheel long inertia tails and 180–350 ms gaps cannot skip cards; fresh reverse bursts navigate
- PASS: wheel line and page delta modes normalize and retain cancellable listener policy
- PASS: wheel horizontal intent and control-modified browser zoom input bypass the deck
- PASS: wheel nested scrolling and input controls retain their native paths
- PASS: wheel contact textarea scrolls while dialog locks deck position
- PASS: wheel desktop, reduced motion, and Read as page keep native document scrolling
- PASS: wheel lifecycle cancellation clears release timers across blur, resize, reading and reduced motion
- PASS: PC touchscreen and mouse pointer paths work alongside wheel navigation
- UNVERIFIED: WebKit desktop/mobile navigation and form smoke — Skipped because local installed WebKit launch created a context but hung creating its first page and exceeded a 25-second process timeout.

- Chromium 149.0.7827.55; installed browser executable explicitly selected.
- Firefox, native Safari, Android Chrome, and iPhone Safari are unavailable/unverified in this environment. No real-device performance, browser pinch behavior, or on-screen keyboard claim is made.

Detailed results, measurements, errors, and revision metadata: browser-results.json. Screenshots and short focused review recordings are alongside this log.
