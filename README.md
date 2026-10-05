# Stacked-card prototype

The card prototype parent is `codex/card-layout`; production remains `main`. The approved five-second swipe reminder is now part of the prototype. `codex/card-layout-swipe-hint` is retained as its original review baseline. New controls are developed on `codex/card-layout-tuning` and promoted after hosted verification.

[Prototype preview](https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/) · [Tuning preview](https://codex-card-layout-tuning-lynn-landing-page.nrct6ycww6.workers.dev/) · [Verification](verification/TUNING.md)

This isolated exploration retains approved content, Georgia typography, semantic colors, reading order, and privacy rules. Contact completion is simulated: **Nothing was sent.** Drafts stay in memory only. The preview is noindex and is not a production launch.

## Review the movement

Open **POC review / movement lab** on mobile or desktop. All tuning groups appear in the expanded panel; scroll the panel to reach them. Numeric inputs accompany sliders. Values are remembered for 30 days on this hostname. Refresh starts at the first card while retaining preferences. No configuration-sharing URL is created.

Choose **Card view** to try swiping on a wide desktop. **Automatic** uses cards on eligible narrow screens and native reading on wide screens. **Reading view** uses normal document scrolling. Reduced motion, short screens, and content too large to fit retain a readable flow. Explicit wide Card view reserves a sidebar for the panel.

An upward finger swipe or downward trackpad/wheel burst requests one next card; reverse input requests the previous card. Mouse dragging and arrows also work. Movement below the threshold leaves cards in place, and recognition starts a configured animation. Finger velocity and scroll deltas do not set animation pace. Any ordinary active-card surface, including text, links, buttons, and their child arrows, can start a swipe. Links and buttons require the full configured swipe distance (48px by default), bypassing the short flick shortcut. Stationary taps activate normally; acquired vertical gestures suppress their associated click, including gated or boundary attempts. A long stationary touch yields to native selection/context menus. Editable fields, nested scrollers, horizontal intent, browser zoom, dialogs, review controls, and reading view retain native behavior.

The **next-request gate**, in 0.05-second increments, is independent of animation completion. Adjacent touch, wheel, keyboard, and button requests share it. Requests during the gate are discarded. After it opens, a new request can retarget an animation smoothly; duration scales with the remaining card distance. One held contact or wheel burst makes only one attempt, even if rejected. Wheel quiet time defines the boundary between bursts.

Tuning covers duration, detection distance, gate, wheel threshold/quiet time, direction discrimination, selection hold delay, flick recognition, acceleration/deceleration, magnetic pull/onset, optional landing bounce, rotation, curvature, layer depth/scale, arrival scale, opacity ramp, and shadow. Motion parameters are captured per accepted request; editing them does not cancel a running animation. Gate changes apply immediately relative to the last acceptance. Bounce defaults to zero. These are design-review defaults.

Crisp / Balanced / Gentle set duration to 0.60 / 0.90 / 1.30 seconds and adjust acceleration, deceleration, and magnetic pull. They preserve detection and geometry settings. **Reset tuning** restores movement defaults while retaining view and review preferences; **Reset review settings** clears saved review preferences and URL overrides. OS reduced motion always takes precedence.

The reminder appears after five idle foreground seconds on the first card, nudges twice, then rests. Interaction hides it and restarts the timer. An open panel/dialog, held pointer, selection, hidden tab, or reduced-motion/reading mode suppresses it. Close the panel and return to the first card to review it.

## Run and verify

No new runtime packages or Python environments are required:

```powershell
node --test tests/*.test.mjs
node build.mjs
python -m http.server 4191 --bind 127.0.0.1 --directory dist
```

Public assets exclude documentation, tests, evidence, and Git metadata. `dist/revision.json` records the source commit and hashes of twelve assets. Browser tooling uses the workstation's existing Playwright/Chromium; set `PW_MODULE` and `CHROMIUM_PATH` for other installations.

```powershell
node tests/tuning-checks.mjs
node tests/hint-checks.mjs
```

`BASE_URL` and `EVIDENCE_DIR` select the preview and report directory. Historical continuous-drag tests in `tests/browser-checks.mjs` describe the earlier interaction; its unaffected reading, layout, and contact checks remain useful with `CHECK_FILTER`. Current command acceptance is in the tuning suite. Native Firefox, Safari, Edge, physical trackpads, and mobile keyboards are recorded separately from Chromium emulation.

Current hosted recordings: [text-start command and retarget](verification/tuning/hosted-recordings/text-command-and-retarget.webm), [short flick](verification/tuning/hosted-recordings/text-flick.webm), and [contact expansion](verification/tuning/hosted-recordings/contact-expansion.webm).

## Preview deployment

The existing non-production Workers Builds workflow runs `node build.mjs && npx wrangler versions upload`. Production `main` retains its existing workflow. Do not deploy or promote a Worker version to production as part of this prototype.

After upload, `node tests/verify-deployment.mjs <commit>` compares every preview asset with the commit and manifest, production HTML with its captured baseline, and preserved local/remote branch heads. The owner's Cloudflare-only device QA is separate from local and hosted automation.

[STACKED_CARD_SPEC.md](STACKED_CARD_SPEC.md) contains the supplied brief and current amendment. [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md) is historical site context.
