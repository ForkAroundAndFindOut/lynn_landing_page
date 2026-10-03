# Stacked card layout proof of concept

An isolated exploration for Lynn Renezeder’s static Fractional HR Consulting site. The parent branch is `codex/card-layout`, based on `main` at `0b10b41b59e717da2cc6f83f9e950250541eac3d`. Existing branches and production are retained. Future card-layout experiments can branch from this parent.

**[Open the Cloudflare preview](https://codex-card-layout-lynn-landing-page.nrct6ycww6.workers.dev)** · [GitHub branch](https://github.com/ForkAroundAndFindOut/lynn_landing_page/tree/codex/card-layout) · [Verification log](verification/VERIFICATION.md)

[STACKED_CARD_SPEC.md](STACKED_CARD_SPEC.md) is the supplied implementation brief. The existing [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md) remains as historical site context; this POC brief supersedes its layout and form design for this branch only. Existing Georgia typography, semantic navy/gold/pink tokens, core service language, privacy rules, and static build workflow are retained. The example engagement is explicitly illustrative and no client claims or personal contact information have been added.

Desktop layout, form fields, dimensions, and motion presets are exploratory defaults, not final design approval. The form validates and reviews values in memory; finishing says **Demo complete. Nothing was sent.** Contact values are never stored or transmitted. Only POC review preferences are saved in a cookie.

## Run locally

No package installation is needed for the website, build, or unit tests. Use the existing Node.js and Python installations:

```powershell
node --test tests/*.test.mjs
node build.mjs
python -m http.server 4188 --bind 127.0.0.1 --directory dist
```

Open [the local preview](http://127.0.0.1:4188). `npm test` and `npm run build` are equivalent conveniences. The build copies public assets only; documentation, tests, verification evidence, and Git metadata are excluded. `dist/revision.json` reports the source commit and SHA-256 hashes of all website assets.

Card mode supports touch swipes, trackpad scrolling, and mouse wheels. Swipe a finger upward or scroll downward to advance; reverse to go back. Wheel bursts follow the same card paths, settle after a brief pause, and advance at most one card so a trackpad momentum tail cannot skip content. Wide desktop and reading layouts use ordinary page scrolling. Browser checks emulate input delivery; physical Mac/PC trackpads and touchscreens still need device QA.

## Review route

1. At approximately 390 × 844, swipe upward on ordinary **text or open space** for the next card, downward for the previous card, or use the arrows. Move slowly, reverse before release, then try a quick flick. Check left, right, and bottom arrivals and reverse departures. Card mode prioritizes swiping: early selection initiation is suppressed during the first 350ms of an eligible pending touch, and selection is suppressed during acquired dragging. A stationary hold yields to native text selection. The cutoff is application tuning and needs physical-device confirmation; links, controls, mouse selection, and reading/form views retain native behavior. Two fingers yield to pinch zoom. Text remains semantic HTML.
2. Compare Balanced, Crisp, and Gentle in **POC review**. Settings and panel open state are remembered for 30 days in this browser on this preview hostname; refreshing starts at the first card/page top. Use **Reset review settings** to clear saved preferences. Optional gesture-state output is off by default. Fresh section links still open their destination.
3. Try **Read as page**, then **Use card view**. Short screens, enlarged content that cannot fit, and reduced motion use native document flow. A narrow screen alone does not force clipped cards.
4. On desktop, compare Staggered cards and Read as document. Staggered entrances trigger 15% of viewport height above the bottom, wait 80ms, then fade over 380ms. Already read cards remain visible. DOM reading order stays the same; the wheel remains native.
5. **Get in touch** in the header jumps to the contact card. Its separate button expands the form. Open it, submit empty details to see errors, then enter test values and a long message. Review, edit, finish, close, and reopen to check draft retention.
6. Use keyboard arrows/Home/End while focus is in the deck or its controls; Tab through the modal and Escape to close. Try reduced motion, no JavaScript, text enlargement, and orientation changes.

Demo URL options can be combined:

| Query | Behavior |
| --- | --- |
| `?preset=balanced` / `?preset=crisp` / `?preset=gentle` | Override the saved settlement preset |
| `?desktop=conventional` / `?desktop=staggered` | Override the saved desktop comparison |
| `?motion=reduce` / `?motion=normal` | Override review reduction; OS reduction always wins |
| `?view=page` | Start in native reading mode |
| `?debug=1` / `?debug=0` | Override optional gesture state inside the review panel |
| `#services`, `#how-it-works`, `#example`, `#working-together`, `#contact` | Fresh links select the same section in every layout; reload restarts at top |

Valid URL settings override saved preferences on entry; invalid values are ignored. Changing review controls saves the new choices and removes review URL overrides while retaining unrelated parameters. Cookies are host-only (`lynn_review_settings`, schema version 1, SameSite=Lax, Secure on HTTPS); local and Cloudflare preferences are separate. Cookie failures leave settings usable with a short notice. No contact draft or section history is saved.

## Cloudflare branch preview

This repository uses an asset-only Worker named `lynn-landing-page`, with version URLs enabled in `wrangler.jsonc`. `main` is production. **Use version upload for this test branch; do not run `wrangler deploy`, promote a version, or change production routing.**

The existing Workers Builds commands are:

```text
Build command: None
Production deploy command (existing main only): node build.mjs && npx wrangler deploy
Non-production version command: node build.mjs && npx wrangler versions upload
```

Allow `codex/card-layout` in non-production branch builds alongside any existing allowed branches. A push to this new branch can then create a version preview. Do not remove existing branches or migrate the existing Worker’s preview system as part of this POC.

With authenticated Wrangler, an explicit version upload can create the review alias without touching production:

```powershell
node build.mjs
npx wrangler versions upload --preview-alias codex-card-layout --message 'Stacked card layout proof of concept'
```

Record the actual returned URL and deployed revision in [verification/VERIFICATION.md](verification/VERIFICATION.md), then compare `/revision.json` and run hosted browser checks. A guessed alias is not deployment evidence.

## Verification

Focused tests check deterministic paths, scale-compensated stack depth, reverse continuity, release projection, bounds, queued navigation, touch arbitration and interruption cleanup, cookie schema, URL precedence, and persistence failure handling. Browser coverage and unavailable devices are recorded in [verification/VERIFICATION.md](verification/VERIFICATION.md). Browser automation is development tooling only and is not bundled into the site.

Short recordings: [text-start reversible dragging](verification/hosted/touch-text-reversal.webm), [text-start flick](verification/hosted/touch-text-flick.webm), [contact expansion](verification/hosted/contact-expansion.webm).

To rerun browser checks with an installed Playwright module and browsers, set `PW_MODULE` (module path) and `PW_BROWSERS` (browser installation directory), then run `node tests/browser-checks.mjs`. The defaults target the existing Codex-bundled installation on this workstation. `BASE_URL` selects local or hosted testing and `EVIDENCE_DIR` selects the output folder. See the script for engine paths and bounded WebKit coverage. `node tests/verify-deployment.mjs <commit>` separately verifies every hosted asset against the commit and build manifest, and compares production to its captured baseline.

Physical iPhone Safari and Android touch/keyboard behavior require device review. Emulated pointers and screenshots do not establish native touch quality or performance. This is a non-delivering, noindex preview, not a production launch.
