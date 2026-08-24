# Lynn Renezeder Fractional HR Consulting
## Landing Page Implementation Specification

Status: approved planning brief; implementation has not started.

## 1. Purpose, goal, and delivery boundary

Build a single-page lead-generation website for **Lynn Renezeder — Fractional HR Consulting**. The page must make a growing-company founder or COO feel that experienced HR leadership is immediately available, then make it easy to begin a confidential consultation through a short Contact Us form.

The production source of truth will be this Git repository. Web on Demand is not part of the delivery path. A later Cloudflare milestone will own hosting, the bot-protected one-way form endpoint, and production deployment.

### Goals

- Establish a calm, credible, modern HR-consulting presence.
- Make the Contact Us path visible without publishing a phone number, email address, or other personal contact information.
- Be responsive, accessible, search-ready, and light enough to load smoothly on mobile.
- Use the agreed glass-pane visual language without sacrificing readability or performance.
- Keep content, services, testimonials, and form transport replaceable without redesigning the page.

### Explicitly out of scope for this phase

- Cloudflare account configuration, deployment, DNS, custom domain, Workers, Pages, Turnstile, email delivery, data storage, rate limiting, and observability.
- A live form submission endpoint or a fabricated success state.
- Real testimonials, client logos, claims, credentials, metrics, address, phone number, or email address unless Lynn explicitly supplies and approves them.
- Paid media, analytics, cookie consent, localization, blog/content strategy, or additional pages.
- A production-ready generated texture asset. The first implementation may use a small CSS texture or solid visual filler.

## 2. Decisions locked by the design review

| Area | Decision |
| --- | --- |
| Brand | Lynn Renezeder, with Fractional HR Consulting as the descriptor |
| Audience | Founders and COOs at growing small-to-mid-sized companies |
| Page type | One focused landing page |
| Hero H1 | HR leadership for growing teams |
| Primary CTA | Contact Us |
| Form purpose | Book a consultation through a short, bot-protected form in the later backend phase |
| Contact details | Do not publish email, phone, mailto links, or personal contact details |
| Core service pillars | Fractional HR Leadership; People Foundations; Manager and Team Support |
| Design tone | Quiet executive confidence: warm, clear, restrained, and trustworthy |
| Typeface | Georgia, with a sensible serif fallback only |
| Hero/form layout | Full Contact Us form beside hero copy on desktop; a direct path to the form on small screens |
| Page flow | Sticky navigation; hero/form; experience; services; engagement approach; testimonials; FAQ; closing CTA/footer |
| Services interaction | Accessible base service list, enhanced by an invisible-frame vertical carousel |
| Testimonial interaction | Visible placeholder cards are allowed only when each is labeled Sample testimonial — replace before launch |
| Texture | A subtle Navy Blue-dominant decorative background; simple CSS/static filler is sufficient for the first build |
| Delivery | Git repository is canonical; Cloudflare is later production infrastructure; Web on Demand is cancelled |

## 3. Visual system

### 3.1 Brand color tokens

The current palette reference is [color_palette_and_font.txt](color_palette_and_font.txt). Do not scatter raw hex values through component code; expose semantic tokens and consume the tokens instead.

| Token role | Brand color | Required use |
| --- | --- | --- |
| Primary ink and major background | Navy Blue, #000080 | Main text, headings, dark section/background treatment |
| Highlight and icon accent | Gold, #FFD700 | Icons, small highlights, selected-state detail |
| Borders, surfaces, secondary UI | Slate Gray, #808080 | Borders, quiet surface detail, non-critical UI |
| Primary CTA emphasis | Pink, #FFC0CB | Contact Us buttons and sparing conversion emphasis |
| Supporting neutral | White or near-white | Glass-panel surfaces and high-contrast text/surface combinations |

### 3.2 Contrast rules

- Navy Blue is the default reading color on light panels and the default background for light text.
- Gold and Pink are accents, not body-text colors on a light surface.
- Navy text on Gold or Pink may be used for a CTA only after rendered-state contrast verification.
- Slate Gray #808080 is roughly 4:1 against both white and Navy Blue. It must not be used for normal-size secondary copy where it misses the required contrast ratio. Use it chiefly for borders/surfaces, or use a verified higher-contrast derived neutral token for secondary text.
- Every glass treatment must be checked against the final composited texture, not merely its isolated panel color.
- Visible keyboard focus states must be distinct from hover and must remain visible on both light and dark surfaces.

### 3.3 Typography and layout

