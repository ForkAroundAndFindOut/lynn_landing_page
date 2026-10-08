# Tuning browser checks

14 PASS / 0 FAIL / 14 total

- PASS: link swipe: stationary trusted taps activate the intended section and contact form once
- PASS: link swipe: trusted reverse from link and contact-button child advances exactly one card
- PASS: link swipe: 20px acquired gestures do not shuffle or activate; 5px mouse jitter retains native activation
- PASS: link swipe: mouse threshold consumes its returned pointer click and leaves immediate unrelated activation usable
- PASS: link swipe: trusted touch on nested arrow waits for full distance and reverse card-child swipe returns
- PASS: link swipe: gate and endpoint rejected button swipes consume click but preserve keyboard and later pointer activation
- PASS: wheel uses one attempt per burst including gate rejection and honors the 400ms quiet boundary
- PASS: text-start touch swipes are commands: no finger tracking, one card per contact, speed-independent timing
- PASS: preview modes and independently scrolling panel fit 390x844
- PASS: preview modes and independently scrolling panel fit 1280x900
- PASS: v2 cookie restores review preferences and tuning, reload starts at top, reset scopes remain distinct
- PASS: OS reduced motion overrides explicit deck and manual normal motion preference
- PASS: compact height and JavaScript-disabled pages preserve readable native document flow
- PASS: no browser or asset errors

- Trusted CDP touch, Playwright mouse wheel, buttons, and keyboard in Chromium; independent cases run with at most three contexts.
- Browser frame measurements allow 70ms below and 180ms above the configured duration for frame scheduling and sampling.
- Physical phones, touchscreens, trackpads, native Safari/Firefox/Edge, and OS long-press/selection behavior remain unverified.
- Existing historical drag-tracking browser checks describe an earlier interaction contract; this suite checks the tunable command-swipe contract.
