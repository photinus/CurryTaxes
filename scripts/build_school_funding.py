#!/usr/bin/env python3
"""
Build data/school-funding-fy2024-25.json from Oregon Department of
Education's statewide "Actual Revenue Data" CSV.

The raw CSV is NOT checked into this repo -- it's a ~9,000-row file
covering every school district and ESD in Oregon, most of it irrelevant
here. Download the current year's file from ODE's Fiscal Transparency
portal before running this script:

  https://www.oregon.gov/ode/schools-and-districts/fiscaltransparency/pages/district%20detailed%20revenue.aspx

Usage:
  python3 scripts/build_school_funding.py /path/to/20XX-XX_Actual_Revenue_Data.csv

This script does NOT fetch anything itself -- point it at a local copy of
the CSV. It only reshapes and reconciles data that's already been
downloaded.

Revenue source codes follow Oregon's standard chart of accounts and are
bucketed as:
  1000-1999  Local            (property tax, investment earnings, fees, ...)
  2000-2999  Intermediate     (county school funds, ESD pass-through funds)
             -- folded into "other" since the app's bucket model has no
                separate slot for it
  3000-3999  State            (State School Fund, Common School Fund, ...)
             -- split further into `state_operating` vs
                `state_capital_oscim`, see below
  4000-4999  Federal          (Title I/IDEA pass-through, federal forest fees)
  5000-5999  Other one-time   (sale of fixed assets -> "other")

Two 5000-series codes are EXCLUDED from total_revenue entirely, not
bucketed as "other": Beginning Fund Balance (5400) and Interfund Transfers
(5200). Neither is new revenue for the year -- the first is carried-over
cash from the prior year, the second is money moving between a district's
own funds (already counted once in the fund it left). Including either
would inflate the total and misrepresent "where the money comes from" for
the year, which is the whole point of this file. Excluded amounts are kept
in the output under `excluded_from_total` for transparency, not silently
dropped.

Splitting state operating aid from one-time capital grants (OSCIM etc.):
the CSV has no source code or description that says "OSCIM" outright, but
Oregon's chart of accounts still makes a one-time capital grant identifiable
-- it's a 3000-series (state) source code whose revenue lands in a
"Capital Projects Funds" fund, rather than the General Fund where ongoing
State School Fund operating aid lands. Confirmed against the 2024-25 data:
Central Curry SD 1 has exactly one such line, $4,000,000, which lines up
with its 2023 voter-approved bond in tax-districts-fy2025-26.json and with
the size the state's OSCIM program typically pays out -- about as close to
a smoking gun as this dataset gets without an explicit label. Port
Orford-Langlois has a much smaller one ($40,000); Brookings-Harbor and
South Coast ESD have none this year (Brookings-Harbor's bond hasn't passed
yet -- see its `current_news_note`). Any state (3xxx) revenue in a Capital
Projects Fund is bucketed as `state_capital_oscim` instead of
`state_operating`, so a construction-bond-driven windfall year doesn't make
a district's ongoing, enrollment-based state support look inflated.
"""
import csv
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")

FISCAL_YEAR = "2024-25"
SOURCE_URL = "https://www.oregon.gov/ode/schools-and-districts/FiscalTransparency/Documents/Act%20Rev%20%26%20Act%20Exp/2024-25%20Actual%20Revenue%20Data.csv"

# CSV Institution_Name -> our internal key, and the corresponding district
# code already present in tax-districts-fy2025-26.json (for reconciliation).
# South Coast ESD covers a multi-county area (Coos and Curry), so its
# dollar totals are NOT Curry-County-specific the way the three K-12
# districts' totals are -- flagged explicitly in the output.
DISTRICTS = {
    "Central Curry SD 1": {
        "key": "central_curry",
        "tax_data_codes": ["School CC 1", "School CC 1 Bond (2023)"],
        "multi_county": False,
    },
    "Port Orford-Langlois SD 2CJ": {
        "key": "port_orford_langlois",
        "tax_data_codes": ["School 2CJ"],
        "multi_county": False,
    },
    "Brookings-Harbor SD 17C": {
        "key": "brookings_harbor",
        "tax_data_codes": ["School 17-C"],
        "multi_county": False,
    },
    "South Coast ESD": {
        "key": "south_coast_esd",
        "tax_data_codes": ["ESD (Education Service District)"],
        "multi_county": True,
    },
}

