# Curry County Property Tax Breakdown

An interactive, static infographic showing where a Curry County, Oregon
property tax dollar actually goes: which of the ~48 separate taxing
districts collect a slice, and how the county government itself spends the
roughly 7 cents per dollar it keeps.

**Live site:** enable GitHub Pages for this repo (see below) and it will be
published at `https://<owner>.github.io/<repo>/`.

**Maintaining this project?** See [`MAINTENANCE.md`](MAINTENANCE.md) for
what needs refreshing and when — almost everything here is tied to
FY2025-26 and a handful of files are tied to specific election dates.

## What this shows

Five views:

1. **Where It Goes** — the landing page, focused on the percentage
   breakdown rather than a dollar calculator. Pick one of six named areas
   (Port Orford/Langlois, Agness, Ophir/Nesika Beach, Gold Beach, Pistol
   River, Brookings-Harbor) and see the composite rate split into 8
   plain-language groups (Schools, Fire & Emergency, County Government,
   City Government, Health, Library, Roads, Other Local Districts), each
   shown as a percentage of the whole and expandable to the exact districts
   and per-$1,000 rates behind it — no property value needed, since a
   group's share of the bill doesn't depend on it.
   - The **Schools** group drills down further: the K-12 district that
     actually serves the selected code area, plus the countywide ESD and
     SWOCC, each with a full state/local/federal/other funding breakdown —
     not just the property tax slice, since that's typically well under half
     of an Oregon school district's real revenue — plus a "how does
     per-student funding work?" explainer covering Oregon's enrollment-based
     (State School Fund) funding formula and the charter-school funding
     transfer mechanism, with a simple illustrative slider, and each
     district's own General Fund expenditure breakdown (Instruction /
     Support Services / Other) with program-level detail where the source
     supports it.
   - The **Health District** group drills down into what Curry Health
     Network actually operates (the county's only hospital plus three
     clinics) and clarifies it's a separate special district from county
     government's public health office (state-run since 2021) — and notes
     the district doesn't cover the whole county (only 24 of 56 code areas).
   - The **Fire & Emergency** group has a short explainer on why rates vary
     so much district to district (volunteer vs. paid staffing, coverage
     differences) — general context only, since per-district specifics
     weren't researched and the app won't guess at them from rate levels.
   - An "advanced" toggle exposes all ~45 actual code areas for more
     precision than the six named areas. A callout links to the Calculator
     for anyone who wants an actual dollar figure.
2. **Estimate Your Bill** — the calculator, split out from the landing page
   so the percentage breakdown isn't gated behind entering a property value.
   Enter an assessed value or an annual tax bill amount for the area picked
   on Where It Goes (with a "change" link back if you want a different one)
   and see the resulting dollar total, composite rate, and a "Show full
   detail" toggle with the full ~40-district, full-precision table.
3. **County's Own Budget** — Curry County government's FY2025-26 proposed
   budget broken down by department/fund (Sheriff's Office, Road Fund,
   General Fund departments, Vehicle Services, other funds), plus a second
   chart on where the county's non-property-tax revenue comes from (O&C
   timber payments, federal PILT, transient lodging tax, franchise fees,
   state-shared taxes) — property tax is the single biggest source but,
   combined, these others add up to more than it.
4. **Recent & Upcoming Changes** — ballot measures affecting Curry County's
   taxing districts (currently: the Brookings-Harbor school bond that failed
   in the May 2026 election), plus brief statewide context. The
   fastest-moving part of the app; see `MAINTENANCE.md`.
5. **About & Sources** — data provenance, limitations, and the full list of
   code areas where this app's recomputed rate disagrees with the source
   PDF's printed subtotal.

A **Print Summary** button (top right) opens a condensed, one-page,
non-interactive view of the current selection — the core breakdown, the
plain-language one-liners, and the "7 cents to county government" headline
stat — for anyone who won't use the interactive site itself.

## Data

All data is static, checked into `data/`, and vendored at build time (no
runtime fetching, no backend). Fiscal year **2025-2026**.

- `data/county-budget-fy2025-26.json` — department/fund totals from the
  county's FY2025-26 proposed budget PDF.
- `data/tax-districts-fy2025-26.json` — the master list of every taxing
  district and its certified per-$1,000 rate, from the Assessor's Tax Roll
  Summary.
- `data/code-areas-fy2025-26.json` — which districts stack together in each
  of Curry County's ~45 geographic code areas.
