# Browser verification

Preview: https://codex-card-layout-tuning-lynn-landing-page.nrct6ycww6.workers.dev

Checked: 2026-10-05T04:07:02.622Z

- PASS: contact opening during deck settlement freezes position and inside-to-outside release stays open
- PASS: live OS reduced motion finishes contact opening and closing immediately
- PASS: initial boundaries and keyboard navigation
- PASS: Read as page and card return preserve section
- PASS: contact direct jump, expansion, title focus, modal keyboard containment
- PASS: validation summary and invalid email preserve values
- PASS: 2000+ character message, optional blank organization, review and edit
- PASS: close and reopen preserve draft, opener focus, and section
- PASS: overlay viewport resize locks background mode and keeps fields reachable
- PASS: Finish demo states nothing was sent and makes no submission request
- PASS: reduced motion readable flow and immediate modal
- PASS: JavaScript disabled semantic fallback and disabled prototype form
- UNVERIFIED: WebKit desktop/mobile navigation and form smoke — Skipped because local installed WebKit launch created a context but hung creating its first page and exceeded a 25-second process timeout.
- PASS: no browser/asset errors or unexpected contact network

- Chromium 149.0.7827.55; installed browser executable explicitly selected.
- Firefox, native Safari, Android Chrome, and iPhone Safari are unavailable/unverified in this environment. No real-device performance, browser pinch behavior, or on-screen keyboard claim is made.

Detailed results, measurements, errors, and revision metadata: browser-results.json. Screenshots and short focused review recordings are alongside this log.
