This specification defines a buildable proof of concept for a website whose content arrives as a layered stack of rounded cards. It tests the mobile gesture, visible depth, alternative desktop layouts, and a contact card that expands into a roomy form overlay.

Implementation amendment, October 3, 2026: the owner approved touch swipes starting on ordinary text as well as open space, later desktop entrances, a cookie remembering review settings, and reload always restarting at the top. These requirements supersede the corresponding original defaults below. The existing card paths, presets, reversible tracking, native reading fallback, and simulated contact behavior are retained. The owner's reported device QA applies only to the earlier Cloudflare build; automated local and hosted checks are recorded separately.

The source is the design discussion in this task. The mobile stacking and reversible gesture are established requirements. Desktop presentation, exact dimensions, form fields, and motion tuning remain exploratory. The defaults below make the prototype buildable without presenting those choices as final design approval.

Deliverable: the proof of concept implemented in the existing GitHub repository and deployed to Cloudflare for preview, with a working preview URL, a short review guide, and browser verification evidence. Use the repository and Cloudflare deployment configuration already known to the implementing session and project. This document requests the specification only; no website has been implemented or deployed.

## Scope and decisions

### Established design direction

- Use modular, approximately square content cards with rounded edges, soft borders, blurred shadows, and clearly visible depth.

- The initial card fades in without translating or rotating.

- On mobile, an upward thumb swipe advances through the content. A downward swipe returns to the previous card.

- New cards translate and rotate into place, arriving from the left, then the right, then the bottom. They settle above the preceding cards with a slight downward offset relative to the layer underneath.

- Slow dragging directly controls both translation and rotation. Reversing the finger reverses the animation.

- A short flick completes the transition with a smooth glide and magnetic settlement in approximately 200–400 milliseconds.

- The path has restrained organic variation. It must not resemble a mechanical wheel, a corner hinge, or a randomly thrown card.

- Backward navigation removes the top card along its arrival path.

- Navigation and contact actions should be understated, visible, and classy. Previous and next controls trigger the same quick transitions.

- The latest contact direction is a prompt card expanding into an overlay containing the whole form, including space for a long message and a top-right close control.

- Desktop is open to exploration, including staggered side-by-side cards or a more conventional presentation.

### Proposed defaults for this proof of concept

These are implementation choices to test, not confirmed user preferences.

| Decision | Proposed default |
| - | - |
| Mobile composition | A viewport-anchored stack with one readable active card and up to two exposed previous layers |
| Entry sequence after the first card | Repeat left, right, bottom |
| Desktop comparison | Staggered two-column cards as the initial view; conventional document flow as a second view |
| Breakpoint | Use the mobile deck below 900 CSS pixels wide when the visible viewport is at least 540 CSS pixels high |
| Short screens | Use normal document flow, preserving all content |
| Initial motion preset | Balanced; also provide Crisp and Gentle presets |
| Global Get in touch link | Jump to the contact card; its button expands the card into the form |
| Return to top | Include a quiet control, disabled at the first card |
| Form flow | Whole-form details view, followed by a review view inside the same overlay |
| Form fields | Name, email, organization, and message; name, email, and message required |
| Visual identity | A neutral temporary palette and readable system typography |
| Technology | Use the existing repository's stack and Cloudflare preview deployment configuration; implement card motion with CSS and JavaScript without requiring WebGL |

The implementing session and project already have the existing GitHub repository and Cloudflare deployment context. Read the repository instructions and deployment configuration directly, and retain its approved content, visual tokens, toolchain, and preview deployment workflow. Use that established project context rather than creating a separate repository or treating this specification workspace as the website project.

### Scope boundaries

The prototype covers browsing, transitions, responsive presentation, accessible controls, form validation, an explicitly simulated submission, and deployment to Cloudflare for preview. Production contact delivery, email, databases, authentication, analytics, CAPTCHA, production launch, and final marketing copy are outside this proof of concept. No personal contact details or invented testimonials belong in the demo.

## Content and visual composition

Use six cards so all entrance directions and repeated stack changes can be evaluated.