- Use Georgia first in the font stack. Do not introduce a second display typeface.
- Keep body copy at 16 CSS pixels or larger with readable line-height. Headings must have a clear hierarchy and never rely on color alone for meaning.
- Use a spacious marketing-page rhythm. Avoid a dense dashboard look, oversized all-caps text, or multiple competing hero headings.
- Use a centered content container with responsive gutters. No viewport may require horizontal scrolling.
- Use SVG icons or simple CSS shapes; do not use emoji as interface icons.

### 3.4 Glass, texture, and motion

- Glass panes are semi-opaque, bordered surfaces over a restrained Navy/Slate texture. Essential text must always sit on a reliably legible panel.
- The first release may use a lightweight CSS gradient/noise treatment instead of generated artwork. If a texture image is later supplied, it must be decorative, optimized, dimensioned, and non-essential.
- Suggested texture composition: Navy dominant, Slate as soft depth, small Gold highlights, and only trace Pink. Avoid large bright Gold or Pink fields.
- Do not make parallax a prerequisite. If enabled later, use a small transform-only effect and disable it when the user requests reduced motion.
- Provide a polished opaque/simplified fallback when backdrop-filter is unsupported.

## 4. Information architecture and content contract

| Section | Required content and behavior |
| --- | --- |
| Sticky navigation | Typographic brand treatment; anchor links for Services, How It Works, FAQ, and Contact Us; prominent Contact Us action; no personal contact details |
| Hero | Single H1: HR leadership for growing teams; outcome-focused supporting copy; full desktop form; no stock HR imagery |
| Contact form | See Section 5.1 |
| Experience / credibility | Editable, factual experience/credential presentation only. Do not invent years, industries, certifications, outcomes, or affiliations. |
| Services | Three service pillars with concise editable explanations: Fractional HR Leadership, People Foundations, and Manager and Team Support |
| How It Works | A concise, editable explanation of the engagement path. Keep claims factual and remove unsupported promises. |
| Testimonials | Carousel-capable sample cards with the required visible sample label. No client names, logos, metrics, or claims until approved. |
| FAQ | Keyboard-accessible answers to approved, factual questions. Do not add answers that imply an unapproved legal, compliance, or service commitment. |
| Closing CTA / footer | Repeats Contact Us and returns to the primary form; includes no email, phone, address, or hidden personal contact data. |

### 4.1 Copy rules

- The voice is senior, calm, plainspoken, and helpful. Avoid HR jargon, inflated promises, startup hype, and fear-based conversion copy.
- The dominant story is the business outcome first, then Lynn's personal expertise.
- All service and credibility text remains selectable HTML text, never text baked into a texture, canvas, animation, or image.
- Use only claims that have a confirmed owner and source. If an item is unknown, use an editable content marker during development and block it from public launch.

## 5. Component and interaction contracts

### 5.1 Contact Us form

#### Visual and field requirements

- Form heading may say Book a consultation; the buttons and navigation CTA say Contact Us.
- Show persistent visible labels. Placeholders never substitute for labels.
- Field set:
  - Name
  - Work email
  - Company
  - Team size
  - How can we help? native select dropdown
- Dropdown options:
  - Fractional HR leadership
  - HR foundations and policies
  - Employee relations
  - Manager coaching
  - Growth / scaling support
  - Something else
- Default validation minimum: Name, Work email, and contact reason are required. Keep Company and Team size configurable so the final conversion/privacy decision can make them required or optional without markup redesign.
- Use correct input types and meaningful autocomplete attributes. Do not collect fields outside this agreed set without a deliberate design decision.

#### UI-only integration boundary

- This phase builds form UI, client-side validation, disabled/loading/error/success state components, and a clearly isolated submission adapter.
- The adapter must not send real data until the later Cloudflare security and delivery milestone is complete.
- Do not display a successful delivery confirmation without a configured endpoint that has actually returned success.
- When a form is invalid, move focus to an error summary or the first invalid field, associate messages with fields programmatically, and do not use color as the only error signal.
- When a live backend exists, announce real success/failure status accessibly and avoid logging form content to browser consoles or client analytics.

### 5.2 Services list and vertical carousel

