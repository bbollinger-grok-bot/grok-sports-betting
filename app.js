const DATA_URL = "data/bets.json";
const START_DEFAULT = 10000;

const statusNorm = (s) => {
  const x = String(s || "").trim().toLowerCase();
  if (x === "won" || x === "win") return "won";
  if (x === "lost" || x === "loss") return "lost";
  if (x === "push") return "push";
  if (x === "void") return "void";
  if (x === "open" || x === "") return "open";
  return x;
};

const isOpen = (b) => statusNorm(b.status) === "open";
const isSettled = (b) => !isOpen(b);

const americanProfit = (stake, odds) => {
  const o = Number(odds);
  if (!o || !stake) return 0;
  return o > 0 ? stake * (o / 100) : stake * (100 / Math.abs(o));
};

const profitOf = (b) => {
  if (b.profit != null && b.profit !== "") return Number(b.profit);
  const st = statusNorm(b.status);
  const stake = Number(b.stake) || 0;
  if (st === "lost") return -stake;
  if (st === "push" || st === "void") return 0;
  if (st === "won") return americanProfit(stake, b.odds_american);
  return 0;
};

const money = (n, {sign = false} = {}) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Number(n);
  const abs = Math.abs(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  if (sign && v > 0) return `+${abs}`;
  if (sign && v < 0) return `-${abs}`;
  if (!sign && v < 0) return `-${abs}`;
  return abs;
};

const oddsFmt = (o) => {
  if (o == null || o === "") return "—";
  const n = Number(o);
  if (Number.isNaN(n)) return String(o);
  return n > 0 ? `+${n}` : String(n);
};