| Order | Demo card | Purpose |
| - | - | - |
| 1 | Introduction | Short headline, brief explanation, and restrained contact link |
| 2 | What we do | Compact service or capability overview |
| 3 | How we work | Short process explanation |
| 4 | Example engagement | Clearly labeled illustrative content |
| 5 | Working together | Short supporting content and navigation |
| 6 | Contact | Friendly invitation and Get in touch button |

All copy is replaceable demo content. Keep the same order and information in every responsive mode. Represent content as semantic sections with stable IDs, one page H1, and descriptive headings.

Start with a warm off-white background, opaque light cards, dark readable text, and one muted accent. These are temporary tokens, not a brand decision. Use a soft border and two restrained shadow layers to distinguish the top card from the cards beneath it. Suggested starting tokens are a 24-pixel corner radius, a 1-pixel low-contrast border, and a broad shadow around 18 pixels down with a 48-pixel blur. Blur the shadow or background treatment; never blur text.

On mobile, size the active card to the available width minus about 16 pixels of padding per side and to the available stage height. Prefer a square when it fits. Permit a taller rounded rectangle where necessary for readable content. Never force the square shape by clipping text or shrinking type.

The active card remains fully readable. Prior layers are decorative previews, with approximately 10 and 20 pixels of upward offset relative to the active card, scales around 0.97 and 0.94, and subdued contrast. Earlier history stays in navigation state but is not painted as an ever-growing stack. Each new top card therefore appears slightly lower than the card underneath without cumulative drift.

Use compact content in the animated deck. If real content does not fit, provide Read more, opening a normally scrolling reading view, or switch to normal document flow. Do not introduce an independently scrolling text box inside a card that also owns the deck gesture.

The stage clips incoming cards to the viewport or stage boundary. Its padding must preserve settled shadows, exposed edges, safe areas, and controls. Decorative layers must not intercept input or appear as duplicate content to assistive technology.

## Mobile navigation and gesture behavior

### Resting and dragging states

Maintain an active card index, a gesture origin index, a continuous signed transition amount, an animation state, and an overlay state. The primary browsing states are idle, dragging, and settling. Form and reading overlays suspend deck input.

At gesture start, remember the settled card index and pointer position. Wait for approximately 6 pixels of movement before classifying the gesture. A deck drag requires vertical movement at least 1.2 times horizontal movement. Touch starts may originate on ordinary active-card text or open space, excluding nested links, buttons, form controls, editable regions, custom interactive roles, no-drag regions, and an open overlay. Mouse text selection remains native.

Do not prevent pending touch pointerdown or explicitly capture before acquiring a vertical drag. A pending touch yields permanently after 350 milliseconds, checking both the timer and event timestamp, so long presses remain native. Selection or a context menu also yields without clearing the selection. Suppress selection only during an acquired drag. Capture transfer from a touched descendant must not be mistaken for loss of the stage's capture. A second touch anywhere cancels to origin and yields to pinch zoom until all contacts end. Clean up timers, capture, and temporary selection styles on every exit.

Let upward travel be positive:

- Travel equals pointer start Y minus current pointer Y.

- Full travel distance D defaults to 18 percent of the stage height, clamped between 96 and 160 CSS pixels.

- Signed progress r equals travel divided by D, clamped to the available adjacent interval.

- Continuous deck position u equals the origin card index plus r.

A drag can move at most one card in either direction. At the first card, backward progress is unavailable; at the last card, forward progress is unavailable. Boundary gestures cause no index change and no looping.

Render progress immediately from the finger position, scheduling work once per animation frame. Do not ease, delay, or start a fixed-time animation during the drag. A small downward movement during an upward drag must move the incoming card back out by the corresponding amount. Crossing the gesture origin may begin the opposite neighboring transition when one exists.

For forward progress p from card i to card i+1, render the incoming card on its stored arrival path at p. For backward progress p from card i to card i-1, render the departing card i on that same path at 1-p. The visible layers interpolate between their old and new offsets throughout both directions.

### Release and settlement

Estimate release velocity from recent pointer samples covering about the final 80 milliseconds. Use the final direction, not the largest movement earlier in the drag.