EXCLUDED_CODES = {"5400", "5200"}

BUCKETS = ("local", "state_operating", "state_capital_oscim", "federal", "other")


def fmt_money(n):
    return f"${n:,.0f}"


def bucket_for(code, fund_desc):
    c = int(code)
    if 1000 <= c < 2000:
        return "local"
    if 2000 <= c < 3000:
        return "other"  # intermediate sources
    if 3000 <= c < 4000:
        # A state source landing in the Capital Projects Fund is a one-time
        # capital grant (OSCIM or similar bond-matching aid), not ongoing
        # State School Fund operating support -- see module docstring.
        return "state_capital_oscim" if fund_desc == "Capital Projects Funds" else "state_operating"
    if 4000 <= c < 5000:
        return "federal"
    return "other"  # remaining 5000s (e.g. sale of fixed assets)


def main():
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} /path/to/actual-revenue-data.csv")
    csv_path = sys.argv[1]

    tax_districts_doc = json.load(open(os.path.join(DATA, "tax-districts-fy2025-26.json")))
    tax_rate_by_name = {d["name"]: d for d in tax_districts_doc["districts"]}

    raw = {
        info["key"]: {"revenue": {}, "excluded": {}, "property_tax_only": 0.0, "oscim_lines": []}
        for info in DISTRICTS.values()
    }
    seen_institutions = set()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["Institution_Name"]
            if name not in DISTRICTS:
                continue
            seen_institutions.add(name)
            key = DISTRICTS[name]["key"]
            amt = float(row["ActualRevAmt"])
            code = row["SrcCd"]

            if code in EXCLUDED_CODES:
                raw[key]["excluded"][row["SourceDesc"]] = raw[key]["excluded"].get(row["SourceDesc"], 0.0) + amt
                continue

            b = bucket_for(code, row["FundDesc"])
            raw[key]["revenue"][b] = raw[key]["revenue"].get(b, 0.0) + amt
            if code == "1110":
                raw[key]["property_tax_only"] += amt
            if b == "state_capital_oscim":
                raw[key]["oscim_lines"].append((row["SourceDesc"], amt))

    missing = set(DISTRICTS) - seen_institutions
    if missing:
        print(f"WARNING: not found in CSV, skipping: {sorted(missing)}", file=sys.stderr)

    districts_out = []
    for name, info in DISTRICTS.items():
        if name not in seen_institutions:
            districts_out.append(
                {
                    "name": name,
                    "code_in_tax_data": info["tax_data_codes"],
                    "available": False,
                    "note": "Not found in the ODE Actual Revenue Data CSV for this fiscal year.",
                }
            )
            continue

        r = raw[info["key"]]
        total = round(sum(r["revenue"].values()), 2)
        by_source = {k: round(v, 2) for k, v in r["revenue"].items()}
        by_source_pct = {k: round(v / total, 4) if total else None for k, v in by_source.items()}
        for bucket in BUCKETS:
            by_source.setdefault(bucket, 0.0)
            by_source_pct.setdefault(bucket, 0.0)

        oscim_note = None
        if by_source["state_capital_oscim"] > 0:
            oscim_note = (
                f"Includes a one-time {fmt_money(by_source['state_capital_oscim'])} state capital grant "
                f"(most likely Oregon School Capital Improvement Matching -- OSCIM) tied to a school "
                f"construction bond, landed in the Capital Projects Fund rather than the General Fund. "
                f"Kept separate from ongoing State School Fund operating aid so a bond-driven windfall "
                f"year doesn't make the district's normal annual state support look inflated."
            )

        # Reconciliation: compare the CSV's property-tax-only local revenue
        # (source code 1110, this fiscal year's ACTUAL receipts, FY2024-25)
        # against the county's certified rate x assessed value for the same
        # district (this app's other data, FY2025-26 IMPOSED tax roll). A
        # modest difference is expected -- different fiscal years, and
        # "imposed" (billed) vs "actual" (collected) are not the same
        # number even in the same year.
        tax_data_imposed = sum(
            tax_rate_by_name[c]["taxes_imposed"] for c in info["tax_data_codes"] if c in tax_rate_by_name
        )
        csv_property_tax = round(r["property_tax_only"], 2)
        diff = round(csv_property_tax - tax_data_imposed, 2) if tax_data_imposed else None
        diff_pct = round(diff / tax_data_imposed, 4) if tax_data_imposed else None

        districts_out.append(
            {
                "name": name,
                "code_in_tax_data": info["tax_data_codes"],
                "available": True,
                "multi_county": info["multi_county"],
                "total_revenue": total,
                "revenue_by_source": by_source,
                "revenue_by_source_pct": by_source_pct,
                "state_capital_oscim_note": oscim_note,
                "excluded_from_total": {k: round(v, 2) for k, v in r["excluded"].items()},
                "tax_data_comparison": {
                    "csv_property_tax_fy2024_25": csv_property_tax,
                    "tax_roll_imposed_fy2025_26": round(tax_data_imposed, 2) if tax_data_imposed else None,
                    "diff": diff,
                    "diff_pct": diff_pct,
                    "note": (
                        "These come from two different fiscal years and two different "
                        "measures (FY2024-25 actual receipts vs. FY2025-26 imposed tax "
                        "roll), so a modest difference is expected, not an error."
                    ),
                },
            }
        )

    out = {
        "_meta": {
            "source": "Oregon Department of Education Fiscal Transparency -- Actual Revenue Data",
            "source_url": SOURCE_URL,
            "fiscal_year": FISCAL_YEAR,
            "generated_note": (
                "Generated by scripts/build_school_funding.py from a locally-downloaded "
                "copy of ODE's statewide Actual Revenue Data CSV (not checked into this "
                "repo). Re-download the current year's CSV and re-run this script "
                "annually alongside the tax-rate data refresh."
            ),
            "bucketing_note": (
                "Local = source codes 1000-1999 (property tax plus other local revenue "
                "like investment earnings and fees). State operating = 3000-3999 landed "
                "in a district's operating funds (mainly the State School Fund and "
                "Common School Fund). State capital/OSCIM = 3000-3999 landed "
                "specifically in a Capital Projects Fund -- a one-time bond-matching "
                "grant, not ongoing operating support; see state_capital_oscim_note on "
                "any district where this applies. Federal = 4000-4999. Other = "
                "2000-2999 intermediate sources (county school funds, ESD pass-through "
                "funds) plus minor one-time items like sale of fixed assets. Beginning "
                "Fund Balance and Interfund Transfers are excluded from every total: "
                "neither is new revenue for the year."
            ),
            "swocc_note": (
                "Southwestern Oregon Community College does not appear in this "
                "K-12/ESD dataset -- it reports through a separate community college "
                "fiscal system, not ODE's K-12 Fiscal Transparency portal. No funding "
                "breakdown is available for it here."
            ),
        },
        "districts": districts_out,
    }

    out_path = os.path.join(DATA, "school-funding-fy2024-25.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {out_path}")
    for d in districts_out:
        if not d["available"]:
            print(f"  {d['name']}: NOT AVAILABLE ({d['note']})")
            continue
        pct = d["revenue_by_source_pct"]
        diff_pct = d["tax_data_comparison"]["diff_pct"]
        diff_str = f"{diff_pct:+.1%}" if diff_pct is not None else "n/a"
        print(
            f"  {d['name']}: total ${d['total_revenue']:,.0f}, "
            f"local/state-op/state-oscim/federal/other = "
            f"{pct['local']:.0%}/{pct['state_operating']:.0%}/{pct['state_capital_oscim']:.0%}/"
            f"{pct['federal']:.0%}/{pct['other']:.0%}, tax-roll diff {diff_str}"
        )
        if d["state_capital_oscim_note"]:
            print(f"    OSCIM/capital: ${d['revenue_by_source']['state_capital_oscim']:,.0f}")


if __name__ == "__main__":
    main()
