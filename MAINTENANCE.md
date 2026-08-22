# Maintenance Plan: What Needs Refreshing, and When

Almost everything in this project is tied to FY2025-26 and will go
stale. This is a checklist for keeping it accurate, not a one-time task.

## Refresh every fiscal year (July, once new rates are certified)

- `tax-districts-fy2025-26.json` -- pull the new Tax Roll Summary /
  Table 4a from the Curry County Assessor once the new fiscal year's
  rates are certified (typically available by early fall for the
  October tax bill).
- `code-areas-fy2025-26.json` -- cross-check against the new rates;
  code area boundaries rarely change but composite rates will.
- `county-budget-fy2025-26.json` -- pull the new adopted county budget
  (note: the file used throughout this project was the *proposed*
  budget; the *adopted* budget, finalized after public hearings, may
  differ slightly and is worth reconciling once available).
- `non-property-tax-revenue.json` -- update alongside the county
  budget refresh; federal timber payments (O&C/SRS) in particular can
  swing year to year based on federal appropriations decisions outside
  county control.
- `school-funding-fy2024-25.json` (or whatever year is current) --
  ODE publishes updated Actual Revenue CSVs roughly a year after each
  fiscal year closes; there's an inherent lag here that's fine to leave
  as-is, just keep the vintage clearly labeled.

## Check every election cycle (May primary, November general)

- `upcoming-changes.json` -- this is the fastest-moving file in the
  project. After each election, move any measure from "upcoming" to
  "recent" with its actual result, and fold any passed measure's new
  tax rate into the next `tax-districts` refresh once certified.
- Watch specifically for: fire district levies (a statewide pattern of
  fire districts needing renewed funding), school bonds, health
  district measures, and library district measures.

## Check occasionally (no fixed schedule, but worth revisiting)

- `fire-district-context.json` -- the per-district service-level detail
  flagged as a known gap. Good candidate for a future dedicated
  research pass if the community group wants it.
- `health-district-explainer.json` -- facility list and services;
  healthcare offerings can change (new clinics, service lines added or
  discontinued).
- `enrollment-funding-explainer.json` -- the ADMw formula and charter
  transfer percentages are statutory and stable, but if the Legislature
  changes the underlying ORS provisions, this would need a revisit. The
  deliberately-omitted current per-ADMw dollar figure, if ever added,
  would need refreshing every biennium.

## A note on scope creep

Each pass in this project added real value, but the file count is
growing. If this becomes hard to maintain, consider consolidating
related JSON files (e.g. merging the various "explainer" files into
fewer, larger category files) rather than continuing to add new
standalone files indefinitely.
