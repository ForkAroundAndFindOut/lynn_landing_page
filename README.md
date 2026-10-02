# Stacked card layout proof of concept

An isolated exploration for Lynn Renezeder’s static Fractional HR Consulting site. The parent branch is `codex/card-layout`, based on `main` at `0b10b41b59e717da2cc6f83f9e950250541eac3d`. Existing branches and production are retained. Future card-layout experiments can branch from this parent.

[STACKED_CARD_SPEC.md](STACKED_CARD_SPEC.md) is the supplied implementation brief. The existing [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md) remains as historical site context; this POC brief supersedes its layout and form design for this branch only. Existing Georgia typography, semantic navy/gold/pink tokens, core service language, privacy rules, and static build workflow are retained. The example engagement is explicitly illustrative and no client claims or personal contact information have been added.

Desktop layout, form fields, dimensions, and motion presets are exploratory defaults, not final design approval. The form validates and reviews values in memory; finishing says **Demo complete. Nothing was sent.** Nothing is stored or transmitted.

## Run locally

No package installation is needed for the website, build, or unit tests. Use the existing Node.js and Python installations:

```powershell
node --test tests/*.test.mjs
node build.mjs
python -m http.server 4188 --bind 127.0.0.1 --directory dist
```

Open [the local preview](http://127.0.0.1:4188). `npm test` and `npm run build` are equivalent conveniences. The build copies public assets only; documentation, tests, verification evidence, and Git metadata are excluded. `dist/revision.json` reports the source commit and SHA-256 hashes of all website assets.

## Review route

1. At approximately 390 × 844, use the arrows or drag **open space** inside the card. Text stays selectable. Move slowly up, reverse before release, then try a quick flick. Check left, right, and bottom arrivals and reverse departures.
2. Compare Balanced, Crisp, and Gentle in **POC review**. The panel is for testing only. Optional gesture-state output is off by default.
3. Try **Read as page**, then **Use card view**. Short screens, enlarged content that cannot fit, and reduced motion use native document flow. A narrow screen alone does not force clipped cards.
4. On desktop, compare Staggered cards and Read as document. DOM reading order stays the same; the wheel remains native.
5. **Get in touch** in the header jumps to the contact card. Its separate button expands the form. Open it, submit empty details to see errors, then enter test values and a long message. Review, edit, finish, close, and reopen to check draft retention.
6. Use keyboard arrows/Home/End while focus is in the deck or its controls; Tab through the modal and Escape to close. Try reduced motion, no JavaScript, text enlargement, and orientation changes.

Demo URL options can be combined:

| Query | Behavior |
| --- | --- |
| `?preset=crisp` / `?preset=gentle` | Choose a settlement preset |
| `?desktop=conventional` | One-column desktop comparison |
| `?motion=reduce` | Reduced motion document flow; OS reduction always wins |
| `?view=page` | Start in native reading mode |
| `?debug=1` | Show gesture state inside the review panel |
| `#services`, `#how-it-works`, `#example`, `#working-together`, `#contact` | Select the same section in every layout |

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
npx wrangler versions upload --preview-alias card-layout --message 'Stacked card layout proof of concept'
```

Record the actual returned URL and deployed revision in [verification/VERIFICATION.md](verification/VERIFICATION.md), then compare `/revision.json` and run hosted browser checks. A guessed alias is not deployment evidence.

## Verification

`tests/motion.test.mjs` checks deterministic paths, reverse continuity, release projection, bounds, queued navigation, cancellation, and interrupted state cleanup. Browser coverage and unavailable devices are recorded in [verification/VERIFICATION.md](verification/VERIFICATION.md). Browser automation is development tooling only and is not bundled into the site.

Physical iPhone Safari and Android touch/keyboard behavior require device review. Emulated pointers and screenshots do not establish native touch quality or performance. This is a non-delivering, noindex preview, not a production launch.
