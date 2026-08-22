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

  const fmtUSD = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtUSD2 = (n) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const fmtPct = (n) => (n * 100).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";

  let DATA = null;
  let state = {
    areaIndex: 0,
    codeAreaCode: null,
    advanced: false,
    inputMode: "assessed", // or "bill"
    value: 300000,
  };

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

  function renderCodePicker() {
    const select = document.getElementById("code-picker");
    select.innerHTML = "";
    const area = currentArea();
    area.code_areas.forEach((ca) => {
      const opt = document.createElement("option");
      opt.value = ca.code;
      const flag = ca.flagged ? " ⚠️" : "";
      opt.textContent = `Code ${ca.code}${ca.representative ? " (representative)" : ""} — ${ca.computed_rate.toFixed(4)}/$1,000${flag}`;
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
      bill_rate: d.bill_rate,
      amount: (assessedValue / 1000) * d.bill_rate,
    }));

    // Group by category for donut + legend
    const byCategory = {};
    districtAmounts.forEach((d) => {
      byCategory[d.category] = (byCategory[d.category] || 0) + d.amount;
    });
    const segments = Object.entries(byCategory)
      .filter(([, v]) => v > 0)
      .map(([cat, v]) => ({
        label: CATEGORY_LABELS[cat] || cat,
        value: v,
        color: CATEGORY_COLORS[cat] || "#adb5bd",
      }));

    renderDonut(document.getElementById("bill-donut"), segments, {
      ariaLabel: "Tax bill by category",
      centerTop: fmtUSD(totalBill),
      centerBottom: "per year",
    });
    renderLegend(document.getElementById("bill-legend"), segments);

    // District table, sorted by amount desc
    const tbody = document.querySelector("#bill-table tbody");
    tbody.innerHTML = "";
    districtAmounts
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.name}</td>
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
        document.getElementById("value-hint").textContent =
          newMode === "assessed"
            ? "Assessed value is usually well below market value in Oregon — check your tax statement or the Assessor's records for your parcel's actual figure."
            : "Enter the total annual property tax amount from a bill; this app will back out an implied assessed value using the composite rate for the selected area.";
        renderBillTab();
      });
    });

    document.getElementById("value-input").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      state.value = isNaN(v) ? 0 : v;
      renderBillTab();
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

  // ---------- Init ----------
  async function init() {
    const res = await fetch("data/app-data.json");
    DATA = await res.json();

    setupTabs();
    renderAreaPicker();
    renderCodePicker();
    setupBillControls();
    renderBillTab();
    renderCountyTab();
    renderAboutTab();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
