# Movement lab verification

Current link-origin swipe correction is recorded in [LINK_SWIPES.md](LINK_SWIPES.md). The movement-lab rollout below remains its historical baseline; the follow-up allows card links/buttons to participate in full-distance swipes while preserving taps.

Date: October 4, 2026. Current scope supersedes historical finger-pinned dragging and queued navigation in earlier verification records.

The owner approved the reminder on the existing Cloudflare preview and its promotion into the card prototype parent. Development proceeds on `codex/card-layout-tuning`, based on approved reminder `b14176fdec35e2460d0aa33abcdc64025d4c5a14`. The parent `codex/card-layout` incorporated that reminder with a fast-forward. Production `main`, all original branches, and the reminder baseline branch are preserved.

## Implementation

The expanded POC review panel exposes 25 movement parameters with numeric inputs and sliders, except the flick checkbox. Mobile controls scroll independently within 45% of viewport height; wide explicit Card view reserves 360px for the panel. Automatic and Reading modes keep the existing native flow and contact behavior. Cookie version 2 remembers settings for 30 days, migrates v1 preferences, validates values, and stores no form values or browsing position. Reload starts at the top. No sharing URL is added.

Touch/drag and wheel/trackpad bursts attempt one adjacent request. Detection speed never dictates animation speed. A configurable shared gate drops early requests across touch, wheel, buttons, and keyboard; after it opens, new requests can retarget current animation. Duration scales with remaining card distance. Motion configuration is captured per request; gate changes are live. Presets adjust four motion fields only. Pose residuals preserve continuity across geometry, bounce, and section-jump fade interruptions, including a 100ms constant-position recovery for zero-distance fade reversal.

## Local checks

The complete Node suite passes **52 tests**, covering exact gate boundaries, live gate changes, consumed rejected gestures/bursts, lifecycle cleanup, globally nearest settlement, velocity normalization, bounce endpoints, pose continuity, semantics/focus, parameter validation, cookie migration and blocked persistence.

[Tuning browser checks](tuning/local/tuning-results.md) pass **20/20** in Chromium, with zero browser or asset errors. Trusted text-origin swipes, flicks, one-attempt contacts, wheel bursts, keyboard/buttons, rapid retargeting, independent timing, all controls, persistence/reset, wide/mobile panel scrolling, reduced motion, and readable fallbacks pass. Measured preset durations are approximately 603/908/1311ms; fast/slow touch approximately 908/910ms; 20/2000px wheel input approximately 909/914ms. These are browser-frame measurements with documented tolerances, not physical-device performance claims.

The retained reading/contact/desktop suite passes **31/31**, with one known unavailable WebKit engine reported separately. It uses an anchored name filter excluding superseded finger-pinned drag checks; reports and screenshots are in [local regressions](tuning/local-regressions/browser-results.md). Reminder checks pass **19/19**, retaining real five-second waits and explicitly labelled synthetic visibility/selection cases, in [local reminder checks](tuning/local-reminder/hint-results.md). Combined local browser acceptance is **70 PASS, 0 FAIL**, plus one unavailable engine. Local reports were generated before commit and identify the prior parent HEAD with candidate asset hashes; they are not a claim that the old reminder revision contains these new controls.

Independent review identified and repaired adjacent interruption of section-jump opacity and zero-distance reversal. Browser verification identified and repaired the native details-content sizing issue that prevented the panel's lower controls from scrolling into view. Root visually reviewed mobile and wide screenshots. Early trial failures were test sampling/filter assumptions or these repaired defects; final acceptance reports replace those trials. The reminder's hidden-tab assertion now compares elapsed rearming time rather than assuming an exact number of startup focus events.

## Hosted rollout

Cloudflare non-production build `f7aef8c2-8a66-485d-94ad-07b8e9e30483` successfully uploaded application source `10b194bd97b69b362d9c96cbe39b9fb8d243bd2a`. [Hosted integrity](tuning/hosted/integrity.json) verifies all twelve public assets against both commit and manifest, original local/remote branch heads (including the preserved reminder baseline), the original checkout on main, and unchanged production HTML.

Hosted acceptance is **70 PASS, 0 FAIL**, plus one known unavailable WebKit engine: [20 tuning checks](tuning/hosted/tuning-results.md), [31 retained regressions](tuning/hosted-regressions/browser-results.md), and [19 reminder checks](tuning/hosted-reminder/hint-results.md). Completion timestamps are 2026-10-05T03:31:37Z–03:32:12Z (October 4 locally). All reports identify the same source revision. Zero browser/asset faults and no contact submissions were observed. Hosted presets measured approximately 607/910/1305ms, fast/slow text swipes 914/909ms, and 20/2000px wheel input 908/911ms. The rapid zero-gate three-card traversal measured approximately 2706ms for 2700ms configured travel time.

Updated hosted recordings demonstrate [text-start command and retarget](tuning/hosted-recordings/text-command-and-retarget.webm), [short text-start flick](tuning/hosted-recordings/text-flick.webm), and [contact expansion](tuning/hosted-recordings/contact-expansion.webm). Their [recording manifest](tuning/hosted-recordings/recordings.json) identifies the uploaded revision. These supersede reversible finger-pinned demonstration videos for the current command-gesture contract.

The final evidence revision retains identical public asset bytes and is the promotion target for `codex/card-layout`. Both alias revisions and asset manifests are checked after upload; final integrity records are generated under ignored `dist/final-verification` to avoid a self-referential evidence-commit cycle. Prototype parent: https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev/. Tuning branch: https://codex-card-layout-tuning-lynn-landing-page.nrct6ycww6.workers.dev/.

The unchanged production deployment is `ddc66df0-16e5-40ec-ad73-4674ac227f9a`, with version `b19c9862-7fce-4372-9b27-aa4ee193189f` serving 100%. Production HTML remains SHA-256 `4e48750db67c9167ae8cde0d95bc5eaf4f326e9613143f39b976474e50c8cae3`. No Worker production deployment, version promotion, or routing change was performed. Independent bounded review verified both jump-fade corrections and found no remaining material concerns.

## Coverage and limits

Modern Chrome, Edge, Firefox, and Safari remain the compatibility target; [standards research](BROWSER_COMPATIBILITY.md) records the input basis. Current automation uses the existing Windows Chromium 149 runtime and trusted browser-dispatched inputs, with mobile/Android emulation. Native Safari/iPhone, Firefox, Edge, physical touchscreens/trackpads, Android selection/pinch, and on-screen keyboards were unavailable and remain unverified. Known unavailable Playwright WebKit is reported separately, without repeating its hanging environment setup. No new environments or runtime dependencies were added.

The owner's reported functional device QA covered the earlier Cloudflare build only, and later confirmed the reminder working. It is not a test of this new tuning revision and never represented local-instance QA. Contact delivery remains simulated; final parameter/layout choices remain design-review decisions. Gate/quiet thresholds are application settings, not OS-defined gesture boundaries. Legacy direct-drag math remains internal for possible future exploration.