const fmtDate = (isoDay) => {
  if (!isoDay) return "—";
  const [y, m, d] = String(isoDay).split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtUpdated = (iso) => {
  if (!iso) return "Unknown";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const bySettle = (a, b) => {
  const gd = String(a.game_date || "").localeCompare(String(b.game_date || ""));
  if (gd) return gd;
  const pl = String(a.placed_at_ct || "").localeCompare(String(b.placed_at_ct || ""));
  if (pl) return pl;
  return String(a.bet_id || "").localeCompare(String(b.bet_id || ""));
};

const byRecent = (a, b) => bySettle(b, a);

const badgeFor = (b) => {
  const st = statusNorm(b.status);
  if (st === "won") return { cls: "hit", label: "Hit" };
  if (st === "lost") return { cls: "miss", label: "Miss" };
  if (st === "push") return { cls: "push", label: "Push" };
  if (st === "void") return { cls: "push", label: "Void" };
  if (st === "open") return { cls: "open", label: "Open" };
  return { cls: "push", label: b.status || "—" };
};

const confidenceDots = (n) => {
  const v = Number(n) || 0;
  const dots = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < v ? "on" : ""}"></i>`
  ).join("");
  return `<span class="conf" title="Confidence ${v}/5" aria-label="Confidence ${v} of 5">${dots}</span>`;
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const statsOf = (bets, start) => {
  const settled = bets.filter(isSettled);
  const open = bets.filter(isOpen);
  const profit = settled.reduce((s, b) => s + profitOf(b), 0);
  const staked = settled.reduce((s, b) => s + (Number(b.stake) || 0), 0);
  const wins = settled.filter((b) => statusNorm(b.status) === "won").length;
  const losses = settled.filter((b) => statusNorm(b.status) === "lost").length;
  const pushes = settled.filter((b) => {
    const st = statusNorm(b.status);
    return st === "push" || st === "void";
  }).length;
  return {
    bankroll: start + profit,
    profit,
    staked,
    roi: staked ? profit / staked : null,
    record: `${wins}–${losses}–${pushes}`,
    wins,
    losses,
    pushes,
    openCount: open.length,
    exposure: open.reduce((s, b) => s + (Number(b.stake) || 0), 0),
    settledCount: settled.length,
    open,
    settled,
  };
};

const renderStats = (s) => {
  const pnlCls = s.profit > 0 ? "up" : s.profit < 0 ? "down" : "flat";
  const roi =
    s.roi == null
      ? "—"
      : `${s.roi >= 0 ? "" : "−"}${Math.abs(s.roi * 100).toFixed(1)}%`;
  const roiCls = s.roi == null ? "flat" : s.roi > 0 ? "up" : s.roi < 0 ? "down" : "flat";
  const cards = [
    ["Current bankroll", money(s.bankroll), "Started at $10,000.00", ""],
    ["Total P&amp;L", money(s.profit, { sign: true }), s.settledCount ? `${s.settledCount} settled` : "No settled bets yet", pnlCls],
    ["ROI", roi, s.roi == null ? "On settled stakes" : `On ${money(s.staked)} settled`, roiCls],
    ["Record", s.record, "Win–loss–push", ""],
    ["Open exposure", money(s.exposure), s.openCount ? `${s.openCount} bet${s.openCount === 1 ? "" : "s"} riding` : "Nothing riding", ""],
  ];
  document.getElementById("stats").innerHTML = cards
    .map(
      ([label, value, sub, cls]) => `
      <article class="stat">
        <p class="stat-label">${label}</p>
        <p class="stat-value ${cls}">${value}</p>
        <p class="stat-sub">${sub}</p>
      </article>`
    )
    .join("");
};

const seriesOf = (settled, start) => {
  const pts = [{ label: "Start", bankroll: start, bet: null }];
  let bal = start;
  for (const b of [...settled].sort(bySettle)) {
    bal += profitOf(b);
    pts.push({ label: fmtDate(b.game_date), bankroll: bal, bet: b });
  }
  return pts;
};

const renderChart = (settled, start) => {
  const wrap = document.getElementById("chart");
  const note = document.getElementById("chart-note");
  const pts = seriesOf(settled, start);
  if (settled.length === 0) {
    note.textContent = "Still at the starting bankroll — no bets have settled yet.";
  } else {
    note.textContent = `${settled.length} settlement${settled.length === 1 ? "" : "s"}`;
  }

  const w = 1000;
  const h = 280;
  const pad = { t: 18, r: 16, b: 36, l: 64 };
  const values = pts.map((p) => p.bankroll);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 500;
    max += 500;
  }
  const padY = (max - min) * 0.12;
  min -= padY;
  max += padY;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i) =>
    pts.length === 1
      ? pad.l + innerW / 2
      : pad.l + (i / (pts.length - 1)) * innerW;
  const y = (v) => pad.t + ((max - v) / (max - min)) * innerH;

  const ticks = 4;
  const grid = [];
  const labels = [];
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const yy = y(v);
    grid.push(`<line class="chart-grid" x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}" />`);
    labels.push(
      `<text class="chart-axis" x="${pad.l - 8}" y="${yy + 4}" text-anchor="end">${money(v)}</text>`
    );
  }

  const coords = pts.map((p, i) => [x(i), y(p.bankroll)]);
  const line = coords.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const baseY = y(Math.max(min, Math.min(max, start)));
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${(h - pad.b).toFixed(1)} L${coords[0][0].toFixed(1)},${(h - pad.b).toFixed(1)} Z`;

  const xLabels = pts.map((p, i) => {
    if (pts.length > 8 && i !== 0 && i !== pts.length - 1 && i % 2) return "";
    return `<text class="chart-axis" x="${x(i)}" y="${h - 10}" text-anchor="middle">${esc(p.label)}</text>`;
  });

  const dots = pts
    .map((p, i) => {
      const tip = p.bet
        ? `${esc(p.bet.matchup)} · ${money(profitOf(p.bet), { sign: true })} → ${money(p.bankroll)}`
        : `Starting bankroll ${money(p.bankroll)}`;
      return `<circle class="chart-dot" data-tip="${tip}" cx="${x(i)}" cy="${y(p.bankroll)}" r="5" />`;
    })
    .join("");

  wrap.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Running bankroll over time">
      ${grid.join("")}
      ${labels.join("")}
      <path class="chart-area" d="${area}"></path>
      <path class="chart-line" d="${line}"></path>
      ${xLabels.join("")}
      ${dots}
    </svg>
    <div class="chart-tip" id="chart-tip" hidden></div>
  `;

  const tip = wrap.querySelector("#chart-tip");
  wrap.querySelectorAll(".chart-dot").forEach((dot) => {
    const show = () => {
      tip.hidden = false;
      tip.textContent = dot.getAttribute("data-tip");
      tip.classList.add("show");
      const svg = wrap.querySelector("svg");
      const rect = svg.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const cx = Number(dot.getAttribute("cx"));
      const cy = Number(dot.getAttribute("cy"));
      tip.style.left = `${((cx / w) * rect.width) + (rect.left - wrapRect.left)}px`;
      tip.style.top = `${((cy / h) * rect.height) + (rect.top - wrapRect.top)}px`;
    };
    const hide = () => {
      tip.classList.remove("show");
      tip.hidden = true;
    };
    dot.addEventListener("mouseenter", show);
    dot.addEventListener("focus", show);
    dot.addEventListener("mouseleave", hide);
    dot.addEventListener("blur", hide);
    dot.setAttribute("tabindex", "0");
  });
};