- Render all three services as a semantic, readable list in the initial HTML.
- Enhance the visual presentation with an invisible-window vertical carousel. The featured point rests at visual center; the outgoing point accelerates upward/out; the incoming point decelerates into center.
- Animate only transform and opacity. Avoid layout-triggering animation of height, width, top, or left.
- Provide visible previous, next, and pause controls. Controls need accessible names, keyboard support, and at least 44 by 44 CSS-pixel touch targets where feasible.
- Pause auto-advance on hover and keyboard focus. If automatic rotation is retained, dwell long enough to read and never reset a user's manual choice unexpectedly.
- With prefers-reduced-motion, JavaScript disabled, or an animation failure, show the stable list without auto-advance.
- Any cloned nodes used to create an animation loop must be hidden from assistive technology and excluded from keyboard focus.

### 5.3 Testimonials carousel

- Initial cards may contain Lorem Ipsum only to test layout and motion.
- Every placeholder card must display: **Sample testimonial — replace before launch**.
- Do not add a person, job title, company, logo, star rating, metric, or success claim to placeholder cards.
- Default to manual controls. If automatic rotation is added, offer pause controls and the same reduced-motion safeguards as the services carousel.
- The launch gate requires approved quote text, attribution, permission to publish, and a content owner; otherwise hide the testimonial section.

### 5.4 FAQ and navigation

- Use semantic buttons for FAQ headers with expanded/collapsed state exposed programmatically.
- All navigation anchor targets must account for the sticky header so a heading is never hidden underneath it.
- Navigation, FAQ, carousels, and form work with keyboard alone. No action relies only on hover, swipe, or animation.

## 6. SEO, social metadata, and indexing contract

The one-page site must be technically ready for search without overclaiming facts or treating schema as a ranking shortcut.

### 6.1 Page-level metadata

- Exactly one H1: **HR leadership for growing teams**.
- Provisional title: **Fractional HR Consulting for Growing Teams | Lynn Renezeder**.
- Provisional meta description: **Lynn Renezeder provides fractional HR leadership, people foundations, and manager support for growing teams. Contact us to book a consultation.**
- Use a correct document language and responsive viewport metadata.
- Keep the title, main H1, visible copy, and social title conceptually aligned. Revise the provisional title/description only with approved service and audience language.

### 6.2 Crawlability and production domains

- The production homepage must render meaningful content, headings, services, FAQ, and primary CTA in initial static/rendered HTML; these may not require a carousel interaction to become visible.
- Do not lock canonical, Open Graph URL/image, sitemap URLs, or production robots rules until the final HTTPS domain is known.
- Once configured, production must have one absolute canonical URL, a root robots.txt with sitemap declaration, and a root sitemap.xml listing only that canonical homepage for this release.
- Preview and staging deployments must be non-indexable using noindex metadata or an X-Robots-Tag. Do not rely on robots.txt alone to prevent indexing.
- Do not block required CSS, JavaScript, images, or fonts from crawling.

### 6.3 Social metadata and images

- Add Open Graph title, description, type, URL, image, image alt, and site name once production asset URLs are known.
- Add a compatible Twitter summary_large_image card as an enhancement.
- Meaningful images use concise contextual alt text; decorative texture and glass effects use empty alt text or CSS and never carry essential content.
- Reserve meaningful-image dimensions and provide responsive sources to prevent layout shifts.

### 6.4 Structured data rules

- Use Organization JSON-LD only after public facts are confirmed. Allowed initial facts are public name, canonical URL, concise description, and logo/sameAs only when those public assets/accounts exist.
- Do not publish address, phone, email, legal identity, employee count, service area, credentials, ratings, reviews, or testimonials in structured data until approved.
- Do not use LocalBusiness markup without a public customer-facing location.
- Do not use Review, AggregateRating, or testimonial markup for sample cards.
- Keep FAQ visible and semantic but omit FAQPage markup for this business type.
- Consider Service markup only later when every field exactly mirrors approved visible content; it is optional, not a generic rich-result mechanism.

## 7. Technical architecture and repository boundary

### 7.1 Stack decision

No application stack is currently present in the repository. Before scaffolding, document the selected static-site stack and its build/test commands. The default architectural bias is minimal semantic HTML, CSS, and JavaScript with progressive enhancement; do not introduce a framework solely to make the carousels.

The selected implementation must:

- Produce crawlable initial content.
- Support a no-JavaScript/reduced-motion services fallback.
- Keep client JavaScript small and isolated to interaction behavior.
- Make it easy to replace the UI-only submission adapter with a later Cloudflare-backed adapter.
- Avoid committing secrets, API keys, environment-specific production URLs, or personal contact details.

### 7.2 Proposed file responsibilities

