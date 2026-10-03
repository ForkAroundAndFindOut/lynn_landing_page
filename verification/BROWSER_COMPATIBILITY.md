# Browser compatibility research

Date: 2026-10-03 (America/Los_Angeles). Target: current Chrome, Edge, Firefox, and Safari on their supported platforms. A delegated Luna researcher at xhigh effort reviewed browser standards, vendor documentation, and standards-position discussions. This is implementation guidance, separate from engine/device verification.

## Implementation decisions

| Area | Decision and basis |
| --- | --- |
| Trackpad and wheel | Use standard WheelEvent input, normalize deltaMode before reading deltas, and recognize one adjacent-card request. Device/OS delta magnitudes do not control animation progress or duration. [MDN wheel events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event), [deltaMode](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode) |
| Native scrolling | Attach the non-passive wheel listener only in card mode; remove it in desktop/reading flow. Preserve native controls, nested scroll regions, horizontal input, and modified zoom input. Wheel cancelability differs by browser, including first-event-only sequences. [Chrome scrolling intervention](https://developer.chrome.com/blog/scrolling-intervention-2/), [event listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) |
| Touch and zoom | Pointer Events own vertical card dragging; touch-action:pan-x pinch-zoom retains browser horizontal panning and pinch. Selection is handled separately through scoped user-select suppression and intentional-hold yielding. [Pointer Events](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property), [WHATWG compatibility standard](https://compat.spec.whatwg.org/#touch-action) |
| Safari | WebKit shipped Pointer Events in Safari 13. Historical pan-x/address-bar reports were fixed in the iOS 16 era; they do not establish a current blocker. No browser-name detection or global Safari gesture cancellation is added. [WebKit Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [WebKit issue 233417](https://bugs.webkit.org/show_bug.cgi?id=233417) |
| Gesture boundaries | A 16px intent threshold, 16px line conversion, and 400ms quiet interval are application heuristics. Browser wheel-transaction timing is implementation-specific; there is no universally supported gesture-end/momentum phase. Locking until both quiet and animation completion prevents tested tail sequences from issuing another request. [Pointer Events Level 4 draft](https://www.w3.org/TR/pointerevents4/) |

The requested motion presets use fixed 240ms, 300ms, and 380ms durations. Touch tracking remains continuously reversible. Wheel input requests a complete card animation and never leaves an input-controlled partial card.

WheelEvent.momentum is a boolean proposed in the Pointer Events Level 4 Working Draft, outside the current Level 3 Recommendation. Mozilla's position is positive; WebKit's request is unresolved, and support is not cross-engine. It is not required by this implementation. [Draft interface](https://www.w3.org/TR/pointerevents4/#dom-wheelevent-momentum), [Mozilla position](https://github.com/mozilla/standards-positions/issues/1425), [WebKit request](https://github.com/WebKit/standards-positions/issues/688).

## Verification scope

Focused tests verify normalized intent, fixed duration independent of delta magnitude, single-card requests, quiet/animation gating, listener removal, lifecycle cleanup, touch capture, and persistence. Chromium browser automation checks actual wheel/pointer delivery and rendering; synthetic unit modes and visibility events are labelled separately in evidence.

Firefox, native Safari, physical Edge/Chrome trackpads, phone/tablet gestures, and desktop touchscreens were not tested as a local environment matrix. Device QA should confirm one two-finger gesture including its momentum tail, a distinct reverse gesture, native zoom/horizontal gestures, and form scrolling. A real stream pausing beyond the heuristic quiet interval can be classified as another burst; no standards research can prove universal physical-device behavior. The owner-reported speed/partial-card feedback from the proportional prototype is recorded in VERIFICATION.md and led to the discrete request contract.