const renderOpen = (open) => {
  const root = document.getElementById("open-bets");
  const note = document.getElementById("open-note");
  if (!open.length) {
    note.textContent = "";
    root.innerHTML = `<p class="empty">No bets currently riding.</p>`;
    return;
  }
  note.textContent = `${open.length} open`;
  root.innerHTML = `<div class="bet-grid">${[...open]
    .sort(bySettle)
    .map(
      (b) => `
    <article class="bet-card">
      <div class="bet-top">
        <span class="league-tag">${esc(b.league || "")}</span>
        <span class="bet-date">${esc(fmtDate(b.game_date))}</span>
      </div>
      <h3>${esc(b.matchup)}</h3>
      <p class="selection"><span>${esc(b.market)} ·</span> ${esc(b.selection)} <span>at ${oddsFmt(b.odds_american)}</span></p>
      <dl class="bet-meta">
        <div><dt>Stake</dt><dd>${money(b.stake)}</dd></div>
        <div><dt>Confidence</dt><dd>${confidenceDots(b.confidence_1to5)}</dd></div>
        <div><dt>ID</dt><dd>${esc(b.bet_id)}</dd></div>
      </dl>
      ${b.reason ? `<p class="reason">${esc(b.reason)}</p>` : ""}
    </article>`
    )
    .join("")}</div>`;
};

const renderHistory = (bets) => {
  const root = document.getElementById("history");
  const note = document.getElementById("history-note");
  if (!bets.length) {
    note.textContent = "";
    root.innerHTML = `<p class="empty">No bets in this view yet.</p>`;
    return;
  }
  note.textContent = `${bets.length} ticket${bets.length === 1 ? "" : "s"}`;
  const rows = [...bets]
    .sort(byRecent)
    .map((b) => {
      const badge = badgeFor(b);
      const pnl = isOpen(b) ? null : profitOf(b);
      const pnlCls = pnl == null ? "" : pnl > 0 ? "up" : pnl < 0 ? "down" : "flat";
      return `<tr>
        <td class="skip-label matchup-cell" data-label="Matchup">
          <strong>${esc(b.matchup)}</strong>
          <span class="sub">${esc(fmtDate(b.game_date))} · ${esc(b.league || "")} · ${esc(b.bet_id)}</span>
        </td>
        <td data-label="Market">${esc(b.market)}<div class="sub">${esc(b.selection)}</div></td>
        <td class="num" data-label="Odds">${oddsFmt(b.odds_american)}</td>
        <td class="num" data-label="Stake">${money(b.stake)}</td>
        <td data-label="Conf.">${confidenceDots(b.confidence_1to5)}</td>
        <td data-label="Result"><span class="badge ${badge.cls}">${badge.label}</span></td>
        <td class="num pnl ${pnlCls}" data-label="Profit">${pnl == null ? "—" : money(pnl, { sign: true })}</td>
      </tr>`;
    })
    .join("");
  root.innerHTML = `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>Matchup</th>
        <th>Market</th>
        <th class="num">Odds</th>
        <th class="num">Stake</th>
        <th>Conf.</th>
        <th>Result</th>
        <th class="num">Profit</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table></div>`;
};

const renderPills = (leagues, active) => {
  const all = ["All", ...leagues];
  document.getElementById("league-pills").innerHTML = all
    .map((name) => {
      const val = name === "All" ? "" : name;
      const pressed = active === val;
      return `<button type="button" class="pill" data-league="${esc(val)}" aria-pressed="${pressed}">${esc(name)}</button>`;
    })
    .join("");
};

const main = async () => {
  const updated = document.getElementById("updated");
  let payload;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load data (${res.status})`);
    payload = await res.json();
  } catch (err) {
    updated.textContent = "Data unavailable";
    document.getElementById("stats").innerHTML = "";
    document.getElementById("chart").innerHTML = `<p class="error">${esc(err.message)}</p>`;
    document.getElementById("open-bets").innerHTML = "";
    document.getElementById("history").innerHTML = "";
    return;
  }

  const start = Number(payload.starting_bankroll) || START_DEFAULT;
  const bets = Array.isArray(payload.bets) ? payload.bets : [];
  const leagues = [...new Set(bets.map((b) => b.league).filter(Boolean))].sort();
  let active = "";

  updated.innerHTML = `Last updated <time datetime="${esc(payload.updated_at || "")}">${esc(
    fmtUpdated(payload.updated_at)
  )}</time>`;

  const paint = () => {
    const view = active ? bets.filter((b) => b.league === active) : bets;
    const s = statsOf(view, start);
    renderPills(leagues, active);
    renderStats(s);
    renderChart(s.settled, start);
    renderOpen(s.open);
    renderHistory(view);
  };

  document.getElementById("league-pills").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-league]");
    if (!btn) return;
    active = btn.getAttribute("data-league") || "";
    paint();
  });

  paint();
};

main();