A proposed release rule is to project the continuous position 120 milliseconds forward using release velocity, then choose the nearest available integer card index within one card of the gesture origin. At an exact midpoint, prefer the origin to avoid accidental advancement. Velocity projection only applies after the gesture passes its dead zone.

This makes a slow release before halfway return to the origin, a slow release after halfway finish, and a short decisive flick finish even when travel is small. A reversed release must favor the current reverse direction. Clamp the projection at the deck boundaries.

Animate from the current rendered position to the chosen endpoint. Preserve visual continuity; no jumping back to a predefined start pose. Use a monotonic ease-out curve with a short final settlement. Default behavior has no visible oscillating bounce. All completed flick and button transitions settle within 200–400 milliseconds.

Pointer cancellation returns to the origin and releases capture. A canceled gesture, lost pointer capture, tab hiding, or mode change must not leave the deck between states. Finalize or cancel to a valid settled index and clear temporary interaction state. Opening an overlay cancels pending navigation and settles the current motion to the nearest valid endpoint before measuring its expansion source. Ignore deck navigation while an overlay is open.

### Input ownership

The enhanced mobile deck owns vertical browsing gestures only inside its non-interactive stage. Apply touch behavior to that surface, preserving horizontal browser gestures and pinch zoom. A suitable starting declaration is touch-action: pan-x pinch-zoom, tested on actual touch browsers.

Place native scrolling overlays outside the deck's gesture-constrained ancestors. Setting pan-y on a child cannot recover scrolling when an ancestor already disallows it. Suspend deck listeners during overlays rather than trying to let the same gesture scroll the form and turn a card.

Preserve native long-press text selection and mouse selection. Ordinary touch swipes work across text and open space; previous and next controls remain available. Do not prevent native gestures globally, capture wheel events across the page, or disable zoom.

### Controls and rapid input

Show a compact previous control, next control, current position indicator, return-to-top control, and Get in touch link. Keep visual weight low but labels and hit areas clear. Use descriptive accessible names rather than unlabeled arrow glyphs.

Previous and next always move one card with the same arrival or removal path used by touch. Disable unavailable boundary actions. After a button or keyboard navigation, move focus to the new active card heading. Touch advancement announces the new card through a polite status without forcing focus away from the user's interaction.

During settlement, retain at most one pending previous or next request. Process it after the current animation settles; replace it if a newer request arrives. Do not accumulate an unbounded queue. A new drag may begin after settlement.

Return to top and Get in touch are direct jumps. Use a brief fade between valid stack states rather than rapidly animating every intermediate card. Rebuild decorative layers at the destination. Get in touch focuses the contact card action; opening the form remains a distinct action on that card.

Support previous and next through keyboard when focus is on the deck or its controls. Arrow Up and Arrow Down may navigate there; Home and End may jump to first and last. Never intercept these keys in editable elements or unrelated document areas.

## Motion paths and presets

### Path model

Describe each card's arrival with one deterministic path from an off-screen pose to its settled pose. The path controls center translation, modest rotation, scale, shadow strength, and layer offsets. A cubic Bezier translation with a separately interpolated angle is sufficient. Rotate around the card's center while translating that center along the arc; do not hinge around a visible corner.

Coordinates below are relative to the settled center. W is the card width and H the stage height. These are proposed tuning seeds.

| Direction | Translation control points from start to finish | Starting rotation |
| - | - | - |
| Left | (-W-80, -0.08H), (-0.55W, 0.14H), (0.10W, -0.08H), (0, 0) | About -16 degrees |
| Right | Mirror the left path horizontally | About +16 degrees |
| Bottom | (0.07W, H+80), (-0.06W, 0.55H), (0.02W, -0.03H), (0, 0) | About +8 degrees |

Rotation approaches zero at settlement. An incoming card can begin around scale 0.965 and finish at 1. Its shadow strengthens as it reaches the stack. It becomes opaque promptly when entering the visible stage so it reads as a solid object.

Minor per-card adjustments to curvature and starting rotation must be fixed by card ID or stored configuration. Keep variations within roughly 2 degrees and a few percent of card width. Never generate fresh randomness each frame, each direction reversal, or each visit. Evaluating the path at the same progress must return the same pose.