| File or area | Responsibility |
| --- | --- |
| color_palette_and_font.txt | Existing human-readable visual source of truth |
| IMPLEMENTATION_SPEC.md | This approved implementation/verification contract |
| README.md | Setup, local commands, validation commands, and later deployment notes |
| application entry | Semantic page structure and content |
| styles/tokens area | Color, type, space, surface, focus, and motion tokens |
| component/section area | Navigation, hero/form, services, testimonial, FAQ, and footer modules |
| interaction area | Progressive carousel enhancement, reduced-motion handling, and form adapter |
| public SEO area | favicon, robots.txt, sitemap.xml, and share-image assets when the domain is known |

### 7.3 Repository and delivery controls

- Establish the GitHub remote for github.com:ForkAroundAndFindOut/lynn_landing_page.git before the first push; it has not yet been configured in the local repository.
- Keep all source changes reviewable and commit the palette reference, implementation spec, and application source together in logical commits.
- Do not create Cloudflare configuration, deployment manifests, or a live remote form transport during the current visual implementation.
- Do not use Web on Demand for source generation, hosting, or form handling.

## 8. Milestones

### M0 — Project foundation and implementation choice

**Goal:** establish a reproducible local project without committing to backend infrastructure.

**Work:**

- Select and document the static-site stack and build/test commands.
- Add repository hygiene files appropriate to the chosen stack.
- Preserve color_palette_and_font.txt and IMPLEMENTATION_SPEC.md as source-of-truth documents.
- Confirm the intended GitHub remote before the first push.

**Exit criteria:**

- A new contributor can install dependencies and start the local preview using documented commands.
- The build pipeline has a documented lint, format, test, and production-build path.
- No Cloudflare credentials, personal contact details, or live submission endpoints exist.

### M1 — Visual foundation and static page shell

**Goal:** build the single-page semantic skeleton and the design token system.

**Work:**

- Implement landmarks, heading hierarchy, sticky navigation, responsive content container, and Georgia typography.
- Implement Navy, Gold, Slate, Pink, neutral, focus, and motion tokens.
- Build the hero, opaque/glass surface fallback, basic decorative texture, closing CTA, and footer.
- Add a high-contrast fallback for all text/surface pairings.

**Exit criteria:**

- The page is readable and usable at phone, tablet, and desktop widths.
- There is one H1 and a meaningful semantic section sequence.
- The visual system uses tokens rather than component-level raw hex values.
- No text relies on the texture or transparency for contrast.

### M2 — Consultation path

**Goal:** make Contact Us the most obvious, accessible action without enabling a real backend.

**Work:**

- Build the desktop side-by-side hero/form treatment and small-screen direct form path.
- Implement the exact agreed field set, native select options, client-side validation, focus management, and non-deceptive pending/error states.
- Implement a replaceable submission-adapter boundary with no transport configured.

**Exit criteria:**

- Every form field is labeled, keyboard-accessible, and has a clear error state.
- Required-field validation and invalid focus behavior pass manual testing.
- No successful-message state is displayed without a verified response.
- No email, phone, mailto link, or personal contact data appears in source, metadata, JSON-LD, scripts, or source maps.

### M3 — Service, credibility, and FAQ interactions

**Goal:** explain the offering without making unsupported claims.

**Work:**

- Add editable experience/credential placeholders that cannot be mistaken for factual claims.
- Add the three service pillars as stable semantic content and the enhanced vertical carousel.
- Add how-it-works and FAQ sections with accessible accordions.
- Add visible Sample testimonial — replace before launch labels to all Lorem Ipsum testimonial cards.

**Exit criteria:**

- Services remain readable with JavaScript disabled and with reduced motion.
- Carousel controls work by pointer, keyboard, and touch; cloned animation nodes are not exposed to assistive technology.
- Testimonials cannot be mistaken for real endorsements.
- FAQ accordion states and headings are semantically correct.

### M4 — Search, sharing, performance, and quality hardening

**Goal:** make the completed front end robust before any production deployment.

**Work:**

- Add provisional title, description, favicon, semantic metadata, and all production-ready SEO hooks.
- Add Open Graph/social placeholders without committing final URLs until the domain is known.
- Add robots/sitemap/canonical templates that remain disabled or noindexed for local/preview environments.
- Optimize CSS texture/media, reserve media dimensions, and verify motion performance.

**Exit criteria:**

- Initial rendered source contains meaningful content and SEO metadata.
- Production-domain-dependent values are explicitly blocked until a domain is supplied.
- No required route, asset, anchor, or interactive control produces a browser error.
- Automated accessibility and SEO checks have no critical/serious findings.

