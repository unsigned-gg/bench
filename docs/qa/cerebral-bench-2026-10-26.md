# Cerebral benchmark site verification — 2026-10-26

- Data-integrity suite: 12/12 pass, including tampered artifact/value/unit/denominator rejection, simulation classification, absent Cortex result handling and negative-control enforcement.
- Browser behavior: 26/26 pass. Covers keyboard skip navigation, system/search/evidence filters, reset and empty state, query reload, actual p99 value selection, scheduler fixture switching, theme persistence, six evidence/CSV downloads, and no-JavaScript results.
- Responsive checks: no document-width overflow at 320, 375, 390, 768, 1024 or 1440px after fixing the narrow heading.
- Automated axe WCAG A/AA checks: zero violations at 1440/390px in light and dark themes and at 320px light; no uncaught page errors. This is targeted automated evidence, not comprehensive accessibility certification.
- Visual review: desktop/mobile hero and results reviewed against the extracted paper/ink V2 system.
- Worker dry runs: both the Cerebral config and existing unsigned config pass.
- Local Worker emulator: root returns 200 HTML, evidence index 200 JSON, CSV 200 text/csv, unknown route 404 with the custom return link.
- Existing unsigned model-bank assets, root Worker configuration, eval definitions and deploy workflow have no changes.

Source executable captures are a bounded local Scorcher run and a Saga virtual-clock simulation, with separate binary fingerprints and inspected source context. Cortex has protocol coverage only; the UI does not assign it a score. The production hostname and deployment are prepared in source and remain pending operator approval.