The incoming card remains above the cards it is covering; removing a card reveals the correct layer beneath it. Avoid z-index changes halfway through a transition. Interpolate background-layer offsets so a newly active card does not jump when another card is added or removed.

### Presets for review

| Preset | Button and flick settlement target | Full drag travel | Character |
| - | - | - | - |
| Crisp | 240 milliseconds | 16 percent of stage height, clamped 96–144 pixels | Fast glide, restrained rotation, firm final settlement |
| Balanced | 300 milliseconds | 18 percent of stage height, clamped 96–160 pixels | Clear arc, smooth glide, magnetic arrival |
| Gentle | 380 milliseconds | 20 percent of stage height, clamped 112–176 pixels | Slightly fuller arc and slower settlement |

Keep direct finger tracking immediate in every preset. A preset changes settlement and path tuning, not whether the finger controls progress. Reduced motion overrides all presets.

Expose these choices through a small POC review panel or documented demo URLs. Keep tuning numbers and implementation terminology out of ordinary website content. Optional debug indicators belong to the review panel and are off by default.

Remember motion preset, desktop layout, the review reduced-motion override, debug visibility, and review-panel open state in a versioned host-only cookie for 30 days (Path=/, SameSite=Lax, Secure on HTTPS). Restore controls before initial geometry/motion evaluation; OS reduced motion always wins. Valid URL options override saved settings on initial entry; invalid values are ignored. Changing review settings saves the new choices and removes conflicting review query parameters while preserving unrelated parameters. Reset review settings clears the cookie and query overrides and applies defaults, keeping the panel open until the next reload. Ordinary reload always restarts at the first card/page top with preferences retained; newly opened section links still select their destination. Invalid or blocked cookies must not break controls, and persistence failures show a short panel notice. Never persist form values or section history. Local and hosted preferences are separate by hostname.

## Desktop and responsive presentation

Provide two desktop views using the same content and contact behavior. The staggered view is the proposed initial desktop choice, not an approved final layout.

In the staggered view, use two columns within a centered container of approximately 1120–1200 pixels, with about a 32-pixel gap and a 24–40-pixel vertical offset between columns. Several cards may be read simultaneously. Use predictable row order in the DOM; do not use dense grid packing that changes reading order.

Cards fade and slide into place as normal scrolling brings them into view. Use 24–40 pixels of displacement and no more than about 4 degrees of rotation. Trigger when a card reaches 15 percent of viewport height above the bottom edge (computed in pixels), wait 80 milliseconds, then fade for 380 milliseconds. Prepare pending entrances without a visible-then-hidden flash. Trigger once per card per page view; scrolling back up or restoring staggered layout must not make previously viewed content disappear. Direct section navigation reveals its destination immediately. Match entrance directions to the mobile sequence while keeping desktop movement small; desktop timing does not change mobile presets.

Do not intercept the desktop wheel or force one wheel event to advance one card. Keep native scrolling, selection, keyboard reading, and links. Shadows and offsets communicate layering; cards must not cover another card's readable text or controls.

The conventional comparison uses one readable column in ordinary document flow with the same rounded card treatment and little or no entrance motion. A review setting switches between staggered and conventional desktop views. Mobile can retain its deck while the desktop setting changes.

Use available viewport dimensions, not device-name detection. In narrow but short viewports, including phone landscape, use normal flow. Changes in orientation, zoom, viewport size, or mode must preserve the logical active section and form draft, settle any in-progress gesture, and recompute geometry from the new viewport.

Do not change layouts merely because the on-screen keyboard reduces the visible viewport while a form is open. Suspend background mode switching until the overlay closes, while allowing the overlay itself to fit the visible area.

Offer a visible Read as page control in mobile deck mode. It switches to normal document flow and scrolls to the current section. Returning to deck mode preserves the corresponding section. Direct section links select or scroll to the correct content in either mode.

## Contact card and form overlay

### Contact entry and expansion

The contact card contains a short friendly invitation such as Discuss what you need, followed by Get in touch. Final copy remains open. Avoid urgent sales language or an oversized promotional button.

