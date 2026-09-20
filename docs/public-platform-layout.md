# Public company and product projection

The root product website now uses the world homes' three-column desktop geometry, story circles, contained photo card, nine-topic widget library and canonical five-slot Adaptive Edge. On mobile, the same content becomes a feed. The company adapter uses that exact shell with company content. FoundationOS remains explicitly 100% free.

## Behaviour

Opening a product widget moves the existing Experience section into the focus surface and restores it when closing. It does not create a second simulation state. Calendar permission is initially off, including after reset. Search, world filters, grid/list selection and story selection work locally. Permission changes update the existing proposal. Actual account creation remains in the existing authenticated app; only explicitly opted-in world IDs are handed over. Free text and example data are excluded.

The shared Edge is instantiated once. Its Home action closes the expanded widget and returns to the overview. Public labels use the existing language service and a fixed Dutch/English dictionary. Changing language keeps selected options and expanded content. Missing translations have a visible English fallback notice; this is not certification of all 114 languages.

Company content separates architecture direction from verified production behaviour. The nine-step architecture is interactive. Existing corporate detail pages are retained within the same focus surface. Public source modules are separated into content, elements, layout, widgets, navigation and site adapters, with no private member runtime.

## Verification on 20 September 2026

- `npm run build` succeeds.
- `npm run check` succeeds (static rules, public route register and document checks; not full platform CI).
- `node --test test/experience-rtg.e2e.js test/experience-rtg.test.js test/website-language-picker.e2e.js test/storyline-worlds.e2e.js`: 11 tests pass. Includes 320/390/1440 layouts, explicit permissions, simulation confirmation, no business mutations, translation outage, state retention, RTL, no-JavaScript fallback, project-relative asset URLs and actual handoff to the existing local onboarding screen.
- Company preview browser verification covers five story chapters, nine architecture steps, six existing detail routes, five widths (320–1440), one Edge, language switching and explicit translation-service outage.
- Screenshots and company report are stored in the task output folder `website-platform-build-2026-09-20`.

## Publication boundary

These checks use isolated local servers. They are not a production deployment or evidence of live backend availability. The company preview is a reproducible patch over a preserved public snapshot. The actual Cloudflare Pages project, source link and deployment settings have not yet been inspected because the Mac UI remains locked. Do not deploy that snapshot over an unverified canonical project. No production source or domain was replaced.
