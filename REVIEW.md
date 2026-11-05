# KKSolve redesign handoff

Nothing has been published. Work is on `redesign/local-business-preview`.

## Preview

Run `python3 scripts/build.py`, then `python3 -m http.server 4173 --bind 127.0.0.1 --directory .preview`.
Open http://localhost:4173. This local review includes clearly marked proposed business terms and is noindexed. It is not an authenticated public preview: keep it local.

The root `index.html` and `dist/` use publishable, quote-based wording while `termsApproved` is false. They do not expose the proposed package details, payment percentages, update rates, or defect period. The site publication guard remains false, so even that version cannot deploy through the workflow yet.

## Approval checklist

- Approve the visual design and copy before setting `siteApproved: true`.
- Standard: starting at $600, up to 4 pages, supplied content, inquiry form, basic SEO, 2 revision rounds, launch help.
- Premier: starting at $1,200, up to 8 pages, expanded layouts, content organization, light editing, inquiry form, one compatible booking/registration embed or link, basic SEO, 3 revision rounds, launch help and walkthrough. The inquiry form and responsive layout are retained from Standard as a draft assumption.
- Payment: 50% upfront / 50% before launch; larger projects 40% / 30% at design approval / 30% before launch.
- Support: $10–$20 small requests; $30–$40 larger requests; scope and availability confirmed first; more substantial work separately quoted.
- Defects: proposed 14-day correction period for defects in delivered, agreed functionality, distinct from new work.
- Ownership: proposed client-held domain/hosting accounts; custom deliverable transfer after payment and third-party license terms still need a written agreement. The website does not promise unconditional ownership.
- Form provider: Web3Forms configured with the public access key supplied for `kavin@kksolve.com`; live mailbox verification remains.

Set `termsApproved: true` only after the package scope, prices, payment and support terms have been approved together. If they remain unresolved, leave false; the public build continues to say “Request a quote.” Approval flags record your decision, not an automatic approval.

## Editing

- `site-config.json`: package names, starting prices, descriptions, bullet lists, payment wording, support prices, defect days, approval flags, and public form endpoint.
- `templates/index.html`: homepage, process, about, FAQ, contact, and portfolio copy. Edit the template, not generated `index.html`.
- `style.css`: colors, typography, spacing, responsive layouts.
- `script.js`: form behavior and local analytics event hooks.
- `assets/east-bay-desktop.webp` / `east-bay-mobile.webp`: screenshots captured directly from the real project, September 19, 2026. Replace with new real screenshots when the project changes, and update the capture label and dimensions in the template.
- `assets/social.png`: social sharing graphic drawn from site typography and colors; `assets/favicon.svg`: editable wordmark icon.
- Rebuild with `python3 scripts/build.py` after any edit. No JavaScript build dependencies are needed. Preview and distribution directories are generated and ignored by Git.

## Quote estimates and Web3Forms email

The quote button now shows a non-binding USD range and submits all visitor fields, the range, numeric bounds, assumptions, and exclusions to `kavin@kksolve.com` using Web3Forms. Configuration lives in `site-config.json`; rebuild after changes. The new estimate ranges are planning allowances based on the existing package and update prices, independent of the package/payment-term approval flag. Budget and free-text descriptions do not automatically alter prices; the owner reviews the brief and timeline.

- New sites/redesigns: 1–4 pages $600–$1,200; 5–8 $1,200–$2,400; 9–12 $1,200–$3,000; 13+ $2,400–$6,000. Unknown page count assumes 1–4 pages.
- Additions: booking embed $150–$300; editing $150–$400; writing $400–$1,000; custom features $600–$2,400. Large/custom work may exceed the allowance.
- Updates: small $10–$20; section refresh $30–$40; substantial changes $150–$600, subject to review.

**Web3Forms setup:** `site-config.json` contains the public `formAccessKey`, provider name, and `https://api.web3forms.com/submit` endpoint. The build includes the public key in `runtime-config.js`; it is intended for browser-side use. The recipient is determined by the Web3Forms account associated with the key. See https://docs.web3forms.com/getting-started/api-reference.

Requests include `access_key`, `subject`, `from_name`, `email` (reply-to), the provider's `botcheck` honeypot, and all active project/estimate fields. Success requires an HTTP success and boolean `success: true`; it indicates provider acceptance, not verified inbox delivery. Errors preserve the estimate and input and offer a prefilled direct email plus a copyable full request. JavaScript-disabled browsers retain an email fallback.

