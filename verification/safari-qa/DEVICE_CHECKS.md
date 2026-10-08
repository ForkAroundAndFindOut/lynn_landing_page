# Short guided device checks

Diagnostic preview:
https://codex-card-layout-safari-qa-lynn-landing-page.nrct6ycww6.workers.dev/?qa=1

This isolated preview preserves the prototype's behavior. QA session logging stays in this tab; nothing is uploaded. The hostname has its own saved review settings. Do not reset your original prototype preferences.

## iPhone Safari — about two minutes

1. Open the diagnostic URL on the affected physical iPhone. Wait three seconds. Open QA session at bottom left.
2. Note View, Card button disabled, OS reduced motion, Review reduced motion, Usable viewport, and Layout checks. Capture snapshot.
3. Close QA session, open POC review, select Deck, then close POC review. Reopen QA session and capture another snapshot. A remaining page view is useful evidence.
4. If page view remains, briefly scroll so Safari's toolbar changes, then rotate once and return to portrait. Capture snapshot again. Leave your OS accessibility preference intact.
5. Copy diagnostic report and paste it into this conversation, adding iPhone model/iOS version and which control looked grey. Clipboard denial offers a selectable report.

The card requirement/limit line explains content-fit rejection; OS reduced motion and the 540px cutoff are separate checks. Flow-mode heights measured after fallback cannot reconstruct the candidate fit; the report captures measurements during the actual decision.

If you prefer no report copying, send the six values from step 2 and the largest card requirement/limit. That is enough to narrow the layout cause. A screenshot is optional.

## Mac Safari trackpad — about two minutes

1. Open the same URL in a reasonably tall window. In POC review select Deck, keep default tuning, and close both POC review and QA session.
2. Place the pointer near the middle of the card and leave it stationary. Make three short forward strokes about 0.6 seconds apart. Wait two seconds; try again about 1.2 seconds apart.
3. Repeat while moving the pointer slightly between strokes. Try a backward stroke too. Avoid the first/last card boundary when comparing.
4. Open QA session and Copy diagnostic report. Tell us which sequence felt dead and your Safari/macOS version. Reload only when beginning a new session, since it clears the log.
5. Optional: repeat the stationary sequence in Mac Chrome with matching settings. On Android Chrome, two consecutive swipes with matching tuning provide the reference for the behavior you like.

Keep the QA session panel closed while swiping; it can receive its own native scrolling when open. The buffer retains 1200 events, so copy soon after the reproduction rather than spending minutes repeatedly scrolling.

## Optional Web Inspector

On Mac Safari, inspect the page and evaluate window.__cardQA.snapshot() for the current decision or window.__cardQA.report() for the bounded session. Normal logging needs no Inspector.

Remote inspection of iPhone Safari can provide network/console evidence if a startup error is reported. We can guide that only if needed; no browser trace export is required for the initial checks.

## Reuse

Existing Node 24.19.0 and Python 3.12.13 were reused; Python serves local assets without environment changes. Playwright uses the bundled Codex dependency path. Wrangler 4.149.0 is available through npx cache; no project dependency manifest was changed.

Controller characterization:
node --test tests/*.test.mjs

Hosted baseline probes:
node tests/safari-investigation.mjs

Set BASE_URL, EVIDENCE_DIR, QA_BROWSER (chromium|chrome|edge), and QA_CHECK_FILTER to choose target, durable evidence location, browser, and bounded cases. Use a verification directory outside dist because build.mjs recreates dist.

Diagnostic checks:
node tests/diagnostics-checks.mjs

Branch/preview protection checks:
node tests/qa-integrity.mjs before
node tests/qa-integrity.mjs after

Build and isolated version upload:
node build.mjs
npx --yes wrangler@4.149.0 versions upload --preview-alias codex-card-layout-safari-qa

No production deploy is part of this workflow.