Activating the card action expands its visual surface into a modern form overlay. Measure the source card and the final dialog rectangle, then animate a decorative surface between them over approximately 280–360 milliseconds. Fade in form content as the expanded surface settles. Do not scale the input text down into an unreadable miniature.

Use a modal dialog, preferably a native dialog with showModal, placed outside the deck stage. Keep the actual controls available to assistive technology while decorative transition surfaces are hidden from it. The underlying deck is inert and its gestures are paused until closing completes.

The overlay uses most of the available phone width and height and a comfortable desktop maximum width around 680 pixels. It is allowed to be taller than the original square card. Use one native scrolling dialog surface containing the form; do not nest a scrolling form box inside a small fixed card.

Include a top-right close button with the accessible name Close contact form and a practical touch target. Escape closes the overlay. Backdrop clicking may close as a proposed default, but must not clear a draft. A pointer gesture starting inside the dialog and ending outside must not count as a backdrop click.

On close, return visually to the contact card where feasible and restore focus to the opener. Preserve entered data in memory for the page lifetime. Do not clear data merely because the user closes the form, changes layout, or navigates to another card. Do not store contact data in local storage, analytics, console logs, or a URL.

Changing OS/review reduced motion during an entrance or dialog opening/closing must cancel motion into its valid readable endpoint immediately, preserving focus and draft values. Background layout stays locked until closing completes. A pointer starting inside the dialog and ending outside must not count as a backdrop close.

### Details and review

The baseline is the whole form inside one overlay. The earlier single-field carousel remains an optional future experiment, not part of this POC.

Proposed fields are:

| Field | Requirement | Behavior |
| - | - | - |
| Name | Required | Text input with a visible label and name autocomplete |
| Email | Required | Email input with email keyboard and autocomplete |
| Organization | Optional | Clearly labeled optional; may remain blank |
| Message | Required | Roomy multiline editor, at least about six visible lines on a normal viewport |

These fields and requirements are proposed, not confirmed. Do not add telephone numbers, attachments, marketing opt-ins, or other fields without a later decision. No restrictive maximum message length is needed for this local POC; test with a message of at least 2000 characters.

The details view has a Review inquiry action. Validate on that action and when appropriate after a previously invalid field is edited. Show clear inline messages and an error summary that links to invalid fields. Preserve every valid value and focus the error summary or first invalid field.

A small one-time jiggle may supplement required-field feedback, reflecting the earlier discussion, but it is optional, never the sole error signal, and disabled for reduced motion. Do not repeatedly shake the form while someone types.

The review view shows the entered values as plain text, retains message paragraphs, identifies omitted optional values clearly, and provides Edit details and Finish demo actions. Editing restores the populated form. This recap is a proposed POC default drawn from the earlier request to check information before submitting.

### Demo completion

Display a clear Prototype form — nothing is sent notice before the final action. Finish demo performs local validation and displays Demo complete. Nothing was sent. It must not claim that an inquiry was delivered or that someone will reply.

Do not perform a contact POST, send email, call a webhook, or persist a submission. Retain values in memory for further testing until the page is reloaded or the user explicitly resets the demo.

### Keyboard and viewport behavior

The overlay adapts to the visible viewport, including the on-screen keyboard and safe areas. The active field and actions must remain reachable by native scrolling. Textarea editing, scrolling, selection, and cursor movement never advance the background deck.

Move focus to the dialog title when it opens, using a programmatically focusable heading, so opening it does not immediately summon the mobile keyboard. Contain tab navigation and restore focus on close. Give it a descriptive accessible title. A polite message announces the review and completion states; validation errors receive appropriate error associations. Reduced motion opens and closes the overlay immediately without expansion.

## Accessibility and fallback behavior

Implement the complete semantic document before enabling the deck. If JavaScript fails or is disabled, every content section is readable in normal order and contact links reach the contact section. Keep the form plainly marked as a non-delivering prototype; without its script, the form remains disabled and explains that behavior. Enable its fieldset only after the script has installed its submit handler. Prevent native submission so Enter cannot send values through an unintended request or query string.