- `data/category-groups.json` — maps the ~12 raw district categories into 8
  plain-language display groups (Schools, Fire & Emergency, County
  Government, City Government, Health, Library, Roads, Other Local
  Districts) shown by default in Your Tax Bill, each with a one-line and a
  longer explanation.
- `data/glossary.json` — short/long definitions for jargon (assessed value,
  levy, permanent rate, local option levy, bond, urban renewal, code area,
  taxing district, compression/Measure 5), surfaced as inline tap/click
  tooltips rather than a separate glossary page.
- `data/headline-stats.json` — the plain-language lead copy and headline
  facts shown above the calculator, plus the caveat text shown near every
  computed estimate.
- `data/school-districts.json` — identifies the three K-12 districts
  (Central Curry SD 1, Port Orford-Langlois SD 2CJ, Brookings-Harbor SD
  17C) plus the countywide ESD and SWOCC, and cross-references each to its
  tax-data code. Doesn't duplicate the property-tax data.
- `data/school-funding-fy2024-25.json` — **generated** by
  `scripts/build_school_funding.py` from a locally-downloaded copy of
  Oregon Department of Education's statewide Actual Revenue Data CSV
  (fiscal year 2024-25, one year behind the tax data since it's the
  latest ODE had published at data-collection time). Breaks each
  district's total revenue into state/local/federal/other buckets. The
  raw statewide CSV is not checked in — see "Updating the school funding
  data" below.
- `data/enrollment-funding-explainer.json` — explains Oregon's per-student
  (State School Fund) funding formula and the charter-school funding
  transfer mechanism, shown as a "how does per-student funding work?"
  explainer inside the Schools drill-down, plus 4 more glossary terms
  (ADMw, State School Fund, General Purpose Grant, Public Charter School)
  merged into the same glossary. Doesn't change annually — it explains a
  legal mechanism, not a dollar figure — except its 80%/95% statutory
  minimum transfer rates, which should be reconfirmed against ORS
  338.155(2) if Oregon amends that statute.
- `data/non-property-tax-revenue.json` — the county's non-tax revenue
  sources (O&C timber payments, federal PILT, transient lodging tax,
  franchise fees, state-shared taxes), for the "where county government's
  other money comes from" chart. Sourced from the same FY2025-26 proposed
  budget already used elsewhere.
- `data/health-district-explainer.json` — what Curry Health Network
  actually operates, for the Health District drill-down. The scope note
  about the district not covering the whole county is recomputed in
  `scripts/build_data.py` from the actual code-area data rather than
  trusted as written (see the data-quality note below).
- `data/upcoming-changes.json` — ballot measures affecting Curry County's
  taxing districts, for the Recent & Upcoming Changes tab. The
  fastest-moving file in the project — see `MAINTENANCE.md`.
- `data/fire-district-context.json` — general (not per-district) context
  on why fire district rates vary, for a short explainer on the Fire &
  Emergency group. Deliberately doesn't claim per-district staffing/service
  detail that wasn't researched.
- `data/central-curry-budget-detail.json`,
  `data/brookings-harbor-budget-detail.json`,
  `data/port-orford-langlois-budget-detail.json` — each K-12 district's own
  **General Fund** expenditures (Fund 100 only — no grant-restricted special
  revenue, debt service, or capital projects funds, e.g. Brookings-Harbor's
  Fund 415 Seismic project), grouped into Instruction / Support Services /
  Other, for the "where the money goes" spending breakdown inside each
  district's Schools card. This is separate from, and more current/granular
  than, the statewide ODE revenue-by-source data above. Central Curry and
  Brookings-Harbor are FY2025-26 Adopted with full program-level detail;
  Port Orford-Langlois is **FY2026-27** (one year ahead of the other two)
  from a monthly business-office report with summary-level detail only —
  see the data-quality note below before treating all three as directly
  comparable.
- `data/app-data.json` — **generated**. Combines and reconciles all sixteen
  files above into the shape the app consumes, and validates that every
  district category has a display group, every glossary term has a
  stable lookup key, and every code area matches exactly one K-12 school
  district. Regenerate it with `python3 scripts/build_data.py` after
  updating any raw source file; do not hand-edit it.

### A data-quality note worth reading

The code-area source document is a dense, multi-column, OCR-scanned PDF,
and its own printed per-code-area subtotals didn't all reconcile cleanly
during transcription. Rather than trust those printed subtotals, this app
**recomputes each code area's composite rate** by summing the certified
per-district rates that apply to it. The printed subtotal is kept only as a
cross-check.

