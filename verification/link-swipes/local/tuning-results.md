# Tuning browser checks

7 PASS / 0 FAIL / 7 total

- PASS: link swipe: stationary trusted taps activate the intended section and contact form once
- PASS: link swipe: 20px acquired gestures do not shuffle or activate; 5px mouse jitter retains native activation
- PASS: link swipe: trusted reverse from link and contact-button child advances exactly one card
- PASS: link swipe: mouse threshold consumes its returned pointer click and leaves immediate unrelated activation usable
- PASS: link swipe: gate and endpoint rejected button swipes consume click but preserve keyboard and later pointer activation
- PASS: link swipe: trusted touch on nested arrow waits for full distance and reverse card-child swipe returns
- PASS: no browser or asset errors

- Trusted CDP touch, Playwright mouse wheel, buttons, and keyboard in Chromium; independent cases run with at most three contexts.
- Browser frame measurements allow 70ms below and 180ms above the configured duration for frame scheduling and sampling.
- Physical phones, touchscreens, trackpads, native Safari/Firefox/Edge, and OS long-press/selection behavior remain unverified.
- Existing historical drag-tracking browser checks describe an earlier interaction contract; this suite checks the tunable command-swipe contract.
