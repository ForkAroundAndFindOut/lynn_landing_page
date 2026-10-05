# Movement lab verification

Date: October 4, 2026. Current scope supersedes historical finger-pinned dragging and queued navigation in earlier verification records.

The owner approved the reminder on the existing Cloudflare preview and its promotion into the card prototype parent. Development proceeds on `codex/card-layout-tuning`, based on approved reminder `b14176fdec35e2460d0aa33abcdc64025d4c5a14`. The parent `codex/card-layout` incorporated that reminder with a fast-forward. Production `main`, all original branches, and the reminder baseline branch are preserved.

## Implementation

The expanded POC review panel exposes 25 movement parameters with numeric inputs and sliders, except the flick checkbox. Mobile controls scroll independently within 45% of viewport height; wide explicit Card view reserves 360px for the panel. Automatic and Reading modes keep the existing native flow and contact behavior. Cookie version 2 remembers settings for 30 days, migrates v1 preferences, validates values, and stores no form values or browsing position. Reload starts at the top. No sharing URL is added.

Touch/drag and wheel/trackpad bursts attempt one adjacent request. Detection speed never dictates animation speed. A configurable shared gate drops early requests across touch, wheel, buttons, and keyboard; after it opens, new requests can retarget current animation. Duration scales with remaining card distance. Motion configuration is captured per request; gate changes are live. Presets adjust four motion fields only. Pose residuals preserve continuity across geometry, bounce, and section-jump fade interruptions, including a 100ms constant-position recovery for zero-distance fade reversal.

## Local checks

The complete Node suite passes **52 tests**, covering exact gate boundaries, live gate changes, consumed rejected gestures/bursts, lifecycle cleanup, globally nearest settlement, velocity normalization, bounce endpoints, pose continuity, semantics/focus, parameter validation, cookie migration and blocked persistence.

[Tuning browser checks](tuning/local/tuning-results.md) pass **20/20** in Chromium, with zero browser or asset errors. Trusted text-origin swipes, flicks, one-attempt contacts, wheel bursts, keyboard/buttons, rapid retargeting, independent timing, all controls, persistence/reset, wide/mobile panel scrolling, reduced motion, and readable fallbacks pass. Measured preset durations are approximately 603/908/1311ms; fast/slow touch approximately 908/910ms; 20/2000px wheel input approximately 909/914ms. These are browser-frame measurements with documented tolerances, not physical-device performance claims.

The retained reading/contact/desktop suite is run with an anchored name filter, excluding superseded finger-pinned drag checks. Reports and screenshots are in [local regressions](tuning/local-regressions/browser-results.md). Reminder checks retain real five-second waits and explicitly labelled synthetic visibility/selection cases, in [local reminder checks](tuning/local-reminder/hint-results.md).

Independent review identified and repaired adjacent interruption of section-jump opacity and zero-distance reversal. Browser verification identified and repaired the native details-content sizing issue that prevented the panel's lower controls from scrolling into view. Root visually reviewed mobile and wide screenshots. Early trial failures were test sampling/filter assumptions or these repaired defects; final acceptance reports replace those trials. The reminder's hidden-tab assertion now compares elapsed rearming time rather than assuming an exact number of startup focus events.

## Hosted rollout

Hosted acceptance and final branch promotion are recorded below after the non-production version upload. Preview assets must match the intended committed source and twelve-asset manifest before declaring completion. No Worker production deployment, version promotion, or routing change is authorized by this prototype work.

## Coverage and limits

Modern Chrome, Edge, Firefox, and Safari remain the compatibility target; [standards research](BROWSER_COMPATIBILITY.md) records the input basis. Current automation uses the existing Windows Chromium 149 runtime and trusted browser-dispatched inputs, with mobile/Android emulation. Native Safari/iPhone, Firefox, Edge, physical touchscreens/trackpads, Android selection/pinch, and on-screen keyboards were unavailable and remain unverified. Known unavailable Playwright WebKit is reported separately, without repeating its hanging environment setup. No new environments or runtime dependencies were added.

The owner's reported functional device QA covered the earlier Cloudflare build only, and later confirmed the reminder working. It is not a test of this new tuning revision and never represented local-instance QA. Contact delivery remains simulated; final parameter/layout choices remain design-review decisions. Gate/quiet thresholds are application settings, not OS-defined gesture boundaries. Legacy direct-drag math remains internal for possible future exploration.