In 14 of the ~56 listed code areas, the recomputed sum disagrees with the
source's printed subtotal by more than a rounding error — including three
of the six "representative" areas used for the simple picker (Gold Beach,
Pistol River, Brookings-Harbor). Some of this is explainable (the printed
total for urban-renewal code areas appears to exclude the urban renewal
division-of-tax rate, which isn't an additional bill line item), and some
looks like transcription/OCR error in the source table. The app surfaces
every flagged area inline (a warning banner when you pick an affected code
area) and in full in the About tab, rather than silently picking a number.
See `data/code-areas-fy2025-26.json`'s `_meta.accuracy_note` and the output
of `scripts/build_data.py` for the full list.

The county budget chart also excludes two large line items that would
otherwise distort a "where does this year's money go" chart: Non-Departmental
(a pass-through fund whose money is transferred out to the departments
already shown) and the Road Capital Improvement Fund (a multi-year reserve,
not a single year's operating spend). Both are still shown as separate
context figures in the app.

**Which K-12 district applies to a code area** is derived from which
`School ...` tax line item is actually present in that code area's district
list (in `tax-districts-fy2025-26.json`), not from `school-districts.json`'s
own `matches_property_tax_code_areas` area-name hints. The two disagree for
one case: Pistol River code 16-3 is described there as partly
Brookings-Harbor, but its actual certified tax roll district is Central
Curry SD 1 ("School CC 1"). Deriving the match from the same certified data
already driving the rest of the app is both more precise (per-code-area
rather than per-named-area — useful since a single named area can span more
than one school district, as this case shows) and guaranteed consistent
with the property-tax breakdown the person is already looking at.
`scripts/build_data.py` fails loudly if any code area ever matches zero or
more than one K-12 district, so this stays correct as the data changes.

**School funding figures are one fiscal year behind the tax data** (FY2024-25
actual revenue vs. FY2025-26 tax rates) since FY2024-25 was the latest ODE
had published at data-collection time — each school card labels its own
fiscal year, and the property-tax reconciliation note spells out that a
modest difference between the two years is expected, not an error. South
Coast ESD's funding figures cover its entire multi-county service area
(Coos and Curry counties), not Curry County alone — flagged explicitly in
its card, since Curry's ESD property tax alone is already shown in the
district list above it.

**One-time capital grants (OSCIM) are split out of "State" funding**, not
folded into it. The FY2024-25 CSV has no field that says "OSCIM" outright,
but a state (3000-series) source code landing in a district's Capital
Projects Fund rather than its General Fund is a one-time construction-bond
match, not ongoing State School Fund operating support — and lumping the
two together would make a district's normal annual state funding look far
larger (and far less tied to enrollment) than it really is in a year with a
bond payout. Central Curry SD 1 has a $4,000,000 one this year (lining up
with its 2023 voter-approved bond); Port Orford-Langlois has a smaller
$40,000 one; Brookings-Harbor and South Coast ESD have none this year
(Brookings-Harbor's own bond measure was rejected by voters in May 2026 —
see the Recent & Upcoming Changes tab). Shown as a distinctly colored,
distinctly labeled segment in the funding bar rather than merged into
"State".

**Port Orford-Langlois's expenditure detail is a different fiscal year than
the other two districts' — flagged in the UI, not hidden.** Its card labels
its budget data "2026-2027 Budget..." with an explicit "a different fiscal
year than the tax-rate data above" flag next to it, since Central Curry and
Brookings-Harbor's expenditure detail is FY2025-26. Its source (a monthly
business-office report) also only breaks spending into Instruction and
Support Services totals, without Central Curry's and Brookings-Harbor's
program-level detail (elementary/middle/high, guidance/library/
transportation, etc.) — so its "See every program" toggle only expands the
"Other" category, the only one with itemized programs in the source; the
other two categories say plainly that only a summary total was available.
Its own revenue-side and expenditure-side totals also disagree by about
$26,000 (a small gap in the source document itself) — the app uses the
by-function total for the Instruction/Support Services/Other breakdown and
the by-object total for the revenue-side total, matching how the source
document itself labels each table, rather than picking one number to make
them match.

**Brookings-Harbor's own budget document doesn't reconcile internally**,
despite its `_meta.confidence` claiming all three of its tables tie out to
the same $21,680,639 General Fund total. Recomputing from the source's own
line-item programs: Instruction's programs sum to $902,296 more than its
published subtotal, Support Services' programs sum to $536,559 less than
its published subtotal, Other's programs sum to exactly $1,000,000 less
than its published subtotal, and the three published subtotals together are
$634,263 more than the district's own declared General Fund total. None of
this is resolved by picking a "correct" number — `scripts/build_data.py`
recomputes each check from the source's own itemized figures (tolerance
$25) and the app surfaces every discrepancy it finds as an explicit "Data
note" in Brookings-Harbor's card, with the exact computed dollar amounts.
The expenditure bar and legend percentages are computed against the sum of
the three category subtotals (not the district's mismatched declared
total), so the bar always adds up to 100% and matches the legend even
though it doesn't match the district's own stated total — which is shown,
and explained, separately.

