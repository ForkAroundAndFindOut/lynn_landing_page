# Tuning browser checks

26 PASS / 0 FAIL / 26 total

- PASS: link swipe: stationary trusted taps activate the intended section and contact form once
- PASS: link swipe: 20px acquired gestures do not shuffle or activate; 5px mouse jitter retains native activation
- PASS: link swipe: trusted reverse from link and contact-button child advances exactly one card
- PASS: link swipe: mouse threshold consumes its returned pointer click and leaves immediate unrelated activation usable
- PASS: link swipe: trusted touch on nested arrow waits for full distance and reverse card-child swipe returns
- PASS: numeric controls clamp committed out-of-range values and recover an empty edit
- PASS: link swipe: gate and endpoint rejected button swipes consume click but preserve keyboard and later pointer activation
- PASS: motion presets change only duration, acceleration, deceleration and magnetic strength
- PASS: trusted adjacent controls honor crisp transition duration
- PASS: trusted adjacent controls honor balanced transition duration
- PASS: all 25 tuning controls expose metadata, synchronize numeric/range pairs and save edits
- PASS: trusted adjacent controls honor gentle transition duration
- PASS: flick shortcut recognizes recent velocity and can be disabled; held text remains native
- PASS: gate rejects adjacent buttons and keyboard requests, then retargets continuously toward last requested card
- PASS: text-start touch swipes are commands: no finger tracking, one card per contact, speed-independent timing
- PASS: wheel uses one attempt per burst including gate rejection and honors the 400ms quiet boundary
- PASS: a touch rejected by gate remains consumed for its entire contact
- PASS: wheel delta magnitude cannot alter duration or advance more than one card
- PASS: v2 cookie restores review preferences and tuning, reload starts at top, reset scopes remain distinct
- PASS: zero gate accumulates rapid adjacent requests and duration scales with remaining card distance
- PASS: live tuning edits preserve active animation and gate changes apply immediately
- PASS: preview modes and independently scrolling panel fit 390x844
- PASS: OS reduced motion overrides explicit deck and manual normal motion preference
- PASS: preview modes and independently scrolling panel fit 1280x900
- PASS: compact height and JavaScript-disabled pages preserve readable native document flow
- PASS: no browser or asset errors

- Trusted CDP touch, Playwright mouse wheel, buttons, and keyboard in Chromium; independent cases run with at most three contexts.
- Browser frame measurements allow 70ms below and 180ms above the configured duration for frame scheduling and sampling.
- Physical phones, touchscreens, trackpads, native Safari/Firefox/Edge, and OS long-press/selection behavior remain unverified.
- Existing historical drag-tracking browser checks describe an earlier interaction contract; this suite checks the tunable command-swipe contract.
