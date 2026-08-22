(() => {
  "use strict";

  const CATEGORY_COLORS = {
    county: "#4c6ef5",
    school: "#f59f00",
    city: "#12b886",
    port: "#7048e8",
    cemetery: "#868e96",
    fire: "#e03131",
    sanitary: "#099268",
    water: "#1c7ed6",
    health: "#f06595",
    library: "#5c940d",
    road: "#495057",
    urban_renewal: "#e8590c",
  };

  const CATEGORY_LABELS = {
    county: "County government",
    school: "Schools / education",
    city: "City",
    port: "Port district",
    cemetery: "Cemetery district",
    fire: "Fire district",
    sanitary: "Sanitary district",
    water: "Water district",
    health: "Health district",
    library: "Library district",
    road: "Road district",
    urban_renewal: "Urban renewal",
  };

  const BUDGET_GROUP_COLORS = {
    "General Fund": "#4c6ef5",
    "Sheriff's Office": "#e03131",
    "Road Fund": "#12b886",
    "Vehicle Services": "#f59f00",
    "Other Funds": "#868e96",
  };

  // Colors for the 8 plain-language display groups from category-groups.json.
  const GROUP_COLORS = {
    schools: "#f59f00",
    fire: "#e03131",
    county: "#4c6ef5",
    cities: "#12b886",
    health: "#f06595",
    library: "#5c940d",
    roads: "#495057",
    other_local: "#7048e8",
  };

  // Funding-source buckets for the school drill-down (state/federal/local/
  // other revenue, not property-tax categories, so a distinct palette).
  // Order also controls left-to-right position in the funding bar. The two
  // state buckets sit next to each other since they're both "state" money,
  // but state_capital_oscim gets a visually distinct color (striped-looking
  // via a different hue, not just a shade of the same blue) plus a label
  // that can't be mistaken for ongoing support -- a one-time construction-
  // bond match should never blend into "how the state funds this district
  // every year."
  const FUNDING_BUCKET_ORDER = ["local", "state_operating", "state_capital_oscim", "federal", "other"];

  const FUNDING_COLORS = {
    local: "#12b886",
    state_operating: "#4c6ef5",
    state_capital_oscim: "#f59f00",
    federal: "#7048e8",
    other: "#adb5bd",
  };

  const FUNDING_LABELS = {
    local: "Local",
    state_operating: "State",
    state_capital_oscim: "State (one-time bond match)",
    federal: "Federal",
    other: "Other",
  };

  const FUNDING_EXPLAINERS = {
    local: "Property tax collected in the district, plus smaller local revenue like fees and interest.",
    state_operating: "Mostly Oregon's State School Fund, distributed based on enrollment and student need.",
    state_capital_oscim: "A one-time state grant tied to a specific construction bond (OSCIM) -- not part of the district's normal annual state support.",
    federal: "Targeted programs like Title I and special education funding.",
    other: "County and ESD pass-through funds, plus small one-time items.",
  };

  // Expenditure-side breakdown (what a district's own General Fund budget
  // is spent on), distinct from the revenue-side FUNDING_* constants above
  // (where the money comes from).
  const EXPENDITURE_COLORS = {
    instruction: "#4c6ef5",
    support_services: "#f59f00",
    other: "#adb5bd",
  };
  const EXPENDITURE_LABELS = {
    instruction: "Instruction",
    support_services: "Support Services",
    other: "Other",
  };

  const BUDGET_KEY_ACRONYMS = {
    esd: "ESD", tag: "TAG", ell: "ELL", ot: "OT", pt: "PT", k6: "K-6", k12: "K-12", 7: "7", 8: "8",
  };
  function humanizeBudgetKey(key) {
    return key
      .split("_")
      .map((w) => BUDGET_KEY_ACRONYMS[w] || w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Keyword patterns used to auto-link the first glossary term that shows up
  // in a short, dynamically-rendered snippet of text (e.g. a district's
  // source note). Order matters: first match wins, and only one term is
  // linked per snippet so a short note doesn't turn into a wall of tooltips.
  // Each pattern tolerates a trailing "s" (code area/areas, bond/bonds, ...)
  // so a plural in the source text doesn't get cut in half by the match --
  // e.g. matching only "public charter school" inside "public charter
  // schools" would wrap the term and strand a bare "s" right after it.
  const GLOSSARY_KEYWORD_PATTERNS = [
    ["real_market_value", /real market values?/i],
    ["assessed_value", /assessed values?/i],
    ["local_option_levy", /local option(?: levy| levies)?/i],
    ["permanent_rate", /permanent rates?/i],
    ["tax_rate", /\b(?:tax rates?|bill rates?)\b/i],
    ["levy", /\blev(?:y|ies)\b/i],
    ["bond", /\bbonds?\b/i],
    ["urban_renewal", /urban renewal/i],
    ["code_area", /code areas?/i],
    ["taxing_district", /taxing districts?/i],
    ["compression_m5", /compression|measure 5/i],
    ["state_school_fund", /state school fund/i],
    ["general_purpose_grant", /general purpose grants?/i],
    ["public_charter_school", /public charter schools?/i],
    ["admw", /\bADMw\b/],
  ];

  const fmtUSD = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtUSD2 = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const fmtPct = (n) => (n * 100).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";

  let DATA = null;
  let GROUP_BY_ID = {};
  let state = {
    areaIndex: 0,
    codeAreaCode: null,
    advanced: false,
    inputMode: "assessed", // or "bill"
    value: 300000,
    openGroups: new Set(),
    fullDetailOpen: false,
    schoolDrilldownOpen: false,
    enrollmentExplainerOpen: false,
    weightingListOpen: false,
    charterStudents: 3,
    healthDrilldownOpen: false,
    fireDrilldownOpen: false,
    budgetProgramsOpen: new Set(),
    budgetByObjectOpen: false,
  };

  // ---------- Inline glossary tooltips ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Builds the interactive markup for one glossary term. `label` is the
  // visible text (kept exactly as authored at the call site, so plurals /
  // phrasing can differ slightly from the canonical term name).
  function glossSpan(key, label) {
    const entry = DATA.glossary[key];
    if (!entry) return escapeHtml(label);
    const long = entry.longer_note
      ? `<button type="button" class="gloss-more">More</button>
         <span class="gloss-long" hidden>${escapeHtml(entry.longer_note)}</span>`
      : "";
    return `<span class="gloss-wrap">
      <button type="button" class="gloss-term">${escapeHtml(label)}<sup>?</sup></button>
      <span class="gloss-pop" role="tooltip" hidden>
        <span class="gloss-term-name">${escapeHtml(entry.term)}</span>
        <span class="gloss-short">${escapeHtml(entry.short_definition)}</span>
        ${long}
      </span>
    </span>`;
  }

  // For dynamic strings (e.g. a district's source note or an explainer
  // paragraph): link the glossary term that appears earliest in the text,
  // if any, leaving the rest as plain text. Picking by text position
  // (rather than by GLOSSARY_KEYWORD_PATTERNS array order) matters once a
  // paragraph mentions multiple terms -- a reader expects the first term
  // they read to be the one that's clickable, not whichever pattern
  // happens to sit first in this list.
  function autoGlossify(text) {
    let best = null;
    for (const [key, re] of GLOSSARY_KEYWORD_PATTERNS) {
      const m = text.match(re);
      if (m && DATA.glossary[key] && (best === null || m.index < best.index)) {
        best = { key, match: m, index: m.index };
      }
    }
    if (!best) return escapeHtml(text);
    const before = text.slice(0, best.index);
    const after = text.slice(best.index + best.match[0].length);
    return escapeHtml(before) + glossSpan(best.key, best.match[0]) + escapeHtml(after);
  }

  // Converts static `<span class="gloss-anchor" data-gloss="key">Label</span>`
  // markup (written directly in index.html) into interactive tooltip markup.
  // Runs once at startup, after DATA has loaded.
  function initGlossaryAnchors() {
    document.querySelectorAll(".gloss-anchor").forEach((el) => {
      const key = el.dataset.gloss;
      if (!DATA.glossary[key]) return;
      el.outerHTML = glossSpan(key, el.textContent);
    });
  }

  // Single delegated listener handles every glossary popover, including ones
  // rendered later by chart/table re-renders. Click/tap toggles open state
  // (not hover-only, so it works on phones); clicking outside closes it.
  function setupGlossaryEvents() {
    document.addEventListener("click", (e) => {
      const moreBtn = e.target.closest(".gloss-more");
      if (moreBtn) {
        const long = moreBtn.nextElementSibling;
        const isHidden = long.hidden;
        long.hidden = !isHidden;
        moreBtn.textContent = isHidden ? "Less" : "More";
        return;
      }

      const term = e.target.closest(".gloss-term");
      if (term) {
        const pop = term.nextElementSibling;
        const willOpen = pop.hidden;
        document.querySelectorAll(".gloss-pop").forEach((p) => (p.hidden = true));
        pop.hidden = !willOpen;
        return;
      }

      if (!e.target.closest(".gloss-pop")) {
        document.querySelectorAll(".gloss-pop").forEach((p) => (p.hidden = true));
      }
    });
  }

  // ---------- SVG donut ----------
  function polarToCartesian(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    const clampedEnd = Math.min(endAngle, startAngle + 359.999);
    const p1 = polarToCartesian(cx, cy, rOuter, clampedEnd);
    const p2 = polarToCartesian(cx, cy, rOuter, startAngle);
    const p3 = polarToCartesian(cx, cy, rInner, startAngle);
    const p4 = polarToCartesian(cx, cy, rInner, clampedEnd);
    const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 1 ${p4.x} ${p4.y}`,
      "Z",
    ].join(" ");
  }

  function renderDonut(container, segments, opts = {}) {
    container.innerHTML = "";
    const size = 260;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 6;
    const rInner = rOuter * 0.58;
    const total = segments.reduce((s, seg) => s + seg.value, 0);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts.ariaLabel || "Breakdown chart");

    if (total <= 0) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", (rOuter + rInner) / 2);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "var(--border)");
      circle.setAttribute("stroke-width", rOuter - rInner);
      svg.appendChild(circle);
      container.appendChild(svg);
      return;
    }

    let angle = 0;
    segments.forEach((seg) => {
      const sweep = (seg.value / total) * 360;
      if (sweep > 0) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", arcPath(cx, cy, rOuter, rInner, angle, angle + sweep));
        path.setAttribute("fill", seg.color);
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${seg.label}: ${fmtUSD(seg.value)} (${fmtPct(seg.value / total)})`;
        path.appendChild(title);
        svg.appendChild(path);
      }
      angle += sweep;
    });

    const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText.setAttribute("x", cx);
    centerText.setAttribute("y", cy - 4);
    centerText.setAttribute("text-anchor", "middle");
    centerText.setAttribute("font-size", "18");
    centerText.setAttribute("font-weight", "700");
    centerText.setAttribute("fill", "currentColor");
    centerText.textContent = opts.centerTop || "";
    svg.appendChild(centerText);

    const centerSub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerSub.setAttribute("x", cx);
    centerSub.setAttribute("y", cy + 16);
    centerSub.setAttribute("text-anchor", "middle");
    centerSub.setAttribute("font-size", "11");
    centerSub.setAttribute("fill", "currentColor");
    centerSub.setAttribute("opacity", "0.6");
    centerSub.textContent = opts.centerBottom || "";
    svg.appendChild(centerSub);

    container.appendChild(svg);
  }

  function renderLegend(container, segments) {
    container.innerHTML = "";
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    segments
      .slice()
      .sort((a, b) => b.value - a.value)
      .forEach((seg) => {
        const row = document.createElement("div");
        row.className = "legend-item";
        row.innerHTML = `
          <span class="legend-swatch" style="background:${seg.color}"></span>
          <span class="legend-label">${seg.label}</span>
          <span class="legend-value">${total > 0 ? fmtPct(seg.value / total) : "0%"}</span>
        `;
        container.appendChild(row);
      });
  }

  // ---------- Tabs ----------
  function setupTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");

        document.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.hidden = true;
          panel.setAttribute("aria-hidden", "true");
        });
        const target = document.getElementById("tab-" + btn.dataset.tab);
        target.hidden = false;
        target.setAttribute("aria-hidden", "false");
      });
    });
  }

  // ---------- Tax bill tab ----------
  function currentArea() {
    return DATA.geographic_areas[state.areaIndex];
  }

  function currentCodeArea() {
    const area = currentArea();
    if (state.codeAreaCode) {
      const found = area.code_areas.find((c) => c.code === state.codeAreaCode);
      if (found) return found;
    }
    return area.code_areas.find((c) => c.representative) || area.code_areas[0];
  }

  function renderAreaPicker() {
    const wrap = document.getElementById("area-picker");
    wrap.innerHTML = "";
    DATA.geographic_areas.forEach((area, i) => {
      const btn = document.createElement("button");
      btn.className = "area-btn" + (i === state.areaIndex ? " active" : "");
      btn.innerHTML = `<strong>${area.area_name}</strong><span>${area.nearest_city ? "near " + area.nearest_city : "rural / unincorporated"}</span>`;
      btn.addEventListener("click", () => {
        state.areaIndex = i;
        state.codeAreaCode = null;
        renderAreaPicker();
        renderCodePicker();
        renderBillTab();
      });
      wrap.appendChild(btn);
    });
  }

  // The assessed value to use for "$ on your value" context, regardless of
  // which input mode is active (back out an implied assessed value from a
  // total-bill entry using the currently selected code area's rate).
  function effectiveAssessedValue() {
    if (state.inputMode === "assessed") return state.value;
    const rate = currentCodeArea().computed_rate;
    return rate > 0 ? (state.value / rate) * 1000 : 0;
  }

  function renderCodePicker() {
    const select = document.getElementById("code-picker");
    select.innerHTML = "";
    const area = currentArea();
    const assessedValue = effectiveAssessedValue();
    area.code_areas.forEach((ca) => {
      const opt = document.createElement("option");
      opt.value = ca.code;
      const flag = ca.flagged ? " ⚠️" : "";
      const yearly = (assessedValue / 1000) * ca.computed_rate;
      opt.textContent = `Code ${ca.code}${ca.representative ? " (representative)" : ""} — ${ca.computed_rate.toFixed(4)}/$1,000 ≈ ${fmtUSD(yearly)}/yr${flag}`;
      select.appendChild(opt);
    });
    const cur = currentCodeArea();
    select.value = cur.code;
  }

  function renderMismatchBanner(ca) {
    const el = document.getElementById("rate-mismatch-banner");
    if (!ca.flagged) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (ca.printed_rate_as_source === null) {
      el.textContent =
        `⚠️ Data note: the source PDF's printed subtotal for code area ${ca.code} did not reconcile cleanly during transcription. ` +
        `This app uses a recomputed composite rate of ${ca.computed_rate.toFixed(4)}/$1,000, summed from certified per-district rates. See About tab.`;
    } else {
      el.textContent =
        `⚠️ Data note: for code area ${ca.code}, the recomputed composite rate (${ca.computed_rate.toFixed(4)}/$1,000) differs from ` +
        `the source PDF's printed subtotal (${ca.printed_rate_as_source.toFixed(4)}/$1,000) by ${Math.abs(ca.rate_diff).toFixed(4)}. ` +
        `This app uses the recomputed sum. See About tab for details.`;
    }
  }

  function renderBillTab() {
    const ca = currentCodeArea();
    renderMismatchBanner(ca);

    const compositeRate = ca.computed_rate; // $ per $1,000 assessed value
    let assessedValue, totalBill;
    if (state.inputMode === "assessed") {
      assessedValue = state.value;
      totalBill = (assessedValue / 1000) * compositeRate;
    } else {
      totalBill = state.value;
      assessedValue = compositeRate > 0 ? (totalBill / compositeRate) * 1000 : 0;
    }

    document.getElementById("bill-chart-title").textContent =
      `Tax bill breakdown — ${currentArea().area_name}, code ${ca.code}`;

    // Per-district dollar amounts
    const districtAmounts = ca.districts.map((d) => ({
      name: d.name,
      category: d.category,
      group: d.group,
      bill_rate: d.bill_rate,
      note: d.note,
      amount: (assessedValue / 1000) * d.bill_rate,
    }));

    // Group into the 8 plain-language display groups for the default view.
    const byGroup = {};
    districtAmounts.forEach((d) => {
      (byGroup[d.group] = byGroup[d.group] || []).push(d);
    });
    const groupSegments = Object.entries(byGroup)
      .map(([groupId, ds]) => ({
        groupId,
        meta: GROUP_BY_ID[groupId],
        value: ds.reduce((s, d) => s + d.amount, 0),
        districts: ds.slice().sort((a, b) => b.amount - a.amount),
      }))
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value);

    renderDonut(
      document.getElementById("bill-donut"),
      groupSegments.map((g) => ({ label: g.meta.label, value: g.value, color: GROUP_COLORS[g.groupId] })),
      {
        ariaLabel: "Tax bill by category",
        centerTop: fmtUSD(totalBill),
        centerBottom: "per year",
      }
    );

    renderGroupAccordion(groupSegments, totalBill, ca.school_district_key);

    // Full-precision district table, sorted by amount desc
    const tbody = document.querySelector("#bill-table tbody");
    tbody.innerHTML = "";
    districtAmounts
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .forEach((d) => {
        const tr = document.createElement("tr");
        const noteHtml = d.note ? `<div class="dim" style="margin-top:0.15rem">${autoGlossify(d.note)}</div>` : "";
        tr.innerHTML = `
          <td>${autoGlossify(d.name)}${noteHtml}</td>
          <td class="dim">${CATEGORY_LABELS[d.category] || d.category}</td>
          <td>${d.bill_rate.toFixed(4)}</td>
          <td>${fmtUSD2(d.amount)}</td>
        `;
        tbody.appendChild(tr);
      });

    // Rate summary
    const summary = document.getElementById("rate-summary");
    summary.innerHTML = `
      <span class="big">${fmtUSD(totalBill)}<span style="font-size:0.9rem;font-weight:500;color:var(--text-muted)"> / year</span></span>
      <div class="row"><span>Composite rate</span><span>${compositeRate.toFixed(4)} / $1,000</span></div>
      <div class="row"><span>Assessed value used</span><span>${fmtUSD(assessedValue)}</span></div>
      <div class="row"><span>Districts stacked here</span><span>${ca.districts.length}</span></div>
    `;

    document.getElementById("bill-caveat").textContent = DATA.headline_stats.caveat_copy;

    lastBillSnapshot = { ca, area: currentArea(), compositeRate, assessedValue, totalBill, groupSegments };
  }

  // ---------- Print summary ----------
  let lastBillSnapshot = null;

  function renderPrintSummary() {
    if (!lastBillSnapshot) return;
    const { ca, area, assessedValue, totalBill, groupSegments } = lastBillSnapshot;

    const headlineList = DATA.headline_stats.headline_facts
      .slice(0, 2)
      .map((f) => `<p>${escapeHtml(f.stat)}</p>`)
      .join("");
    document.getElementById("print-headline").innerHTML = headlineList;

    document.getElementById("print-area-title").textContent = `${area.area_name}, code ${ca.code}`;
    document.getElementById("print-rate-summary").innerHTML = `
      <span class="big">${fmtUSD(totalBill)} / year</span><br />
      Based on an assessed value of ${fmtUSD(assessedValue)}
    `;

    const tbody = document.querySelector("#print-table tbody");
    tbody.innerHTML = groupSegments
      .map(
        (g) => `
          <tr>
            <td>${escapeHtml(g.meta.label)}</td>
            <td>${escapeHtml(g.meta.one_liner)}</td>
            <td>${fmtUSD(g.value)}</td>
          </tr>`
      )
      .join("");

    document.getElementById("print-caveat").textContent = DATA.headline_stats.caveat_copy;
  }

  function renderGroupAccordion(groupSegments, totalBill, schoolDistrictKey) {
    const wrap = document.getElementById("bill-groups");
    wrap.innerHTML = "";
    groupSegments.forEach((g) => {
      const isOpen = state.openGroups.has(g.groupId);
      const row = document.createElement("div");
      row.className = "group-row" + (isOpen ? " open" : "");

      const detailLines = g.districts
        .map(
          (d) => `
            <div class="group-detail-line">
              <span class="group-detail-name">${autoGlossify(d.name)} <span class="dim">(${d.bill_rate.toFixed(4)}/$1,000)</span></span>
              <span class="group-detail-amount">${fmtUSD2(d.amount)}</span>
            </div>`
        )
        .join("");

      let extraDrilldown = "";
      if (g.groupId === "schools") extraDrilldown = schoolDrilldownMarkup(schoolDistrictKey);
      else if (g.groupId === "health") extraDrilldown = healthDrilldownMarkup();
      else if (g.groupId === "fire") extraDrilldown = fireDrilldownMarkup();

      row.innerHTML = `
        <button type="button" class="group-row-header" aria-expanded="${isOpen}">
          <span class="group-swatch" style="background:${GROUP_COLORS[g.groupId]}"></span>
          <span class="group-row-main">
            <span class="group-row-label">${g.meta.label}</span>
            <span class="group-row-oneliner">${g.meta.one_liner}</span>
          </span>
          <span class="group-row-amounts">
            <span class="group-row-amount">${fmtUSD(g.value)}</span>
            <span class="group-row-pct">${totalBill > 0 ? fmtPct(g.value / totalBill) : "0%"}</span>
          </span>
          <span class="group-row-chevron" aria-hidden="true">&#9656;</span>
        </button>
        <div class="group-row-detail" ${isOpen ? "" : "hidden"}>${detailLines}${extraDrilldown}</div>
      `;

      if (g.groupId === "schools") {
        const toggleBtn = row.querySelector(".school-drilldown-btn");
        toggleBtn.addEventListener("click", () => {
          state.schoolDrilldownOpen = !state.schoolDrilldownOpen;
          renderBillTab();
        });

        const explainerToggle = row.querySelector('[data-role="explainer-toggle"]');
        if (explainerToggle) {
          explainerToggle.addEventListener("click", () => {
            state.enrollmentExplainerOpen = !state.enrollmentExplainerOpen;
            renderBillTab();
          });
        }

        const weightingMore = row.querySelector('[data-role="weighting-more"]');
        if (weightingMore) {
          weightingMore.addEventListener("click", () => {
            state.weightingListOpen = !state.weightingListOpen;
            renderBillTab();
          });
        }

        row.querySelectorAll('[data-role="budget-programs-toggle"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const k = btn.getAttribute("data-key");
            if (state.budgetProgramsOpen.has(k)) state.budgetProgramsOpen.delete(k);
            else state.budgetProgramsOpen.add(k);
            renderBillTab();
          });
        });

        row.querySelectorAll('[data-role="budget-byobject-toggle"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            state.budgetByObjectOpen = !state.budgetByObjectOpen;
            renderBillTab();
          });
        });

        const charterSlider = row.querySelector("#charter-slider");
        if (charterSlider) {
          // Update the label/output text directly rather than calling
          // renderBillTab(): a full re-render would destroy and recreate
          // this <input type="range"> on every tick, which interrupts an
          // in-progress drag in some browsers.
          const k12ForSlider = DATA.schools.k12_districts.find((d) => d.key === schoolDistrictKey);
          const districtName = k12ForSlider ? k12ForSlider.official_name : "a Curry County district";
          charterSlider.addEventListener("input", (e) => {
            const n = parseInt(e.target.value, 10);
            state.charterStudents = n;
            const label = row.querySelector(".charter-slider-label strong");
            const output = row.querySelector(".charter-slider-output");
            if (label) label.textContent = n;
            if (output) output.innerHTML = charterSliderOutputText(n, districtName);
          });
        }
      } else if (g.groupId === "health") {
        const toggleBtn = row.querySelector(".school-drilldown-btn");
        toggleBtn.addEventListener("click", () => {
          state.healthDrilldownOpen = !state.healthDrilldownOpen;
          renderBillTab();
        });
      } else if (g.groupId === "fire") {
        const toggleBtn = row.querySelector(".school-drilldown-btn");
        toggleBtn.addEventListener("click", () => {
          state.fireDrilldownOpen = !state.fireDrilldownOpen;
          renderBillTab();
        });
      }

      row.querySelector(".group-row-header").addEventListener("click", () => {
        if (state.openGroups.has(g.groupId)) {
          state.openGroups.delete(g.groupId);
        } else {
          state.openGroups.add(g.groupId);
        }
        renderBillTab();
      });

      wrap.appendChild(row);
    });
  }

  // ---------- School district drill-down ----------
  function fundingBarHTML(district) {
    if (!district.funding || district.funding.available === false) {
      return `<p class="school-unavailable">${escapeHtml(
        (district.funding && district.funding.note) ||
          "A state/local/federal funding breakdown isn't available for this one."
      )}</p>`;
    }
    const f = district.funding;
    const order = FUNDING_BUCKET_ORDER;
    const segs = order
      .filter((k) => f.revenue_by_source[k] > 0)
      .map(
        (k) =>
          `<span class="funding-bar-seg" style="background:${FUNDING_COLORS[k]};width:${(f.revenue_by_source_pct[k] * 100).toFixed(2)}%"></span>`
      )
      .join("");
    const legend = order
      .filter((k) => f.revenue_by_source[k] > 0)
      .map(
        (k) => `
          <div class="funding-legend-row">
            <span class="funding-legend-swatch" style="background:${FUNDING_COLORS[k]}"></span>
            <span class="funding-legend-label">${FUNDING_LABELS[k]}</span>
            <span class="funding-legend-amount">${fmtUSD(f.revenue_by_source[k])} (${fmtPct(f.revenue_by_source_pct[k])})</span>
            <span class="funding-legend-explainer">${FUNDING_EXPLAINERS[k]}</span>
          </div>`
      )
      .join("");

    const oscimNote = f.state_capital_oscim_note
      ? `<p class="school-note school-heads-up"><span class="school-note-label">One-time grant:</span>${escapeHtml(f.state_capital_oscim_note)}</p>`
      : "";

    let reconciliation = "";
    const cmp = f.tax_data_comparison;
    if (district.multi_county) {
      reconciliation = `<p class="school-note">${escapeHtml(district.official_name)} serves more than one county, so these totals cover its whole service area, not just Curry County. The Curry-specific tax line for it is already shown in the district list above.</p>`;
    } else if (cmp && cmp.tax_roll_imposed_fy2025_26) {
      reconciliation = `<p class="school-note">Of that local revenue, ${fmtUSD(cmp.csv_property_tax_fy2024_25)} was property tax (FY2024-25 actual) &mdash; this app's own tax roll shows ${fmtUSD(cmp.tax_roll_imposed_fy2025_26)} imposed for FY2025-26. ${cmp.note}</p>`;
    }

    return `
      <p class="school-card-total">Total revenue ${DATA.schools.funding_meta.fiscal_year}: <strong>${fmtUSD(f.total_revenue)}</strong></p>
      <div class="funding-bar">${segs}</div>
      <div class="funding-legend">${legend}</div>
      ${oscimNote}
      ${reconciliation}
    `;
  }

  function expenditureBreakdownHTML(district) {
    const bd = district.budget_detail;
    if (!bd) return "";
    const key = district.key;
    const order = ["instruction", "support_services", "other"];
    // Percentages (both the bar widths and the legend text) are computed
    // against the sum of the three category subtotals shown, NOT the
    // district's declared General Fund total -- for Brookings-Harbor those
    // two numbers don't match (see reconciliation_notes below), and using
    // the declared total here would make the bar segments overflow past
    // 100% width, visually clipping and mismatching the legend text.
    const categorySum = order.reduce((s, k) => s + bd.categories[k].subtotal, 0);

    const segs = bar_segments_from_categories(bd.categories, categorySum, order);
    const bar = segs
      .map((s) => `<span class="funding-bar-seg" style="background:${EXPENDITURE_COLORS[s.key]};width:${s.pct.toFixed(2)}%"></span>`)
      .join("");
    const legend = segs
      .map(
        (s) => `
          <div class="funding-legend-row">
            <span class="funding-legend-swatch" style="background:${EXPENDITURE_COLORS[s.key]}"></span>
            <span class="funding-legend-label">${EXPENDITURE_LABELS[s.key]}</span>
            <span class="funding-legend-amount">${fmtUSD(s.value)} (${(s.pct).toFixed(1)}%)</span>
          </div>`
      )
      .join("");

    // Fiscal year for the BUDGET data can differ from the app's overall
    // FY2025-26 vintage (Port Orford-Langlois's is FY2026-27) -- called out
    // distinctly rather than left to blend in with everything else.
    const isDifferentFY = !bd.fiscal_year.startsWith("2025-2026") && !bd.fiscal_year.startsWith("2025-26");
    const fyLine = `<p class="school-card-meta" style="margin:0.5rem 0 0.3rem">Budget data: <strong>${escapeHtml(bd.fiscal_year)}</strong>${
      isDifferentFY ? ' <span class="fy-mismatch-flag">— a different fiscal year than the tax-rate data above</span>' : ""
    }</p>`;

    const isProgramsOpen = state.budgetProgramsOpen.has(key);
    const anyPrograms = order.some((k) => bd.categories[k].programs);
    let programsSection = "";
    if (anyPrograms) {
      const body = order
        .map((k) => {
          const cat = bd.categories[k];
          if (!cat.programs) {
            return `<p class="dim" style="font-size:0.78rem;margin:0.5rem 0">${EXPENDITURE_LABELS[k]}: only a summary total was available for this district — no program-level detail in the source.</p>`;
          }
          const lines = Object.entries(cat.programs)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([name, amt]) => `
                <div class="group-detail-line">
                  <span class="group-detail-name">${escapeHtml(humanizeBudgetKey(name))}</span>
                  <span class="group-detail-amount">${fmtUSD(amt)}</span>
                </div>`
            )
            .join("");
          return `<p class="school-card-total" style="margin:0.6rem 0 0.3rem"><strong>${EXPENDITURE_LABELS[k]}</strong></p>${lines}`;
        })
        .join("");
      programsSection = `
        <div class="explainer-toggle">
          <button type="button" class="school-drilldown-btn" data-role="budget-programs-toggle" data-key="${key}" aria-expanded="${isProgramsOpen}">
            ${isProgramsOpen ? "Hide programs" : "See every program"}
          </button>
          <div class="school-drilldown-body" ${isProgramsOpen ? "" : "hidden"}>${isProgramsOpen ? body : ""}</div>
        </div>
      `;
    }

    let byObjectSection = "";
    if (bd.by_object_alternate_view) {
      const ov = bd.by_object_alternate_view;
      const isOpen = state.budgetByObjectOpen;
      const objKeys = Object.keys(ov).filter((k) => k !== "total" && k !== "note" && typeof ov[k] === "number");
      const lines = objKeys
        .sort((a, b) => ov[b] - ov[a])
        .map(
          (k) => `
            <div class="group-detail-line">
              <span class="group-detail-name">${escapeHtml(humanizeBudgetKey(k))}</span>
              <span class="group-detail-amount">${fmtUSD(ov[k])}</span>
            </div>`
        )
        .join("");
      byObjectSection = `
        <div class="explainer-toggle">
          <button type="button" class="school-drilldown-btn" data-role="budget-byobject-toggle" aria-expanded="${isOpen}">
            ${isOpen ? "Hide" : "Bonus view: spending by type (salaries, benefits, supplies...)"}
          </button>
          <div class="school-drilldown-body" ${isOpen ? "" : "hidden"}>${isOpen ? `<p class="dim" style="font-size:0.76rem">${escapeHtml(ov.note || "")}</p>${lines}` : ""}</div>
        </div>
      `;
    }

    const reconNotes = bd.reconciliation_notes.length
      ? `<div class="school-note school-heads-up">
           <span class="school-note-label">Data note:</span>
           ${bd.reconciliation_notes.map((n) => `<div style="margin-top:0.3rem">${escapeHtml(n)}</div>`).join("")}
         </div>`
      : "";

    const pullQuote = bd.pull_quote
      ? `<blockquote class="budget-pull-quote">&ldquo;${escapeHtml(bd.pull_quote)}&rdquo;<footer>${escapeHtml(bd.pull_quote_attribution)}</footer></blockquote>`
      : "";
    const extraContext = bd.extra_context ? `<p class="school-note">${escapeHtml(bd.extra_context)}</p>` : "";
    const scaleNote = bd.scale_note ? `<p class="dim" style="font-size:0.78rem">${escapeHtml(bd.scale_note)}</p>` : "";

    return `
      <div class="explainer-card" style="margin-top:0.7rem">
        <p class="school-card-name" style="margin-bottom:0.2rem">Where the money goes</p>
        <p class="school-card-total">General Fund budget: <strong>${fmtUSD(bd.expenditure_total)}</strong></p>
        ${fyLine}
        <div class="funding-bar" style="margin-top:0.4rem">${bar}</div>
        <div class="funding-legend">${legend}</div>
        ${programsSection}
        ${byObjectSection}
        ${reconNotes}
        ${pullQuote}
        ${extraContext}
        ${scaleNote}
      </div>
    `;
  }

  function bar_segments_from_categories(categories, total, order) {
    return order
      .map((key) => ({ key, value: categories[key].subtotal }))
      .map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));
  }

  function schoolCardHTML(district, extraNoteHtml) {
    const identityBits = [];
    if (district.communities_served && district.communities_served.length) {
      identityBits.push(`Serves ${district.communities_served.join(", ")}`);
    }
    if (district.schools && district.schools.length) {
      identityBits.push(district.schools.join(", "));
    }
    const identityLine = identityBits.length
      ? `<p class="school-card-total">${identityBits.map(escapeHtml).join(" · ")}${
          district.website ? ` · <a href="${escapeHtml(district.website)}" target="_blank" rel="noopener">website</a>` : ""
        }</p>`
      : "";
    const backgroundNote = district.history_note || district.enrollment_note;

    return `
      <div class="school-card">
        <div class="school-card-header">
          <span class="school-card-name">${escapeHtml(district.official_name)}</span>
          <span class="school-card-meta">current school tax rate: ${district.current_tax_rate.toFixed(4)}/$1,000</span>
        </div>
        ${identityLine}
        ${fundingBarHTML(district)}
        ${backgroundNote ? `<p class="school-note">${escapeHtml(backgroundNote)}</p>` : ""}
        ${expenditureBreakdownHTML(district)}
        ${extraNoteHtml || ""}
      </div>
    `;
  }

  function regionalCardHTML(entity) {
    if (!entity.funding) {
      const note =
        entity.official_name.includes("Southwestern")
          ? DATA.schools.funding_meta.swocc_note
          : "A state/local/federal funding breakdown isn't available for this one.";
      return `
        <div class="school-card">
          <div class="school-card-header">
            <span class="school-card-name">${escapeHtml(entity.official_name)}</span>
          </div>
          <p class="school-unavailable">${escapeHtml(note)}</p>
        </div>
      `;
    }
    return `
      <div class="school-card">
        <div class="school-card-header">
          <span class="school-card-name">${escapeHtml(entity.official_name)}</span>
          ${entity.needs_verification ? '<span class="school-card-meta">name unverified</span>' : ""}
        </div>
        <p class="school-card-total">${escapeHtml(entity.note || "")}</p>
        ${fundingBarHTML({ funding: entity.funding, multi_county: true, official_name: entity.official_name })}
      </div>
    `;
  }

  function healthDrilldownMarkup() {
    const isOpen = state.healthDrilldownOpen;
    if (!isOpen) {
      return `
        <div class="school-drilldown-toggle">
          <button type="button" class="school-drilldown-btn" aria-expanded="false">
            What does the Health District actually fund?
          </button>
        </div>
      `;
    }
    const h = DATA.health_district_explainer;
    const facilities = h.what_it_operates
      .map(
        (f) => `
          <p class="weighting-full-item"><strong>${escapeHtml(f.facility)} &mdash; ${escapeHtml(f.location)}</strong><span>${escapeHtml(f.detail)}</span></p>`
      )
      .join("");

    return `
      <div class="school-drilldown-toggle">
        <button type="button" class="school-drilldown-btn" aria-expanded="true">Hide &mdash; what the Health District funds</button>
        <div class="school-drilldown-body">
          <div class="school-card">
            <p class="school-card-name" style="margin-bottom:0.4rem">${escapeHtml(h.official_name)}</p>
            <p>${escapeHtml(h.what_it_is)}</p>
            <p class="school-note school-heads-up"><span class="school-note-label">Scope:</span>${escapeHtml(h.important_scope_note)}</p>
            <div class="weighting-full-list" style="border-top:none;padding-top:0;margin-top:0.6rem">${facilities}</div>
            <p style="margin-top:0.6rem">${escapeHtml(h.why_this_matters_for_a_rural_coastal_county)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function fireDrilldownMarkup() {
    const isOpen = state.fireDrilldownOpen;
    if (!isOpen) {
      return `
        <div class="school-drilldown-toggle">
          <button type="button" class="school-drilldown-btn" aria-expanded="false">
            Why do fire district rates vary so much?
          </button>
        </div>
      `;
    }
    const fc = DATA.fire_district_context;
    return `
      <div class="school-drilldown-toggle">
        <button type="button" class="school-drilldown-btn" aria-expanded="true">Hide &mdash; why fire rates vary</button>
        <div class="school-drilldown-body">
          <div class="school-card">
            <p>${escapeHtml(fc.headline)}</p>
            <p>${escapeHtml(fc.why_rates_vary_generally)}</p>
            <p class="dim" style="font-size:0.78rem">This app hasn't collected per-district detail (staffing model, station
              count, response times) for Curry County's ~13 fire districts yet &mdash; a rate difference alone doesn't tell
              you whether a district relies on volunteers or paid staff, so we're not guessing.</p>
          </div>
        </div>
      </div>
    `;
  }

  function schoolDrilldownMarkup(schoolDistrictKey) {
    const isOpen = state.schoolDrilldownOpen;
    const k12 = DATA.schools.k12_districts.find((d) => d.key === schoolDistrictKey);

    let body = "";
    if (k12) {
      let extraNote = "";
      if (k12.key === "central_curry" && DATA.schools.already_sourced_facts[0]) {
        extraNote += `<p class="school-note">${escapeHtml(DATA.schools.already_sourced_facts[0].fact)}</p>`;
      }
      if (k12.current_news_note) {
        extraNote += `<p class="school-note school-heads-up"><span class="school-note-label">Note:</span>${escapeHtml(k12.current_news_note)}</p>`;
      }
      body += schoolCardHTML(k12, extraNote);
    }
    // The "how does per-student funding work?" explainer sits right after
    // the resident's own K-12 district card -- the most relevant spot --
    // rather than after the ESD/SWOCC cards, so it's not easy to miss by
    // stopping short of scrolling past those.
    if (isOpen) {
      body += enrollmentExplainerMarkup(k12);
    }
    DATA.schools.regional_education_entities.forEach((e) => {
      body += regionalCardHTML(e);
    });

    return `
      <div class="school-drilldown-toggle">
        <button type="button" class="school-drilldown-btn" aria-expanded="${isOpen}">
          ${isOpen ? "Hide" : "See where the rest of the money comes from"} &mdash; state, federal &amp; more
        </button>
        <div class="school-drilldown-body" ${isOpen ? "" : "hidden"}>${isOpen ? body : ""}</div>
      </div>
    `;
  }

  function charterSliderOutputText(n, districtName) {
    if (n <= 0) {
      return `Move the slider to see the effect of resident students enrolling in an online charter school instead of ${escapeHtml(districtName)}.`;
    }
    const s = n === 1 ? "" : "s";
    const verbS = n === 1 ? "s" : "";
    return (
      `If ${n} student${s} who live${verbS} in ${escapeHtml(districtName)}'s boundary enroll${verbS} in an online ` +
      `charter school instead, the district loses funding for roughly ${n} weighted student${s} &mdash; at least 80% ` +
      `of normal per-K-8-student funding, or 95% for high schoolers &mdash; for as long as they stay enrolled elsewhere.`
    );
  }

  function enrollmentExplainerMarkup(k12) {
    const ex = DATA.schools.enrollment_funding_explainer;
    const alloc = ex.allocation;
    const charter = ex.charter_transfer;
    const isOpen = state.enrollmentExplainerOpen;

    if (!isOpen) {
      return `
        <div class="explainer-toggle">
          <button type="button" class="school-drilldown-btn" data-role="explainer-toggle" aria-expanded="false">
            How does per-student funding actually work?
          </button>
        </div>
      `;
    }

    const chipCategories = alloc.weighting_categories.slice(0, 4);
    const chips = chipCategories
      .map((c) => `<span class="weighting-chip">${escapeHtml(c.category.replace(/\s*\(.*\)$/, ""))}</span>`)
      .join("");

    const weightingListOpen = state.weightingListOpen;
    const fullList = alloc.weighting_categories
      .map(
        (c) => `
          <p class="weighting-full-item"><strong>${escapeHtml(c.category)}</strong><span>${escapeHtml(c.weight_note)}</span></p>`
      )
      .join("");

    const districtName = k12 ? k12.official_name : "a Curry County district";
    const n = state.charterStudents;
    const sliderOutput = charterSliderOutputText(n, districtName);

    return `
      <div class="explainer-toggle">
        <button type="button" class="school-drilldown-btn" data-role="explainer-toggle" aria-expanded="true">
          Hide &mdash; how per-student funding works
        </button>
        <div class="explainer-body">

          <div class="explainer-card">
            <p class="explainer-headline">${escapeHtml(alloc.headline)}</p>
            <p>${autoGlossify(alloc.the_basic_formula)}</p>
            <p>${escapeHtml(alloc.why_weighted_not_just_a_headcount)}</p>
            <p class="dim" style="font-size:0.78rem">Districts get more funding for:</p>
            <div class="weighting-chips">${chips}</div>
            <button type="button" class="weighting-more-btn" data-role="weighting-more">
              ${weightingListOpen ? "Show less" : `Show all ${alloc.weighting_categories.length} weighting categories`}
            </button>
            <div class="weighting-full-list" ${weightingListOpen ? "" : "hidden"}>
              ${fullList}
              <p class="dim" style="font-size:0.78rem;margin-top:0.5rem">${escapeHtml(alloc.the_smoothing_rule)}</p>
              <p class="dim" style="font-size:0.78rem">${escapeHtml(alloc.state_vs_local_share)}</p>
            </div>
          </div>

          <div class="explainer-card">
            <p class="explainer-headline">${escapeHtml(charter.headline)}</p>
            <p>${autoGlossify(charter.plain_language_summary)}</p>
            <div class="charter-rate-badges">
              <div class="charter-rate-badge">
                <span class="big-pct">80%</span>
                <span class="badge-caption">minimum transfer, grades K&ndash;8</span>
              </div>
              <div class="charter-rate-badge">
                <span class="big-pct">95%</span>
                <span class="badge-caption">minimum transfer, grades 9&ndash;12</span>
              </div>
            </div>
            <p class="dim" style="font-size:0.76rem">${escapeHtml(charter.statutory_minimum_transfer_rates.note)} (${escapeHtml(charter.statutory_minimum_transfer_rates.source)})</p>
            <p>${autoGlossify(charter.how_this_applies_to_online_charter_schools)}</p>
            <p>${escapeHtml(charter.the_takeaway_for_a_small_rural_county)}</p>

            <div class="charter-slider-row">
              <div class="charter-slider-label">
                <span>Students leaving for an online charter school</span>
                <strong>${n}</strong>
              </div>
              <input type="range" min="0" max="15" step="1" value="${n}" id="charter-slider" />
              <p class="charter-slider-output">${sliderOutput}</p>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function setupBillControls() {
    document.getElementById("advanced-toggle").addEventListener("change", (e) => {
      state.advanced = e.target.checked;
      document.getElementById("code-picker-wrap").hidden = !state.advanced;
      if (state.advanced) renderCodePicker();
    });

    document.getElementById("code-picker").addEventListener("change", (e) => {
      state.codeAreaCode = e.target.value;
      renderBillTab();
    });

    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const newMode = btn.dataset.mode;
        if (newMode !== state.inputMode) {
          // convert current value across modes so the field stays sensible
          const ca = currentCodeArea();
          const rate = ca.computed_rate;
          if (newMode === "bill" && state.inputMode === "assessed") {
            state.value = Math.round((state.value / 1000) * rate);
          } else if (newMode === "assessed" && state.inputMode === "bill") {
            state.value = rate > 0 ? Math.round((state.value / rate) * 1000) : 0;
          }
        }
        state.inputMode = newMode;
        document.getElementById("value-input").value = state.value;
        const hint = document.getElementById("value-hint");
        hint.innerHTML =
          newMode === "assessed"
            ? `${glossSpan("assessed_value", "Assessed value")} is usually well below ${glossSpan("real_market_value", "real market value")} in Oregon — check your tax statement or the Assessor's records for your parcel's actual figure.`
            : autoGlossify(
                "Enter the total annual property tax amount from a bill; this app will back out an implied assessed value using the composite rate for the selected area."
              );
        renderBillTab();
        renderCodePicker();
      });
    });

    document.getElementById("value-input").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      state.value = isNaN(v) ? 0 : v;
      renderBillTab();
      renderCodePicker();
    });

    document.getElementById("full-detail-btn").addEventListener("click", (e) => {
      state.fullDetailOpen = !state.fullDetailOpen;
      document.getElementById("full-detail-body").hidden = !state.fullDetailOpen;
      e.currentTarget.setAttribute("aria-expanded", String(state.fullDetailOpen));
      e.currentTarget.textContent = state.fullDetailOpen
        ? "Hide full detail"
        : "Show full detail — every taxing district";
    });
  }

  // ---------- County budget tab ----------
  function renderCountyTab() {
    const cb = DATA.county_budget;
    const segments = Object.entries(BUDGET_GROUP_COLORS).map(([group, color]) => {
      const value = cb.departments_chart
        .filter((d) => d.group === group)
        .reduce((s, d) => s + d.total_requirements, 0);
      return { label: group, value, color };
    });

    renderDonut(document.getElementById("county-donut"), segments, {
      ariaLabel: "County budget by fund group",
      centerTop: fmtUSD(cb.departments_chart_total),
      centerBottom: "FY25-26",
    });
    renderLegend(document.getElementById("county-legend"), segments);

    const tbody = document.querySelector("#county-table tbody");
    tbody.innerHTML = "";
    cb.departments_chart
      .slice()
      .sort((a, b) => b.total_requirements - a.total_requirements)
      .forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.department}</td>
          <td class="dim">${d.group}</td>
          <td>${fmtUSD(d.total_requirements)}</td>
          <td>${fmtPct(d.total_requirements / cb.departments_chart_total)}</td>
        `;
        tbody.appendChild(tr);
      });

    const totalEl = document.getElementById("county-total");
    totalEl.innerHTML = `
      <span class="big">${fmtUSD(cb.departments_chart_total)}</span>
      <div class="row"><span>Non-Departmental (pass-through, excluded above)</span><span>${fmtUSD(cb.non_departmental.total_requirements)}</span></div>
      <div class="row"><span>Road Capital Improvement reserve (excluded above)</span><span>${fmtUSD(cb.road_capital_reserve.total_requirements)}</span></div>
      <div class="row"><span>Total combined budget (all funds)</span><span>${fmtUSD(cb.total_combined_budget.all_funds_all_revenue_and_expenditure)}</span></div>
    `;

    renderNonPropertyTaxRevenue(cb.non_property_tax_revenue);
  }

  const REVENUE_SOURCE_COLORS = [
    "#4c6ef5", "#12b886", "#f59f00", "#7048e8", "#e03131",
    "#099268", "#f06595", "#495057", "#1c7ed6",
  ];

  function renderNonPropertyTaxRevenue(rev) {
    document.getElementById("nonprop-headline").textContent = rev.headline;
    document.getElementById("nonprop-pullquote").innerHTML =
      `<span class="school-note-label">Worth knowing:</span>${escapeHtml(rev.pull_quote)}`;

    const total = rev.sources.reduce((s, r) => s + r.fy2025_26_amount, 0);
    const segments = rev.sources.map((r, i) => ({
      label: r.name,
      value: r.fy2025_26_amount,
      color: REVENUE_SOURCE_COLORS[i % REVENUE_SOURCE_COLORS.length],
    }));

    renderDonut(document.getElementById("nonprop-donut"), segments, {
      ariaLabel: "County revenue by source",
      centerTop: fmtUSD(total),
      centerBottom: "FY25-26",
    });
    renderLegend(document.getElementById("nonprop-legend"), segments);
  }

  // ---------- About tab ----------
  function renderAboutTab() {
    const list = document.getElementById("sources-list");
    list.innerHTML = "";
    DATA.meta.sources.forEach((s) => {
      const li = document.createElement("li");
      if (s.url) {
        li.innerHTML = `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a> &mdash; ${s.status}`;
      } else {
        li.textContent = `${s.label} — ${s.status}`;
      }
      list.appendChild(li);
    });

    document.getElementById("flagged-count").textContent = DATA.flagged_code_areas.length;

    const tbody = document.querySelector("#flagged-table tbody");
    tbody.innerHTML = "";
    DATA.flagged_code_areas.forEach((f) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.area}</td>
        <td>${f.code}</td>
        <td>${f.computed_rate.toFixed(4)}</td>
        <td>${f.printed_rate_as_source === null ? "— (did not reconcile)" : f.printed_rate_as_source.toFixed(4)}</td>
        <td>${f.diff === null ? "—" : (f.diff > 0 ? "+" : "") + f.diff.toFixed(4)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---------- Recent & Upcoming Changes tab ----------
  function renderChangesTab() {
    const uc = DATA.upcoming_changes;
    const wrap = document.getElementById("recent-measures");
    wrap.innerHTML = uc.recent_measures
      .map((m) => {
        const statusClass = m.status === "FAILED" ? "school-heads-up" : "";
        return `
          <div class="school-card" style="margin-top:0.8rem">
            <div class="school-card-header">
              <span class="school-card-name">${escapeHtml(m.measure)}</span>
              <span class="school-card-meta">${escapeHtml(m.election_date)}</span>
            </div>
            <p class="school-note ${statusClass}"><span class="school-note-label">${escapeHtml(m.status)}:</span>${escapeHtml(m.result_detail)}</p>
            <p>${escapeHtml(m.what_it_would_have_done)}</p>
            <p>${escapeHtml(m.consequence_of_failure || m.consequence || "")}</p>
            ${m.worth_noting_for_context ? `<p class="dim" style="font-size:0.78rem">${escapeHtml(m.worth_noting_for_context)}</p>` : ""}
          </div>
        `;
      })
      .join("");

    const sc = uc.statewide_context;
    document.getElementById("statewide-context-card").innerHTML = `
      <p class="school-card-total"><strong>Statewide context:</strong> ${escapeHtml(sc.fact)}</p>
      <p>${escapeHtml(sc.why_it_matters_here)}</p>
    `;
  }

  // ---------- Plain-language intro ----------
  function renderIntro() {
    document.getElementById("intro-opening").textContent = DATA.headline_stats.opening_section_copy;
    const list = document.getElementById("intro-facts");
    list.innerHTML = "";
    // Two of the three headline facts: the county's small share and the
    // schools' large share are the most universally-true (the city one is
    // conditional on living in city limits, so it's covered in depth in the
    // district breakdown instead of the lead).
    DATA.headline_stats.headline_facts.slice(0, 2).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f.stat;
      list.appendChild(li);
    });
  }

  // ---------- Init ----------
  async function init() {
    const res = await fetch("data/app-data.json");
    DATA = await res.json();
    GROUP_BY_ID = {};
    DATA.category_groups.forEach((g) => (GROUP_BY_ID[g.id] = g));

    setupTabs();
    setupGlossaryEvents();
    renderIntro();
    renderAreaPicker();
    renderCodePicker();
    setupBillControls();
    renderBillTab();
    renderCountyTab();
    renderChangesTab();
    renderAboutTab();
    initGlossaryAnchors();
    setupPrintButton();
  }

  function setupPrintButton() {
    document.getElementById("print-summary-btn").addEventListener("click", () => {
      renderPrintSummary();
      window.print();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