**A few source files contain notes written for whoever builds this data,
not for the app's readers** — e.g. one said a fact "should be
double-checked" against another file, another ended with "see 'known_gaps'
below" (a reference to that JSON file's own sibling key, meaningless
on-screen). `scripts/build_data.py` documents each such case where it
overrides the raw field with clean reader-facing copy instead of passing it
through verbatim — worth checking new source files for the same pattern
before trusting a field wholesale.

### Updating for a new fiscal year

1. Get the new year's three source documents from the Curry County Assessor
   and Finance office (proposed/adopted budget, certified tax roll summary
   by district, tax rates by code area).
2. Transcribe them into new JSON files following the same shape as the
   `*-fy2025-26.json` files (or hand them to an LLM with those files as a
   format example).
3. Update the filenames/paths at the top of `scripts/build_data.py`.
4. Run `python3 scripts/build_data.py` and check its console output for
   newly flagged rate discrepancies. The script will also fail loudly if a
   district's `category` isn't covered by `category-groups.json` — if a
   brand-new district category shows up, add it to a display group there.
5. Commit the new raw files and the regenerated `data/app-data.json`.

`category-groups.json`, `glossary.json`, and `headline-stats.json` don't
change annually the way the fiscal-year files do — they only need updating
if a district category or a new piece of jargon isn't covered yet.

### Updating the school funding data

1. Download the current year's Actual Revenue Data CSV from ODE's Fiscal
   Transparency portal:
   https://www.oregon.gov/ode/schools-and-districts/fiscaltransparency/pages/district%20detailed%20revenue.aspx
2. Run `python3 scripts/build_school_funding.py /path/to/the.csv`. It
   filters the statewide file down to Central Curry SD 1,
   Port Orford-Langlois SD 2CJ, Brookings-Harbor SD 17C, and South Coast
   ESD, and writes `data/school-funding-fy20XX-XX.json`. SWOCC is expected
   to be absent (it reports through a separate community-college fiscal
   system, not this K-12/ESD dataset) — the script notes this rather than
   erroring. It also separates one-time capital/OSCIM grants from ongoing
   state operating aid (see the data-quality note above and the script's
   own docstring) — check its printed summary for any `OSCIM/capital:`
   lines and sanity-check them against that year's bond news for each
   district.
3. Update the filename and `FISCAL_YEAR`/`SOURCE_URL` constants at the top
   of `scripts/build_school_funding.py`, and the file path in
   `scripts/build_data.py`.
4. Run `python3 scripts/build_data.py` and check the reconciliation numbers
   it prints against the current tax-roll data still look like a modest,
   explainable difference (see the data-quality note above).
5. Commit the regenerated `data/school-funding-fy20XX-XX.json` and
   `data/app-data.json`. Don't commit the raw statewide CSV — it's ~9,000
   rows covering every district in Oregon, almost none of it relevant here.

## Running locally

No build step, no dependencies. From the repo root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. (Opening `index.html` directly via
`file://` won't work because the browser blocks the `fetch()` of
`data/app-data.json` under the `file:` protocol — use any static file
server.)

## Deploying to GitHub Pages

A workflow at `.github/workflows/pages.yml` deploys the repo root to GitHub
Pages via GitHub Actions on every push to `main`. To finish enabling it:

1. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**
   (only needs to be done once).
2. Push to `main` (or run the workflow manually via **Actions → Deploy
   static site to GitHub Pages → Run workflow**).
3. The Pages URL appears in the workflow run's summary and under
   **Settings → Pages**.

## Limitations

- **Not an official tax calculator.** This is an independent, unofficial
  estimator meant to make the county's tax structure easier to understand.
- Does not account for exemptions, Oregon's Measure 5 compression, special
  assessments, or mid-year changes.
- "Representative" code areas are the most common configuration for a named
  area, not a guarantee for any specific parcel — a parcel's exact code area
  can only be confirmed by the Assessor's Office.
- County budget figures are from the *proposed* FY2025-26 budget and may
  shift slightly at the Approved/Adopted stage.

For an exact bill or code area, contact the **Curry County Assessor's
Office**.
