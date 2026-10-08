# Safari investigation findings — 8 October 2026

This is an investigation record, not a behavior-fix release. Canonical baseline: commit 5c3b63d77af003f326483e083ae120c40969fa 33. The owner confirmed the layout report is from physical iPhone Safari and the trackpad report is from Mac Safari. Android Chrome device QA previously covered Cloudflare only; it is owner evidence, separate from the automation below.

## Findings in priority order

| ID | Priority / classification | Finding and evidence | What remains to decide or measure |
|---|---|---|---|
| QA-01 | P1, confirmed recognition limitation; exact Mac cause unconfirmed | A consumed wheel burst is renewed by every eligible delta and even native/horizontal fragments. Continuous 100ms tails keep it consumed with Request gate=0. A gate-rejected threshold stroke also consumes its entire burst. Controller characterization and hosted artificial-tail/cadence checks reproduce this. | Native Mac Safari trace must distinguish continuing deltas, gate rejection, event targeting, or events never reaching the stage. Review gesture-boundary recognition separately from animation pacing. |
| QA-02 | P1, owner-reported iPhone blocker; explicit fallbacks confirmed | Card mode requires effective reduced motion=false, visualViewport.height>=540, eligible view/width, and the tallest of ALL SIX cards fitting the stage. Only reduced motion or height<540 disables #read-mode. The review selector itself is not disabled by the source. At width 390, tested heights540/541/667/740 use flow with the button enabled;844/915 use deck. At 390x844, Services needs 504px and governs fit. | The affected iPhone's OS/review preference, actual visual viewport, and candidate card measurements are still needed. No Safari permission/security fault is established. |
| QA-03 | P2, confirmed presentation ambiguity | OS reduced motion wins over unchecked/saved reduce:false and ?motion=normal. The mode explanation is inside POC review. Fit fallback offers an enabled Use card view button that retries the same failing fit condition. Short-screen wording can mask concurrent reduced-motion gating. | Review clearer reasons, retaining protective flow, static card presentation for reduced motion, or measured sizing changes. No option is selected. |
| QA-04 | P2, confirmed source behavior; native relevance unconfirmed | A hosted Chromium probe accepted the next card, reached position 0.107, then a 1px viewport-height increase reset its destination to card 1 and state to idle while remaining in deck mode. Every resize-triggered refresh settles before measuring; both window and visualViewport resize trigger it. | Determine whether Safari toolbar/zoom events interrupt accepted requests on the phone. See baseline-resize/chromium-safari-investigation.json. |
| QA-05 | P2, contract clarification | Accepted mobile requests retarget the running timeline from its sampled position; early requests are consumed/discarded. There is no queue. A controlled accepted touch sequence finishes only at the final destination. | Use the measured Android behavior as the design reference. Explicit queueing would be a separate behavioral change requiring review. |
| QA-06 | P3, coverage gap | No Safari/UA gate was found. Startup uses ResizeObserver, media-query change listeners, and Web Animations without universal legacy fallbacks. Modern Chromium/Chrome/Edge show no startup faults. | Capture a native error before attributing the phone failure to missing APIs, JavaScript/security, or browser compatibility. |

Baseline source locations: layout.js:91-123,139-160; demo-settings.js:98,233; deck-controller.js:31-39,151-167,189-210. Read these at the pinned baseline revision, since diagnostic hooks shift line numbers in this branch.

## Evidence and coverage

- Controller/settings suite: 61 PASS, 0 FAIL, including six new characterization checks. These PASS results confirm current behaviors, including the limitations; they do not mean the reported defects are repaired.
- Hosted canonical Chromium149: 19 layout/fallback checks and 18 wheel checks, all PASS; no asset/browser faults.
- Installed Windows Chrome154 and Edge154: 14 bounded comparative checks each, all PASS; no asset/browser faults.
- Chromium-family stationary-pointer tests did not reproduce stale inactive-card targeting. At 1200ms the target updates to the active card; during motion it can be the stage. The controller does reject old-card targets at idle if delivered, but native Safari delivery remains unverified.
- Artificial150/350ms pulse intervals remain one consumed burst;600/1200ms pulses can request subsequent cards. These are automation intervals, not measured native trackpad momentum.
- Desktop entrance timing remains80ms delay and 380ms duration.
- Local diagnostic UI:10 PASS, including trusted post-handler results, disabled-by-default behavior, initial layout geometry, OS precedence, privacy canaries, bounded/pause logging, tuning history/reset, startup errors, clipboard fallback, and mobile navigation hit testing.
- Local existing interaction suite: 26 PASS, 0 FAIL, covering link/touch/wheel commands, motion timing, settings persistence, keyboard, readable fallback, and reduced-motion precedence.
- Native iPhone Safari, Mac Safari, hardware trackpad momentum, native selection/pinch, and current physical Android comparison are OPEN. Firefox is unavailable locally; the existing Windows WebKit smoke limitation is retained. Chromium emulation and Windows Chrome/Edge do not prove native Safari compatibility.

Stable raw evidence:
- baseline-chromium-layout/chromium-safari-investigation.json (19 checks and screenshots)
- baseline-chromium-final-wheel/chromium-safari-investigation.json (18 checks and screenshots)
- baseline-chrome/chrome-safari-investigation.json
- baseline-edge/edge-safari-investigation.json
- controller-tests.txt
- diagnostics-local/results.json
- regression-local/tuning-results.json
- integrity-before.json and integrity-after.json (after release validation)

The earlier capture whose microtask sampled before trusted event bubbling has been removed. Stable wheel reports sample after handling. The diagnostic preview uses a passive window-bubble listener and matching inputId fields.

## Diagnostic implementation boundary

Branch codex/card-layout-safari-qa forks from 5c3b63d. It adds optional onDiagnostic callbacks, a gated classic bootstrap, and a browser-local panel at ?qa=1. Navigation thresholds, gates, motion curves/durations, input exclusions, layout budgets, reduced-motion precedence, desktop timing, and existing content are unchanged.

Logging records layout decisions, raw wheel/pointer metadata, request outcomes, effective tuning, lifecycle events, and startup errors. No form values or selected text are read. There is no telemetry endpoint or remotely watched service. The1200-event buffer is local to the tab, off without ?qa=1, pausable, and cleared on reload. Old entries roll off; dropped count is reported. Diagnostics add observation overhead while enabled, so frame-perfect performance claims require a separate profiling pass.

Pause stops event storage but keeps the current layout snapshot accurate. Requests include the tuning they used. Closing the QA and POC panels before gesture checks keeps the test surface unobstructed. The separate hostname has its own host-only review cookie; do not assume it inherits canonical preferences.

## Review gate

Automated investigation and diagnostic preparation are complete when hosted diagnostics and isolation checks pass. Native root-cause attribution remains open until the short guided device checks supply the missing evidence.

Review QA-01/02 first. Choose implementation direction after correlating native observations with the recorded recognition/layout decisions. No queueing change, sizing-policy change, reduced-motion override, or Safari-specific fix has been applied.

Primary references: [W3C wheel events](https://www.w3.org/TR/pointerevents4/#wheel-events), [HTML inert](https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees), [reduced-motion preference](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion). Wheel transactions and inert hit testing make target retention a testable hypothesis; they do not establish a Safari bug.
