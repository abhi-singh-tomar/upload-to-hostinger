// ─────────────────────────────────────────────────────────────
//  Pragya's CEO Planner — app logic
//  Works with Supabase when config.js is filled in.
//  With an empty config.js it runs in demo mode (saves in this browser only).
// ─────────────────────────────────────────────────────────────
const CFG = window.APP_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
let sb = null;

// ── Dates (device time; her phone is on India time) ──────────
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(s + "T00:00:00");
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtLong = (s) => parse(s).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = (s) => parse(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (t) => { if (!t) return ""; let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Storage layer ────────────────────────────────────────────
const LS = {
  get(k, f) { try { const v = localStorage.getItem("ceo:" + k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem("ceo:" + k, JSON.stringify(v)); } catch {} },
};

const Store = {
  user: null,
  async init() {
    if (DEMO) { this.user = { id: "demo", email: "demo mode" }; return; }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    this.user = data.session?.user || null;
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
  },
  async signOut() { if (!DEMO) await sb.auth.signOut(); this.user = null; },

  async getLogs(from, to) {
    if (DEMO) {
      const all = LS.get("logs", {}); const out = {};
      Object.keys(all).forEach((k) => { if (k >= from && k <= to) out[k] = all[k]; });
      return out;
    }
    const { data, error } = await sb.from("day_logs").select("day,data").gte("day", from).lte("day", to);
    if (error) throw error;
    const out = {}; data.forEach((r) => (out[r.day] = r.data)); return out;
  },
  async saveLog(day, data) {
    if (DEMO) { const all = LS.get("logs", {}); all[day] = data; LS.set("logs", all); return; }
    const { error } = await sb.from("day_logs").upsert({ user_id: this.user.id, day, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async getSettings() {
    if (DEMO) return LS.get("settings", {});
    const { data, error } = await sb.from("settings").select("data").maybeSingle();
    if (error) throw error;
    return data?.data || {};
  },
  async saveSettings(obj) {
    if (DEMO) return LS.set("settings", obj);
    const { error } = await sb.from("settings").upsert({ user_id: this.user.id, data: obj });
    if (error) throw error;
  },
  async listReminders() {
    if (DEMO) {
      let r = LS.get("rem", null);
      if (!r) { r = DEFAULT_REMINDERS.map((x, i) => ({ ...x, id: i + 1, enabled: true })); LS.set("rem", r); }
      return r;
    }
    let { data, error } = await sb.from("reminders").select("*").order("time");
    if (error) throw error;
    if (!data.length) {
      const rows = DEFAULT_REMINDERS.map((x) => ({ ...x, rule: x.rule || null, enabled: true, user_id: this.user.id }));
      const ins = await sb.from("reminders").insert(rows).select("*");
      if (ins.error) throw ins.error;
      data = ins.data.sort((a, b) => a.time.localeCompare(b.time));
    }
    return data;
  },
  async saveReminder(r) {
    if (DEMO) {
      const all = LS.get("rem", []); const i = all.findIndex((x) => x.id === r.id);
      if (i >= 0) all[i] = r; else { r.id = Date.now(); all.push(r); }
      LS.set("rem", all); return r;
    }
    const row = { time: r.time, title: r.title, body: r.body || "", days: r.days, rule: r.rule || null, enabled: r.enabled, user_id: this.user.id };
    if (r.id) row.id = r.id;
    const { data, error } = await sb.from("reminders").upsert(row).select("*").single();
    if (error) throw error;
    return data;
  },
  async deleteReminder(id) {
    if (DEMO) return LS.set("rem", LS.get("rem", []).filter((x) => x.id !== id));
    const { error } = await sb.from("reminders").delete().eq("id", id);
    if (error) throw error;
  },
  async listCar() {
    if (DEMO) return LS.get("car", []);
    const { data, error } = await sb.from("car_items").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data;
  },
  async addCar(text) {
    if (DEMO) { const all = LS.get("car", []); all.unshift({ id: Date.now(), text, done: false }); LS.set("car", all); return; }
    const { error } = await sb.from("car_items").insert({ text, user_id: this.user.id });
    if (error) throw error;
  },
  async updateCar(id, patch) {
    if (DEMO) { LS.set("car", LS.get("car", []).map((x) => (x.id === id ? { ...x, ...patch } : x))); return; }
    const { error } = await sb.from("car_items").update(patch).eq("id", id);
    if (error) throw error;
  },
  async deleteCar(id) {
    if (DEMO) return LS.set("car", LS.get("car", []).filter((x) => x.id !== id));
    const { error } = await sb.from("car_items").delete().eq("id", id);
    if (error) throw error;
  },
  async getTasks(from, to) {
    if (DEMO) {
      const all = LS.get("tasks", []); const out = {};
      all.forEach((t) => { if (t.day >= from && t.day <= to) (out[t.day] ||= []).push(t); });
      Object.values(out).forEach((arr) => arr.sort((a, b) => a.time.localeCompare(b.time)));
      return out;
    }
    const { data, error } = await sb.from("tasks").select("*").gte("day", from).lte("day", to).order("time");
    if (error) throw error;
    const out = {}; data.forEach((t) => (out[t.day] ||= []).push(t)); return out;
  },
  async addTask(day, time, title) {
    if (DEMO) {
      const all = LS.get("tasks", []);
      const t = { id: Date.now(), day, time, title, done: false };
      all.push(t); LS.set("tasks", all); return t;
    }
    const { data, error } = await sb.from("tasks").insert({ user_id: this.user.id, day, time, title }).select("*").single();
    if (error) throw error;
    return data;
  },
  async updateTask(id, patch) {
    if (DEMO) { LS.set("tasks", LS.get("tasks", []).map((t) => (t.id === id ? { ...t, ...patch } : t))); return; }
    const { error } = await sb.from("tasks").update(patch).eq("id", id);
    if (error) throw error;
  },
  async deleteTask(id) {
    if (DEMO) return LS.set("tasks", LS.get("tasks", []).filter((t) => t.id !== id));
    const { error } = await sb.from("tasks").delete().eq("id", id);
    if (error) throw error;
  },
  async savePushSub(sub) {
    const j = sub.toJSON();
    const { error } = await sb.from("push_subscriptions").upsert(
      { user_id: this.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent },
      { onConflict: "endpoint" });
    if (error) throw error;
  },
  async testPush() {
    const { data } = await sb.auth.getSession();
    const res = await fetch(`${CFG.SUPABASE_URL}/functions/v1/send-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ test: true }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Server replied ${res.status}`);
    return j;
  },
};

// ── App state ────────────────────────────────────────────────
const S = {
  tab: LS.get("tab", "today"),
  planSeg: "tomorrow",
  moreSeg: "reminders",
  date: today(),
  logs: {},
  tasks: {},
  settings: {},
  reminders: [],
  car: [],
  saving: false,
  taskFormOpen: false,
};

const emptyLog = () => ({ h: {}, m: null, k: {}, n: {}, a: "" });
const logFor = (d) => (S.logs[d] ||= emptyLog());
const names = (t) => String(t || "")
  .replaceAll("{child1}", S.settings.child1 || "child 1")
  .replaceAll("{child2}", S.settings.child2 || "child 2");

// save with a short delay so taps feel instant
const pending = {};
function queueSave(day) {
  clearTimeout(pending[day]);
  setStatus("Saving…");
  pending[day] = setTimeout(async () => {
    try { await Store.saveLog(day, S.logs[day]); setStatus(DEMO ? "Saved on this device" : "Saved"); }
    catch (e) { setStatus("Not saved — check your internet", true); console.error(e); }
  }, 500);
}
function setStatus(t, bad) {
  const el = document.getElementById("status"); if (!el) return;
  el.textContent = t; el.classList.toggle("bad", !!bad);
}
function toast(t) {
  const el = document.getElementById("toast"); el.textContent = t; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
}

// ── Scoring ──────────────────────────────────────────────────
function musts(day) {
  const log = S.logs[day];
  if (log && Array.isArray(log.m)) return { list: log.m, suggested: false };
  return { list: suggestedMusts(day).map((t) => ({ t, d: false })), suggested: true };
}
function score(day) {
  const log = S.logs[day] || emptyLog();
  const h = HABITS.filter((x) => log.h[x.id]).length;
  const m = Array.isArray(log.m) ? log.m.filter((x) => x.t) : [];
  const md = m.filter((x) => x.d).length;
  const total = HABITS.length + m.length;
  return { done: h + md, total, pct: total ? (h + md) / total : 0, habits: h, musts: md, mustTotal: m.length };
}
function streak(id) {
  let d = today(), n = 0;
  if (!(S.logs[d]?.h?.[id])) d = addDays(d, -1);
  while (S.logs[d]?.h?.[id]) { n++; d = addDays(d, -1); }
  return n;
}

// ── Icons (inline SVG) ───────────────────────────────────────
const I = {
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  dash: '<svg viewBox="0 0 24 24"><path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
};

// ── Views ────────────────────────────────────────────────────
function ring(pct, size = 76) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, off = c * (1 - pct);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function viewToday() {
  const d = S.date, isToday = d === today();
  const log = logFor(d); const sc = score(d); const mu = musts(d);
  const plan = buildPlan(d); const sp = SPECIAL[d] || {};
  const dayTasks = S.tasks[d] || [];
  const combined = [...plan, ...dayTasks.map((t) => ({
    id: "task-" + t.id, time: t.time, cat: "task", text: t.title, star: false,
    isTask: true, taskId: t.id, done: t.done,
  }))].sort((a, b) => a.time.localeCompare(b.time));
  const now = nowHM();
  let cur = -1;
  if (isToday) combined.forEach((p, i) => { if (p.time <= now) cur = i; });
  const principle = PRINCIPLES[parse(d).getDate() % PRINCIPLES.length];
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  return `
  <header class="top">
    <div class="daynav">
      <button class="icon-btn" data-act="day" data-n="-1" aria-label="Previous day">${I.left}</button>
      <div class="daynav-mid">
        <div class="eyebrow">${isToday ? "Today" : d < today() ? "Looking back" : "Looking ahead"}</div>
        <div class="daylabel">${fmtLong(d)}</div>
      </div>
      <button class="icon-btn" data-act="day" data-n="1" aria-label="Next day">${I.right}</button>
    </div>
    ${isToday ? "" : `<button class="linkish" data-act="gotoday">Back to today</button>`}
  </header>

  <section class="task-cta-wrap">
    <button class="task-cta" data-act="toggleTaskForm">
      <span class="task-cta-icon">${I.plus}</span>
      <span class="task-cta-text"><b>Add a task</b><small>Give it a deadline — I'll remind you</small></span>
    </button>
    ${S.taskFormOpen
      ? `<form class="addrow taskrow task-form-top" data-form="task">
          <input id="taskTitle" placeholder="Task…" aria-label="Task title" required>
          <input id="taskDate" type="date" aria-label="Task date" required value="${esc(d)}">
          <input id="taskTime" type="time" aria-label="Deadline time" required value="${esc(nowHM())}">
          <button class="btn">${I.plus}<span>Add</span></button>
        </form>`
      : ""}
  </section>

  <section class="hero">
    <div class="hero-ring">${ring(sc.pct)}<span class="hero-pct">${Math.round(sc.pct * 100)}<small>%</small></span></div>
    <div class="hero-text">
      <h1>${isToday ? `${greet}, ${esc(S.settings.name || "Pragya")}` : "Your day"}</h1>
      <p>${sc.done} of ${sc.total} done · ${sc.habits}/${HABITS.length} habits</p>
      <p class="principle">${esc(principle)}</p>
    </div>
  </section>

  ${sp.note ? `<div class="notice">${esc(sp.note)}</div>` : ""}

  <section class="card">
    <div class="card-head"><h2>Top 3 must-dos</h2>${mu.suggested ? `<span class="tag">Suggested</span>` : ""}</div>
    <ul class="musts">
      ${[0, 1, 2].map((i) => {
        const m = mu.list[i] || { t: "", d: false };
        return `<li class="must ${m.d ? "done" : ""}">
          <button class="tick" data-act="must" data-i="${i}" aria-pressed="${m.d}" aria-label="Mark must-do ${i + 1} done">${I.check}</button>
          <textarea class="must-in" rows="1" id="must-${d}-${i}" data-act="mustText" data-i="${i}" placeholder="Must-do ${i + 1}" aria-label="Must-do ${i + 1}">${esc(m.t)}</textarea>
        </li>`;
      }).join("")}
    </ul>
  </section>

  <section class="card">
    <div class="card-head"><h2>Daily habits</h2><span class="muted">${sc.habits} of ${HABITS.length}</span></div>
    <div class="habits">
      ${HABITS.map((h) => {
        const on = !!log.h[h.id]; const st = streak(h.id);
        return `<button class="habit ${on ? "on" : ""}" data-act="habit" data-id="${h.id}" aria-pressed="${on}">
          <span class="habit-top"><span class="habit-time">${fmtTime(h.time)}</span><span class="dot">${I.check}</span></span>
          <span class="habit-label">${esc(names(h.label))}</span>
          <span class="habit-sub">${st > 1 ? `${st}-day streak` : esc(h.sub)}</span>
        </button>`;
      }).join("")}
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h2>Hour by hour</h2><span class="muted">Tap an open hour to add yours</span></div>
    <ol class="timeline">
      ${combined.map((p, i) => {
        const isTaskItem = !!p.isTask;
        const done = isTaskItem ? !!p.done : !!log.k[p.id];
        const note = isTaskItem ? "" : (log.n[p.id] || "");
        const isOpen = !isTaskItem && p.cat === "open";
        return `<li class="tl ${isOpen ? "tl-open" : ""} ${isTaskItem ? "tl-task" : ""} ${i === cur ? "tl-now" : ""} ${done ? "done" : ""}">
          <span class="tl-time">${fmtTime(p.time)}</span>
          <span class="tl-dot c-${p.cat}" title="${CATS[p.cat]}"></span>
          <span class="tl-body">
            ${isOpen
              ? `<input class="tl-in" id="note-${d}-${p.id}" data-act="note" data-id="${p.id}" value="${esc(note)}" placeholder="Open hour · add yours">`
              : `<span class="tl-text">${p.star ? '<b class="star">★</b> ' : ""}${esc(names(p.text))}</span>`}
            ${i === cur ? `<span class="now-pill">Now</span>` : ""}
          </span>
          ${isTaskItem
            ? `<span class="tl-actions">
                <button class="tick small" data-act="taskTick" data-id="${p.taskId}" aria-pressed="${done}" aria-label="Mark task done">${I.check}</button>
                <button class="icon-btn small" data-act="taskDel" data-id="${p.taskId}" aria-label="Delete task">${I.x}</button>
              </span>`
            : (isOpen && !note ? "" : `<button class="tick small" data-act="task" data-id="${p.id}" aria-pressed="${done}" aria-label="Mark done">${I.check}</button>`)}
        </li>`;
      }).join("")}
    </ol>
  </section>`;
}

function viewPlan() {
  const seg = S.planSeg;
  const segs = [["tomorrow", "Tomorrow"], ["week", "Week"], ["quarter", "Quarter"], ["reports", "Reports"]];
  let body = "";
  if (seg === "tomorrow") {
    const t = addDays(today(), 1); const tl = logFor(t); const tm = musts(t);
    const todayM = musts(today()).list.filter((m) => m.t && !m.d);
    const plan = buildPlan(t).filter((p) => p.star || ["meet", "comp", "ngo", "report"].includes(p.cat));
    body = `
    <section class="card">
      <div class="card-head"><h2>Tomorrow · ${fmtShort(t)}</h2>${tm.suggested ? `<span class="tag">Suggested</span>` : ""}</div>
      <p class="muted">Write this at 6:15 pm. Keep it to three.</p>
      <ul class="musts">
        ${[0, 1, 2].map((i) => `<li class="must"><span class="num">${i + 1}</span>
          <textarea class="must-in" rows="1" id="tm-${i}" data-act="tmText" data-i="${i}" placeholder="Must-do ${i + 1}" aria-label="Tomorrow must-do ${i + 1}">${esc(tm.list[i]?.t || "")}</textarea></li>`).join("")}
      </ul>
      ${todayM.length ? `<div class="carry"><div class="muted">Not finished today — move to tomorrow?</div>
        ${todayM.map((m, i) => `<button class="chip-btn" data-act="carry" data-t="${esc(m.t)}">${I.plus}<span>${esc(m.t)}</span></button>`).join("")}</div>` : ""}
    </section>
    <section class="card">
      <div class="card-head"><h2>7:15 assignments</h2>
        <button class="btn ghost" data-act="copyAssign">${I.copy}<span>Copy</span></button></div>
      <p class="muted">Draft tonight, send to the MMPL group tomorrow morning.</p>
      <textarea id="assign-${t}" data-act="assign" rows="6" placeholder="1. Sales head: …&#10;2. Social media: …&#10;3. Events: …">${esc(tl.a)}</textarea>
    </section>
    <section class="card">
      <div class="card-head"><h2>Already fixed tomorrow</h2></div>
      <ul class="plain">${plan.map((p) => `<li><span class="tl-time">${fmtTime(p.time)}</span><span class="tl-dot c-${p.cat}"></span><span>${esc(names(p.text))}</span></li>`).join("") || "<li>Nothing fixed. A free day to fill.</li>"}</ul>
    </section>`;
  } else if (seg === "week") {
    const wk = Math.floor((parse(today()) - parse(ZONE_START)) / (7 * 864e5));
    const zone = ZONES[((wk % 4) + 4) % 4];
    body = `
    <p class="lede">Part 1 (9–11 am) is kept free of meetings every day. This week's zonal deep-dive: <b>${zone}</b>.</p>
    ${WEEK_MAP.map((r) => `<section class="card week">
      <h3>${r[0]}${r[0] === "Tue" ? ` <span class="tag">City day</span>` : ""}</h3>
      <dl>
        <div><dt>9–11</dt><dd>${esc(r[1])}</dd></div>
        <div><dt>11:30–1:30</dt><dd>${esc(r[2])}</dd></div>
        <div><dt>2:30–4:30</dt><dd>${esc(r[3])}</dd></div>
        <div><dt>5–6:30</dt><dd>${esc(r[4])}</dd></div>
      </dl></section>`).join("")}
    <section class="card week"><h3>Saturday &amp; Sunday</h3>
      <dl><div><dt>Sat</dt><dd>Walk with Poonam · 9–11 catch-up and signing · batch-record reels · afternoon is Poonam's time</dd></div>
      <div><dt>Sun</dt><dd>Book 2 hours · AI tutorial · rest and family · 5 pm plan the week</dd></div></dl></section>`;
  } else if (seg === "quarter") {
    body = `
    <p class="lede">Chapter meets are grouped by zone and month, so each trip covers several things. Every quarter: week 1 review with all heads, week 2 investor update, week 12 board meetings back to back.</p>
    ${QUARTER.map((q) => `<section class="card week"><h3>${q[0]}</h3><dl>
      <div><dt>Chapters</dt><dd>${esc(q[1])}</dd></div>
      <div><dt>Finance</dt><dd>${esc(q[2])}</dd></div>
      <div><dt>NGO</dt><dd>${esc(q[3])}</dd></div>
      <div><dt>1,000 goal</dt><dd>${esc(q[4])}</dd></div></dl></section>`).join("")}`;
  } else {
    body = `
    <p class="lede">Reports come to you on a fixed rhythm. Each one also appears as a task on the day it is due.</p>
    ${REPORTS.map((r) => `<section class="card week"><h3>${r[0]} <span class="muted">· ${r[1]}</span></h3>
      <p>${esc(r[2])}</p><p class="muted">From: ${esc(r[3])}</p></section>`).join("")}
    <section class="card"><h3>Daily flash format for every head</h3>
      <p>One WhatsApp message by 4:45 pm, five lines at most: today's number · done today · stuck on (decision needed: yes/no). If nothing is stuck, you don't reply.</p></section>`;
  }
  return `<header class="top"><div class="eyebrow">Plan</div><h1 class="h1-tight">Plans &amp; rhythm</h1></header>
    <div class="seg" role="tablist">${segs.map(([k, l]) => `<button role="tab" aria-selected="${seg === k}" data-act="planSeg" data-k="${k}">${l}</button>`).join("")}</div>
    ${body}`;
}

function viewDash() {
  const t = today();
  const days = Array.from({ length: 35 }, (_, i) => addDays(t, i - 34));
  const logged = days.filter((d) => S.logs[d]);
  const first = logged[0] || t;
  const last7 = days.slice(-7);
  const sc = score(t);
  const span7 = last7.filter((d) => d >= first);
  const avg7 = span7.length ? span7.reduce((a, d) => a + score(d).pct, 0) / span7.length : 0;
  const mustRate = (() => { let a = 0, b = 0; last7.forEach((d) => { const s = score(d); a += s.musts; b += s.mustTotal; }); return b ? a / b : 0; })();
  const habitStats = HABITS.map((h) => {
    const span = last7.filter((d) => d >= first);
    const n = span.filter((d) => S.logs[d]?.h?.[h.id]).length;
    return { h, n, of: span.length || 1, st: streak(h.id) };
  });
  const slipping = habitStats.filter((x) => x.of >= 3 && x.n / x.of < 0.5);
  const best = [...habitStats].sort((a, b) => b.st - a.st)[0];

  // 7-day bar chart
  const W = 320, H = 150, pl = 38, pb = 22, pt = 10, bw = (W - pl - 8) / 7;
  const bars = last7.map((d, i) => {
    const p = score(d).pct, h = (H - pb - pt) * p, x = pl + i * bw + bw * 0.18, y = H - pb - h;
    const lab = parse(d).toLocaleDateString("en-IN", { weekday: "narrow" });
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="3" class="${d === t ? "bar-today" : "bar"}"/>
      <text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle">${lab}</text>
      ${p > 0 ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 4).toFixed(1)}" class="val" text-anchor="middle">${Math.round(p * 100)}</text>` : ""}`;
  }).join("");
  const grid = [0, 0.5, 1].map((g) => { const y = H - pb - (H - pb - pt) * g; return `<line x1="${pl}" x2="${W - 4}" y1="${y}" y2="${y}" class="grid"/><text x="${pl - 6}" y="${y + 4}" class="axis" text-anchor="end">${g * 100}%</text>`; }).join("");

  // 5-week heat map
  const heat = days.map((d) => {
    const p = S.logs[d] ? score(d).pct : -1;
    const lvl = p < 0 ? 0 : p < 0.25 ? 1 : p < 0.5 ? 2 : p < 0.75 ? 3 : 4;
    return `<span class="heat h${lvl} ${d === t ? "is-today" : ""}" title="${fmtShort(d)}: ${p < 0 ? "no entries" : Math.round(p * 100) + "%"}"></span>`;
  }).join("");

  return `<header class="top"><div class="eyebrow">Dashboard</div><h1 class="h1-tight">How the days are going</h1></header>
  <div class="tiles">
    <div class="tile"><span class="tile-k">Today</span><span class="tile-v">${Math.round(sc.pct * 100)}%</span><span class="tile-s">${sc.done} of ${sc.total} done</span></div>
    <div class="tile"><span class="tile-k">7-day average</span><span class="tile-v">${Math.round(avg7 * 100)}%</span><span class="tile-s">habits + must-dos</span></div>
    <div class="tile"><span class="tile-k">Must-dos done</span><span class="tile-v">${Math.round(mustRate * 100)}%</span><span class="tile-s">last 7 days</span></div>
    <div class="tile"><span class="tile-k">Longest streak</span><span class="tile-v">${best && best.st ? best.st : 0}<small> ${best && best.st === 1 ? "day" : "days"}</small></span><span class="tile-s">${best && best.st ? esc(names(best.h.label)) : "Start one today"}</span></div>
  </div>

  <section class="card">
    <div class="card-head"><h2>Last 7 days</h2><span class="muted">% of habits and must-dos done</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily completion for the last 7 days">${grid}${bars}</svg></div>
  </section>

  ${slipping.length ? `<section class="card warn"><h2>Slipping this week</h2>
    <ul class="plain">${slipping.map((x) => `<li><b>${esc(names(x.h.label))}</b><span class="muted">done ${x.n} of ${x.of} days</span></li>`).join("")}</ul>
    <p class="muted">Set a reminder for these in More → Reminders, or move them to a time that suits you better.</p></section>` : ""}

  <section class="card">
    <div class="card-head"><h2>Habits this week</h2></div>
    <ul class="hbars">${habitStats.map((x) => `<li>
      <span class="hb-l">${esc(names(x.h.label))}</span>
      <span class="hb-track"><span class="hb-fill" style="width:${Math.round((x.n / x.of) * 100)}%"></span></span>
      <span class="hb-n">${x.n}/${x.of}</span>
      <span class="hb-s">${x.st ? x.st + "d" : ""}</span></li>`).join("")}</ul>
  </section>

  <section class="card">
    <div class="card-head"><h2>Last 5 weeks</h2><span class="muted">Darker is a fuller day</span></div>
    <div class="heatmap">${heat}</div>
    <div class="heat-legend"><span>None</span><span class="heat h1"></span><span class="heat h2"></span><span class="heat h3"></span><span class="heat h4"></span><span>Full</span></div>
  </section>`;
}

function viewMore() {
  const seg = S.moreSeg;
  const segs = [["reminders", "Reminders"], ["car", "Car list"], ["eighty", "80/20"], ["account", "Settings"]];
  let body = "";
  if (seg === "reminders") {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
    let pushBox;
    if (DEMO) pushBox = `<p class="muted">Reminders start working once the app is connected to Supabase (see the setup guide).</p>`;
    else if (!standalone && /iPhone|iPad/.test(navigator.userAgent)) pushBox = `<p><b>First add this app to your Home Screen.</b> In Safari tap Share → Add to Home Screen, then open it from the new icon and come back here.</p>`;
    else if (!supported) pushBox = `<p class="muted">This browser can't show notifications. On iPhone, use the Home Screen app.</p>`;
    else pushBox = `<div class="row-btns">
        <button class="btn" data-act="enablePush">${I.bell}<span>${perm === "granted" ? "Reconnect notifications" : "Turn on notifications"}</span></button>
        <button class="btn ghost" data-act="testPush">Send a test</button></div>
        <p class="muted">Status: ${perm === "granted" ? "notifications allowed" : perm === "denied" ? "blocked — allow them in iPhone Settings → Notifications → CEO Planner" : "not turned on yet"}</p>`;
    const dn = ["S", "M", "T", "W", "T", "F", "S"];
    body = `<section class="card">
      <div class="card-head"><h2>Do Not Disturb</h2>
        <button class="switch" data-act="toggleDnd" aria-pressed="${!!S.settings.dnd}" aria-label="Do Not Disturb"><span></span></button>
      </div>
      <p class="muted">When this is on, no task alerts, reminders or the in-app alarm go off — nothing arrives until you turn it off again.</p>
      ${S.settings.dnd ? `<div class="notice dnd">Do Not Disturb is on right now</div>` : ""}
    </section>
    <section class="card"><h2>Phone notifications</h2>${pushBox}</section>
    <section class="card">
      <div class="card-head"><h2>Your reminders</h2><button class="btn ghost" data-act="addRem">${I.plus}<span>Add</span></button></div>
      <p class="muted">India time. Tap a day letter to switch it on or off. Changes save by themselves.</p>
      <ul class="rems">${S.reminders.map((r) => `<li class="rem ${r.enabled ? "" : "off"}" data-id="${r.id}">
        <div class="rem-row">
          <input type="time" class="rem-time" id="rt-${r.id}" data-act="remField" data-f="time" value="${esc(r.time)}" aria-label="Time">
          <input class="rem-title" id="rti-${r.id}" data-act="remField" data-f="title" value="${esc(r.title)}" aria-label="Reminder title">
          <button class="switch" data-act="remToggle" aria-pressed="${r.enabled}" aria-label="Reminder on or off"><span></span></button>
        </div>
        <div class="rem-row">
          <div class="days">${dn.map((l, i) => `<button class="dayb ${r.days.includes(i) ? "on" : ""}" data-act="remDay" data-d="${i}" aria-pressed="${r.days.includes(i)}">${l}</button>`).join("")}</div>
          ${r.rule === "first_week" ? `<span class="tag">1st week only</span>` : ""}
          <button class="icon-btn small" data-act="remDel" aria-label="Delete reminder">${I.x}</button>
        </div>
      </li>`).join("")}</ul>
    </section>`;
  } else if (seg === "car") {
    body = `<section class="card">
      <h2>Car list</h2>
      <p class="muted">Anything that needs only your phone and your voice goes here, not into office hours.</p>
      <form class="addrow" data-form="car"><input id="carNew" placeholder="Add a call, voice note or idea…" aria-label="New car task"><button class="btn">${I.plus}<span>Add</span></button></form>
      <ul class="car">${S.car.map((c) => `<li class="${c.done ? "done" : ""}">
        <button class="tick small" data-act="carTick" data-id="${c.id}" aria-pressed="${c.done}" aria-label="Done">${I.check}</button>
        <span>${esc(c.text)}</span>
        <button class="icon-btn small" data-act="carDel" data-id="${c.id}" aria-label="Delete">${I.x}</button></li>`).join("") || `<li class="muted">Nothing yet. Add your next city-day calls here.</li>`}</ul>
    </section>
    <section class="card"><h2>Good uses of car time</h2><ul class="plain dots">${CAR_IDEAS.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="muted">Keep in-person meetings to one city day a week (Tuesday), and book 3–4 in the same part of town.</p></section>`;
  } else if (seg === "eighty") {
    body = `<p class="lede">These five kinds of work produce most of the results across MASA, Magical Mantras, MSME Times, the NGO and the hair-care startup. Protect time for them. Hand the rest to a named person.</p>
    <section class="card"><h2>Keep: only you can do this</h2><ul class="kv">${EIGHTY.keep.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join("")}</ul></section>
    <section class="card"><h2>Hand off</h2><ul class="kv">${EIGHTY.give.map(([a, b]) => `<li><b>${a}</b><span>→ ${b}</span></li>`).join("")}</ul></section>
    <section class="card"><h2>Staying present</h2><ul class="plain dots">${PRINCIPLES.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>`;
  } else {
    body = `<section class="card"><h2>Names</h2>
      <label class="field"><span>Your name on the Today screen</span><input id="set-name" data-act="setField" data-f="name" value="${esc(S.settings.name || "Pragya")}"></label>
      <label class="field"><span>First child (afternoon call)</span><input id="set-c1" data-act="setField" data-f="child1" value="${esc(S.settings.child1 || "")}" placeholder="Name"></label>
      <label class="field"><span>Second child (evening call)</span><input id="set-c2" data-act="setField" data-f="child2" value="${esc(S.settings.child2 || "")}" placeholder="Name"></label>
      <p class="muted">These names appear on the habits and in the call reminders.</p></section>
    <section class="card"><h2>Account</h2>
      <p class="muted">${DEMO ? "Demo mode: everything is saved in this browser only. Fill in config.js to connect your account." : "Signed in as " + esc(Store.user?.email)}</p>
      ${DEMO ? "" : `<button class="btn ghost" data-act="signOut">Sign out</button>`}</section>`;
  }
  return `<header class="top"><div class="eyebrow">More</div><h1 class="h1-tight">Tools &amp; settings</h1></header>
    <div class="seg" role="tablist">${segs.map(([k, l]) => `<button role="tab" aria-selected="${seg === k}" data-act="moreSeg" data-k="${k}">${l}</button>`).join("")}</div>${body}`;
}

function viewLogin(msg) {
  return `<div class="login">
    <div class="brandmark">MD</div>
    <h1>CEO Planner</h1>
    <p class="muted">Sign in with the email and password you created in Supabase.</p>
    <form data-form="login" class="login-form">
      <label class="field"><span>Email</span><input id="lg-email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password</span><input id="lg-pass" type="password" autocomplete="current-password" required></label>
      <button class="btn big">Sign in</button>
      ${msg ? `<p class="err">${esc(msg)}</p>` : ""}
    </form></div>`;
}

// ── Render ───────────────────────────────────────────────────
function render() {
  const root = document.getElementById("app");
  if (!Store.user) { root.innerHTML = viewLogin(); document.body.classList.add("no-tabs"); return; }
  document.body.classList.remove("no-tabs");
  const views = { today: viewToday, plan: viewPlan, dash: viewDash, more: viewMore };
  // keep focus when re-rendering while typing
  const a = document.activeElement; const fid = a && a.id; const sel = a && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
  root.innerHTML = views[S.tab]() + `<p id="status" class="status" aria-live="polite">${DEMO ? "Demo mode · saved on this device" : ""}</p>`;
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch {} } }
  document.querySelectorAll("textarea.must-in").forEach(grow);
  document.querySelectorAll(".tabbar button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
}

function grow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

// ── Data loading ─────────────────────────────────────────────
async function loadAll() {
  const t = today();
  const [logs, tasks, settings, rem, car] = await Promise.all([
    Store.getLogs(addDays(t, -40), addDays(t, 14)), Store.getTasks(addDays(t, -40), addDays(t, 14)),
    Store.getSettings(), Store.listReminders(), Store.listCar(),
  ]);
  S.logs = logs; S.tasks = tasks; S.settings = settings; S.reminders = rem; S.car = car;
}
async function ensureDay(d) {
  if (!S.logs[d]) { try { const got = await Store.getLogs(d, d); Object.assign(S.logs, got); } catch {} }
  if (!S.tasks[d]) { try { const got = await Store.getTasks(d, d); S.tasks[d] = got[d] || []; } catch {} }
}

// ── Events ───────────────────────────────────────────────────
document.addEventListener("click", async (e) => {
  const tabBtn = e.target.closest(".tabbar button");
  if (tabBtn) { S.tab = tabBtn.dataset.tab; LS.set("tab", S.tab); if (S.tab === "today") S.date = S.date || today(); render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest("[data-act]"); if (!el || el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
  const act = el.dataset.act; const d = S.date;
  try {
    if (act === "day") { S.date = addDays(S.date, +el.dataset.n); await ensureDay(S.date); render(); }
    else if (act === "gotoday") { S.date = today(); render(); }
    else if (act === "habit") { const l = logFor(d); l.h[el.dataset.id] = !l.h[el.dataset.id]; if (navigator.vibrate) navigator.vibrate(8); render(); queueSave(d); }
    else if (act === "task") { const l = logFor(d); l.k[el.dataset.id] = !l.k[el.dataset.id]; render(); queueSave(d); }
    else if (act === "must") {
      const l = logFor(d); if (!Array.isArray(l.m)) l.m = musts(d).list.map((x) => ({ ...x }));
      const i = +el.dataset.i; l.m[i] ||= { t: "", d: false }; l.m[i].d = !l.m[i].d; render(); queueSave(d);
    }
    else if (act === "planSeg") { S.planSeg = el.dataset.k; render(); }
    else if (act === "moreSeg") { S.moreSeg = el.dataset.k; render(); }
    else if (act === "carry") {
      const t = addDays(today(), 1); const l = logFor(t);
      if (!Array.isArray(l.m)) l.m = musts(t).list.map((x) => ({ ...x }));
      const txt = el.dataset.t; if (l.m.some((m) => m.t === txt)) return toast("Already on tomorrow's list");
      const empty = [0, 1, 2].find((i) => !l.m[i] || !l.m[i].t);
      if (empty === undefined) return toast("Tomorrow already has three. Replace one first.");
      l.m[empty] = { t: txt, d: false }; render(); queueSave(t); toast("Moved to tomorrow");
    }
    else if (act === "copyAssign") {
      const t = addDays(today(), 1); const txt = logFor(t).a || "";
      try { await navigator.clipboard.writeText(txt); toast("Copied — paste it in WhatsApp"); }
      catch { const ta = document.getElementById("assign-" + t); ta.select(); toast("Selected — tap Copy"); }
    }
    else if (act === "enablePush") await enablePush();
    else if (act === "testPush") { const r = await Store.testPush(); toast(r.sent ? "Test sent. It should arrive in a few seconds." : "No phone registered yet. Tap Turn on notifications first."); }
    else if (act === "addRem") { const r = await Store.saveReminder({ time: "10:00", title: "New reminder", body: "", days: [1, 2, 3, 4, 5], enabled: true }); S.reminders.push(r); render(); }
    else if (act === "remToggle" || act === "remDay" || act === "remDel") {
      const id = +el.closest(".rem").dataset.id; const r = S.reminders.find((x) => x.id === id);
      if (act === "remDel") { await Store.deleteReminder(id); S.reminders = S.reminders.filter((x) => x.id !== id); render(); toast("Reminder deleted"); return; }
      if (act === "remToggle") r.enabled = !r.enabled;
      else { const dd = +el.dataset.d; r.days = r.days.includes(dd) ? r.days.filter((x) => x !== dd) : [...r.days, dd].sort(); }
      render(); await Store.saveReminder(r); setStatus("Saved");
    }
    else if (act === "carTick") { const id = +el.dataset.id; const c = S.car.find((x) => x.id === id); c.done = !c.done; render(); await Store.updateCar(id, { done: c.done }); }
    else if (act === "carDel") { const id = +el.dataset.id; S.car = S.car.filter((x) => x.id !== id); render(); await Store.deleteCar(id); }
    else if (act === "toggleTaskForm") { S.taskFormOpen = !S.taskFormOpen; render(); }
    else if (act === "taskTick") {
      const id = +el.dataset.id; const t = (S.tasks[d] || []).find((x) => x.id === id); if (!t) return;
      t.done = !t.done; render(); await Store.updateTask(id, { done: t.done });
    }
    else if (act === "taskDel") {
      const id = +el.dataset.id; S.tasks[d] = (S.tasks[d] || []).filter((x) => x.id !== id);
      render(); await Store.deleteTask(id); toast("Task deleted");
    }
    else if (act === "toggleDnd") {
      S.settings.dnd = !S.settings.dnd; render();
      try { await Store.saveSettings(S.settings); setStatus("Saved"); } catch { setStatus("Not saved", true); }
    }
    else if (act === "signOut") { await Store.signOut(); render(); }
  } catch (err) { console.error(err); toast(err.message || "Something went wrong. Check your internet and try again."); }
});

const remTimers = {};
document.addEventListener("input", (e) => {
  const el = e.target; const act = el.dataset.act; if (!act) return;
  if (el.classList.contains("must-in")) grow(el);
  const d = S.date;
  if (act === "mustText") {
    const l = logFor(d); if (!Array.isArray(l.m)) l.m = musts(d).list.map((x) => ({ ...x }));
    const i = +el.dataset.i; l.m[i] ||= { t: "", d: false }; l.m[i].t = el.value; queueSave(d);
  } else if (act === "tmText") {
    const t = addDays(today(), 1); const l = logFor(t); if (!Array.isArray(l.m)) l.m = musts(t).list.map((x) => ({ ...x }));
    const i = +el.dataset.i; l.m[i] ||= { t: "", d: false }; l.m[i].t = el.value; queueSave(t);
  } else if (act === "assign") { const t = addDays(today(), 1); logFor(t).a = el.value; queueSave(t); }
  else if (act === "note") { const l = logFor(d); l.n[el.dataset.id] = el.value; queueSave(d); }
  else if (act === "setField") {
    S.settings[el.dataset.f] = el.value; clearTimeout(remTimers.set);
    remTimers.set = setTimeout(() => Store.saveSettings(S.settings).then(() => setStatus("Saved")).catch(() => setStatus("Not saved", true)), 600);
  } else if (act === "remField") {
    const id = +el.closest(".rem").dataset.id; const r = S.reminders.find((x) => x.id === id);
    r[el.dataset.f] = el.value; clearTimeout(remTimers[id]);
    remTimers[id] = setTimeout(() => Store.saveReminder(r).then(() => setStatus("Saved")).catch(() => setStatus("Not saved", true)), 700);
  }
});
// re-render the open-hour row once typing stops, so the tick appears
document.addEventListener("change", (e) => { if (e.target.dataset.act === "note") render(); });

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === "login") {
    try { await Store.signIn(document.getElementById("lg-email").value.trim(), document.getElementById("lg-pass").value); await loadAll(); render(); }
    catch (err) { document.getElementById("app").innerHTML = viewLogin("That email and password didn't match. Try again."); }
  } else if (f === "car") {
    const inp = document.getElementById("carNew"); const t = inp.value.trim(); if (!t) return;
    try { await Store.addCar(t); S.car = await Store.listCar(); inp.value = ""; render(); } catch (err) { toast("Not saved — check your internet"); }
  } else if (f === "task") {
    const titleEl = document.getElementById("taskTitle"); const dateEl = document.getElementById("taskDate"); const timeEl = document.getElementById("taskTime");
    const title = titleEl.value.trim(); const day = dateEl.value || S.date; const time = timeEl.value;
    if (!title || !time) return toast("Add a title and a deadline time");
    try {
      const t = await Store.addTask(day, time, title);
      (S.tasks[day] ||= []).push(t); S.tasks[day].sort((a, b) => a.time.localeCompare(b.time));
      S.taskFormOpen = false; render(); toast(day === S.date ? "Task added" : `Task added for ${fmtShort(day)}`);
    } catch (err) { toast("Not saved — check your internet"); }
  }
});

// ── Notifications ────────────────────────────────────────────
function b64ToBytes(b64) {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications weren't allowed. You can change this in iPhone Settings."); render(); return; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(CFG.VAPID_PUBLIC_KEY) });
  await Store.savePushSub(sub);
  toast("Notifications are on for this phone");
  render();
}

// ── In-app alarm for overdue tasks ────────────────────────────
const Alarm = { snoozeUntil: {}, activeId: null, beepTimer: null, actx: null };
function unlockAudio() {
  if (!Alarm.actx) { try { Alarm.actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (Alarm.actx && Alarm.actx.state === "suspended") Alarm.actx.resume().catch(() => {});
}
document.addEventListener("pointerdown", unlockAudio);
function beepOnce() {
  if (!Alarm.actx) return;
  const o = Alarm.actx.createOscillator(); const g = Alarm.actx.createGain();
  o.frequency.value = 880; o.connect(g); g.connect(Alarm.actx.destination);
  g.gain.setValueAtTime(0.001, Alarm.actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.35, Alarm.actx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, Alarm.actx.currentTime + 0.28);
  o.start(); o.stop(Alarm.actx.currentTime + 0.3);
}
function showAlarm(task) {
  if (Alarm.activeId) return;
  Alarm.activeId = task.id;
  unlockAudio(); beepOnce();
  Alarm.beepTimer = setInterval(beepOnce, 700);
  const ov = document.createElement("div");
  ov.className = "alarm-overlay"; ov.id = "alarmOverlay";
  ov.innerHTML = `
    <div class="alarm-box">
      <div class="alarm-eyebrow">Task overdue</div>
      <h1>${esc(task.title)}</h1>
      <p class="muted">Was due at ${fmtTime(task.time)}</p>
      <div class="alarm-btns">
        <button class="btn big" data-alarm="done">Mark done</button>
        <button class="btn ghost big" data-alarm="snooze">Snooze 5 min</button>
        <button class="linkish" data-alarm="dismiss">Dismiss</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-alarm]"); if (!b) return;
    const kind = b.dataset.alarm;
    if (kind === "done") {
      task.done = true; render();
      try { await Store.updateTask(task.id, { done: true }); } catch {}
    } else if (kind === "snooze") Alarm.snoozeUntil[task.id] = Date.now() + 5 * 60000;
    else Alarm.snoozeUntil[task.id] = Date.now() + 60000;
    hideAlarm();
  });
}
function hideAlarm() {
  clearInterval(Alarm.beepTimer); Alarm.beepTimer = null; Alarm.activeId = null;
  const ov = document.getElementById("alarmOverlay"); if (ov) ov.remove();
}
function checkAlarms() {
  if (!Store.user || S.settings.dnd || Alarm.activeId) return;
  const now = Date.now();
  for (const day of Object.keys(S.tasks)) {
    for (const t of S.tasks[day] || []) {
      if (t.done) continue;
      const until = Alarm.snoozeUntil[t.id]; if (until && now < until) continue;
      const deadline = new Date(`${day}T${t.time}:00`).getTime();
      if (now >= deadline) { showAlarm(t); return; }
    }
  }
}
setInterval(() => { if (document.visibilityState === "visible") checkAlarms(); }, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkAlarms(); });

// ── Start ────────────────────────────────────────────────────
(async function start() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try {
    await Store.init();
    if (Store.user) await loadAll();
  } catch (e) { console.error(e); toast("Couldn't load your data. Check your internet."); }
  render();
  checkAlarms();
  // new day at midnight / coming back to the app
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !Store.user) return;
    const t = today(); if (S.date < t && S.tab === "today") S.date = t;
    try { await loadAll(); } catch {}
    const a = document.activeElement; if (!a || !["INPUT", "TEXTAREA"].includes(a.tagName)) render();
  });
  // open a tab from a notification link
  const h = location.hash.slice(1); if (["today", "plan", "dash", "more"].includes(h)) { S.tab = h; render(); }
})();