Run `node --test tests/form-delivery.cjs` for offline delivery regression tests. No live inquiry is sent by these tests. After deployment, submit a request from the live site and confirm that the email arrives with the complete brief and estimate. Web3Forms replaces the unavailable FormSubmit service; the former provider's activation flow no longer applies.


`python scripts/verify.py` tests responsive layouts, validation, estimate scenarios, email payload, provider rejection and network failure using intercepted requests. No real email is sent by those checks.

## Analytics (optional, requires approval)

No tracking is active. A minimal [Plausible custom-event setup](https://plausible.io/docs/custom-event-goals) could track `quote_click`, `project_click`, and `inquiry_submitted`; review its current plan and privacy requirements before choosing it. The page already dispatches a local `kksolve:analytics` CustomEvent with only `{event: "..."}`. After approval, install the provider's documented script and bridge these event names to its API. Never send form values, names, emails, URLs supplied by visitors, or message text. Emit the submission event only after confirmed acceptance; do not count email-link clicks as received inquiries.

## Deployment after approval

1. Review the preview and resolve the checklist. Configure form delivery if desired, or retain the explicit email fallback.
2. Set `siteApproved: true` only after explicit publication approval. Set `termsApproved` according to the separate business-term decision.
3. Run `python3 scripts/build.py --production` and inspect `dist/`. The command intentionally fails before site approval.
4. Review the diff, commit the approved branch and merge/push to `main` only when ready to publish. Existing GitHub Pages Actions then builds and uploads **only `dist/`**. Manual dispatch uses the same approval guard.
5. Preserve existing Pages custom-domain/DNS settings. The repository had no CNAME file, and no domain settings were changed. Confirm `kksolve.com` in repository Pages settings before launching; do not change DNS as part of this handoff.
6. Check the live HTTPS page, metadata, images, canonical URL, sitemap, email link, and any configured form after deployment.

The original independent `tinos.html` demo remains unchanged and available at the same path; it is not presented as a delivered client project. The client volleyball website was read and captured only, never edited.

## Verification completed

- Build succeeds with Python's standard library; production build intentionally rejects the unapproved site. `git diff --check` and Python syntax checks pass.
- Chrome browser journeys passed at 320, 390, 768, and 1440 pixels: navigation/CTA anchors, project link destination, required fields, loaded images, no horizontal overflow, and metadata/structured data. Desktop, tablet, and mobile screenshots were inspected.
- Keyboard skip link and native FAQ toggles work. Visible focus styles and reduced-motion CSS are present. With JavaScript disabled, essential content and email links remain usable and form submission remains disabled.
- axe-core 4.10.3 scans at 390, 768, and 1440 pixels found zero violations under WCAG 2 A/AA and 2.1 AA checks. Automated scans are not a full accessibility certification or screen-reader evaluation.
- Intercepted form tests passed: required fields, email and URL validation, whitespace-only names, honeypot, HTTP rejection, missing/false confirmation, successful confirmation, input preservation on failure, resetting on success, network error, loading state, 15-second timeout, and retry availability. No actual inquiry was sent. Confirmed submission emitted only the event name, with no form data.
- No unexpected browser console errors. The deliberately simulated HTTP 422 produces its expected browser resource error.
- Public build checked at 320, 768, and 1440 pixels and confirmed not to contain pending offers. `tinos.html` has no diff.
- Live KKSolve was fetched and matched the original repository page. The East Bay project homepage was opened in Chrome; case-study facts were cross-checked against its public About, Programs, and Membership pages. Its contact page and individual PDF downloads were not end-to-end tested.
- Remaining: real form delivery and provider spam protection (unconfigured by choice), mailbox delivery, Safari/Firefox/device testing, human screen-reader review, and post-publication GitHub Pages/domain checks. No Lighthouse score is claimed.

To repeat the saved browser journeys, install Playwright in a temporary Python environment (`python3 -m venv /tmp/kksolve-tools` then `/tmp/kksolve-tools/bin/pip install playwright`), keep the local preview server running, and run `/tmp/kksolve-tools/bin/python scripts/verify.py`. The script uses installed Google Chrome and intercepts every mock submission; it never sends a real inquiry. Its screenshots are written only into the ignored `.preview/` directory.