In animated deck mode, only the active card's content and controls are interactive or exposed as the current section. Previous layers are decorative. Move focus before making its previous owner inert. When a modal is open, the modal is the only active interaction region.

Honor the operating system's reduced-motion preference and provide a review override to test it. The proposed reduced-motion view is normal document flow on all viewport sizes, with all cards visible, no entry animation, no snap gesture, and immediate form transitions. Navigation becomes ordinary section navigation.

All actions must be possible without gestures. Keep visible keyboard focus, meaningful button labels, readable contrast, and touch targets around 44 by 44 CSS pixels even when the visible icon is small. Use color and motion only as supplemental signals.

At enlarged text and zoom, preserve content and actions. Switch to normal flow if necessary; never force tiny typography, hide the form controls, or rely on hover. Maintain pinch zoom. Opaque readable cards are the fallback for unavailable blur effects.

## Implementation structure

Implement the proof of concept in the existing GitHub repository using its established stack, build commands, and Cloudflare preview deployment configuration. Local serving supports development and testing; the final deliverable is the deployed Cloudflare preview. The card interactions need no network calls or third-party animation assets during use. Adapt the suggested module responsibilities below to the existing repository structure.

Suggested separation:

| Area | Responsibility |
| - | - |
| index.html | Semantic content, navigation, contact form, and normal-flow fallback |
| styles.css | Design tokens, card depth, responsive modes, dialog, and focus styling |
| main.js | Enhancement setup and coordination |
| deck-controller.js | Index state, pointer input, velocity, controls, and settlement |
| motion.js | Pure deterministic pose evaluation, release decisions, and preset data |
| layout.js | Viewport geometry, responsive modes, and reading-view switches |
| contact-dialog.js | Expansion, focus, form draft, validation, review, and demo completion |
| demo-settings.js | Review-only layout, motion, and debug settings |
| README.md | Existing local run and Cloudflare preview deployment instructions, preview URL, preset selection, scope, and manual review route |

Keep content data separate from animation state. Motion evaluation takes geometry and progress and returns a pose without reading or mutating the DOM. Render position, angle, and scale with transforms; batch rendering into requestAnimationFrame. Keep rotation and translation derived from the same scalar progress.

Measure geometry on initialization and relevant resize events, not repeatedly inside pointer movement. Observe viewport changes and the visual viewport for keyboard handling. Avoid animating layout dimensions during a swipe. Limit mounted or painted animated layers to the active card, the two previews, and any adjacent incoming or departing card needed for the transition.

The contact overlay uses a separate scrolling region and its own interaction state. Review settings never alter or erase the form draft. Keep all proposed tuning values in one configuration object rather than scattering constants through event handlers.

Use no fresh randomness inside rendering. Scope will-change to cards actively transitioning and remove it afterward. No continuous animation loop should run when idle. Test performance on a real phone before claiming touch quality.

## Build sequence

1. Build the semantic content, visual tokens, normal document flow, contact card, and accessible form dialog. Verify narrow screens before introducing animation.

2. Implement deterministic pose evaluation and a mobile deck controlled by previous and next buttons. Confirm left, right, bottom arrivals and reverse departures.

3. Add direct pointer progress, velocity-sensitive release, cancellation, boundary behavior, and bounded rapid input. Check reversal slowly before tuning flicks.

4. Add card-to-overlay expansion and whole-form details, review, and honest demo completion. Verify keyboard behavior on a phone.

5. Add staggered and conventional desktop views, short-screen and reading fallbacks, and the three motion presets.

6. Perform browser and device verification, commit the implementation to the existing GitHub repository, and deploy it to Cloudflare through the project's established preview workflow, pushing the commit when that workflow requires it. Verify the deployed preview, document results and remaining differences, and deliver its working URL with the review guide.

Do not tune elaborate surface effects before gesture continuity, form scrolling, and readable fallback behavior work.

## Acceptance criteria