### M5 — Content and launch gate

**Goal:** prevent an attractive prototype from becoming an unsafe or misleading public site.

**Required approvals before public release:**

- Actual credentials, experience, service descriptions, and FAQ answers.
- Approved testimonial content, attribution, and publishing permission, or removal of the testimonial module.
- Final production domain, canonical URL, robots/sitemap values, social image, and Organization JSON-LD facts.
- Completed Cloudflare form-security milestone: bot protection, server-side validation, rate limiting, delivery confirmation, failure handling, privacy review, and end-to-end testing.

**Exit criteria:**

- Every public claim is approved and attributable.
- No Lorem Ipsum/sample labels remain in publicly released testimonial content.
- Real Contact Us submission works end-to-end without exposing public personal contact details.
- The production build passes the verification matrix below.

## 9. Verification matrix

| Area | Required verification |
| --- | --- |
| Visual layout | Inspect approximately 320, 375, 768, 1024, and 1440 CSS-pixel widths. No horizontal overflow, obscured anchors, clipped form controls, or overlapping glass panels. |
| Keyboard and focus | Tab through nav, form, carousel, FAQ, and footer. Focus is visible, order is logical, no trap occurs, and controls have names. |
| Touch and mobile | Verify usable taps, 44 by 44 targets where feasible, readable spacing, and no hover-only action. |
| Motion | Test normal, paused, and prefers-reduced-motion modes. Reduced motion disables parallax/auto-advance and shows stable services. |
| Accessibility | Run an automated scan with no critical/serious issues. Manually test 200 percent zoom and 400 percent/320 CSS-pixel reflow, contrast after compositing, and a screen-reader smoke test. |
| Form | Exercise each validation failure, field correction, loading state, and adapter failure. Confirm that neither console logs nor UI claim a successful delivery without a real endpoint. |
| Browser support | Check current Chromium/Edge, Firefox, Safari or mobile Safari/Chrome, and the no-backdrop-filter surface fallback. |
| Console and network | Initial load, navigation, resize, scrolling, carousel controls, form validation, and reduced-motion mode produce zero console errors, uncaught promise rejections, hydration warnings, or failed required network requests. |
| Performance | Reserve media space, lazy-load below-fold non-essential media, avoid layout-thrashing animation, and target a production mobile Lighthouse performance score of 90 or better with no material layout shift. |
| SEO | Inspect generated head/source for one H1, title, description, language, viewport, canonical behavior, robots behavior, Open Graph tags, sitemap, and valid approved JSON-LD. Run Lighthouse SEO; after deployment use Google Rich Results Test and Search Console URL Inspection. |
| Content safety | Search generated source and built assets for public email, phone, mailto, unapproved contact information, fake client identity, unsupported claims, and unapproved testimonial markup. |

## 10. Definition of done for the front-end phase

The front-end phase is complete when:

1. A responsive, semantic single-page implementation renders locally from the documented repository commands.
2. The hero communicates **HR leadership for growing teams**, establishes Lynn Renezeder as the fractional HR consultant, and presents the Contact Us path prominently.
3. The Navy/Gold/Slate/Pink/Georgia visual system, restrained glass surfaces, and basic decorative texture pass rendered-state contrast checks.
4. Services, FAQ, and testimonial layout work without making the carousel or animation the only route to content.
5. Placeholder testimonials are visibly marked and protected by the launch gate.
6. The form UI is accessible, client-validated, and ready for a later protected adapter, but does not pretend to submit.
7. Required quality checks pass with no console errors or critical accessibility/SEO failures.
8. The repository contains no production deployment configuration, secrets, personal contact information, or implementation of the later Cloudflare form backend.

## 11. Research and design references

- User-approved visual source: [color_palette_and_font.txt](color_palette_and_font.txt)
- Structural reference examined: the local Pattern Atlas distilled inventory; it supports the chosen sticky navigation, inline form, service feature, FAQ accordion, and testimonial-carousel patterns but provides no copy-ready glass component.
- UX cross-check: [UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md). Its relevant guidance has been translated here into contrast, touch-target, responsive, motion, form-feedback, and performance acceptance criteria.
- SEO references: [Google Search Essentials](https://developers.google.com/search/docs/essentials), [SEO guide for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers), [title links](https://developers.google.com/search/docs/appearance/title-link), [meta descriptions](https://developers.google.com/search/docs/appearance/snippet), [mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization), and [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