| Scenario | Required result |
| - | - |
| Initial load | The first card fades in without translation or rotation; content never remains invisible if enhancement fails |
| Advance through the first arrivals | Cards enter from left, right, and bottom and settle with clear depth and exposed previous edges |
| Slow drag | Translation and rotation track the finger; there is no fixed-time autoplay while the finger is moving |
| Mid-drag reversal | The same card retraces the same pose sequence without a jump or regenerated variation |
| Reverse after settlement | The top card exits along its arrival path and reveals the previous card |
| Short flick | A deliberate flick finishes and settles within 200–400 milliseconds |
| Partial slow release | Release before the commit threshold returns smoothly; release after it completes |
| Direction reversal before release | The final movement direction governs velocity projection; old peak velocity cannot force the earlier direction |
| Deck boundaries | First and last cards cannot wrap or expose a blank state |
| Full history traversal | Active card placement does not drift downward as the deck grows |
| Rapid input | There are no skipped states, frozen controls, or unbounded pending transitions |
| Cancellation or resize | The deck returns to a valid settled index and clears pointer/animation state |
| Contact opening during motion | Pending navigation is cleared and motion settles before expansion; opening does not force the mobile keyboard |
| Direct jump | Return to top and Get in touch reach the intended section without a long chain of intermediary animations |
| Desktop comparison | Staggered and conventional views show the same content in the same meaningful reading order |
| Desktop scroll | Native wheel and touchpad scrolling continue to work; entrances do not hide already read cards |
| Form expansion | The contact card visually expands into a roomy overlay with a working close action |
| Long message | At least 2000 characters can be entered, edited, selected, and reviewed without turning a background card |
| Close and reopen | Form values and the underlying card position survive |
| Validation | Required errors are explained in text; optional organization can stay blank; input is not discarded |
| Review | Values and message paragraphs appear correctly; Edit details restores the populated form |
| Finish demo | Local feedback states that nothing was sent; no submission or analytics request occurs |
| Keyboard and focus | All controls work by keyboard; modal focus stays contained and returns to the opener |
| Reduced motion | All content is readable in normal flow with no deck animation or animated overlay |
| Small screen or enlarged text | Content and actions remain reachable without clipping or forced tiny type |
| JavaScript disabled | Cards remain readable in normal order and the form does not imply real delivery |
| Cloudflare preview | The deployed preview URL loads the intended repository revision and its assets; mobile gestures, desktop layouts, and contact demo work on the hosted site |

Acceptance is a checklist for the future implementation, not a claim that these checks have passed.

## Verification and review deliverables

Use real browser interaction for the implementation, including smoke checks on the deployed Cloudflare preview. Confirm the preview loads the intended revision and its assets, then verify mobile card navigation, both desktop views, contact expansion, and the simulated form completion on the hosted site. Desktop coverage should include current Chromium, Firefox, and Safari where available. Touch coverage should include an Android Chromium browser and iPhone Safari where available; emulated pointer input alone does not establish native scroll and keyboard behavior. Record any unavailable browser as unverified.

Exercise portrait sizes around 320 by 568 and 390 by 844 CSS pixels, a short landscape viewport, tablet widths around the breakpoint, and desktop widths around 1280 and 1440 pixels. Include enlarged text, zoom, reduced motion, keyboard-only navigation, JavaScript disabled, touch cancellation, slow reversal, rapid button presses, and an open keyboard with a long message.

Appropriate focused automated checks cover deterministic pose evaluation, release and boundary decisions, and state continuity through reversal. Browser checks cover navigation, dialog focus, validation, preserved draft state, reduced-motion fallback, and absence of submission requests. Do not claim a performance result from screenshots alone.

Deliver the working Cloudflare preview URL, the implementation committed in the existing GitHub repository, this specification, and a README describing the existing local run and preview deployment workflow plus demo settings. Include the deployed revision, a short browser verification log covering the hosted preview, and brief recordings of slow reversible dragging, a flick, and contact expansion. Identify unverified devices and any POC limitations. The proof of concept is complete when the preview is deployed and checked, rather than when it only runs locally.

The review should decide whether the mobile arc and stacking feel right, which motion preset to carry forward, whether staggered desktop cards help reading, and whether the expanded form is comfortable. Record feedback against the proposed defaults before treating this as a final website design.
