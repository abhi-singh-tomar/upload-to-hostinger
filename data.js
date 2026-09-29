// ─────────────────────────────────────────────────────────────
//  All the plan content lives here. Edit text freely.
//  Times are 24-hour, India time.
// ─────────────────────────────────────────────────────────────

const HABITS = [
  { id: "sadhana",   label: "Sadhana",          sub: "Chakra meditation · yoga nidra · Goraksha chalisa", time: "03:00" },
  { id: "selfcare",  label: "Self-care",        sub: "Pranayama · oil massage · eye & ear care · neem wash", time: "04:15" },
  { id: "exercise",  label: "Exercise",         sub: "Exercise / breathing · relaxation",                  time: "05:00" },
  { id: "assign",    label: "Assignments sent", sub: "7:15 to the MMPL office group",                      time: "07:15" },
  { id: "book",      label: "Book",             sub: "30 minutes of writing",                             time: "08:30" },
  { id: "reel",      label: "Reel posted",      sub: "MSME Times news reel",                              time: "11:00" },
  { id: "call1",     label: "Call {child1}",    sub: "After lunch",                                        time: "13:35" },
  { id: "walk",      label: "Walk",             sub: "15 minutes after lunch",                            time: "13:50" },
  { id: "ai",        label: "AI learning",      sub: "20 minutes, one tool",                              time: "16:30" },
  { id: "call2",     label: "Call {child2}",    sub: "Evening call",                                       time: "19:45" },
  { id: "music",     label: "Music practice",   sub: "20 minutes",                                         time: "20:00" },
  { id: "lights",    label: "Lights off by 9",  sub: "Foot care · eye pack · screens off",                 time: "21:00" },
];

// Categories used for colour coding
const CATS = {
  health: "Health & self", family: "Family", ceo: "CEO work", meet: "Meetings",
  ngo: "NGO", comp: "Compliance", report: "Reports", learn: "Learning", open: "Open hour", task: "Task",
};

// Zonal deep-dive rotation (week of 28 Sep 2026 = East)
const ZONES = ["East", "North", "West", "South"];
const ZONE_START = "2026-09-28";

// Weekday specifics for Part 1–4 (0 = Sunday … 6 = Saturday)
const WEEKDAY = {
  1: { p1: ["ceo", "Deep work: weekly priorities, investors & strategy"],
       p2: ["meet", "Functional heads huddle (5 min each: result, target, decision needed)", true],
       p3: ["open", ""],
       p4: ["report", "Weekly dashboard review: sales, memberships, franchise pipeline, events, collections"] },
  2: { p1: ["ceo", "City day: drive in, work the car list"],
       p2: ["meet", "All zonal heads + {zone} zone deep-dive", true],
       p3: ["meet", "In-person meetings: investors / sponsors / CA", true],
       p4: ["family", "Drive home: calls, rest, voice-note tomorrow's assignments"] },
  3: { p1: ["ceo", "Deep work: book / training content"],
       p2: ["meet", "Hiring interviews", true],
       p3: ["open", ""],
       p4: ["meet", "Team training"] },
  4: { p1: ["comp", "Deep work: agreements & compliance", true],
       p2: ["comp", "Finance head + CA/CS: 30-day compliance tracker for every company", true],
       p3: ["meet", "Marketing, social media & event planning heads"],
       p4: ["open", ""] },
  5: { p1: ["ceo", "Deep work: MSME Didi & Bhaiya programme"],
       p2: ["meet", "MSME Didi & Bhaiya training batch", true],
       p3: ["ngo", "NGO / Paribesh Bandhu: sponsors & partners", true],
       p4: ["ceo", "Hair-care startup weekly review + plan next week"] },
};

// Dates with their own plan or extra items. "musts" become the suggested top 3.
const SPECIAL = {
  "2026-09-26": { musts: ["Call CA/CS: status of each company (AGM, audit, tax audit, DIR KYC)",
                          "Investor agreements: list open points and email the lawyer",
                          "Paribesh Bandhu: shortlist top 20 sponsors"] },
  "2026-09-27": { musts: ["Book: 2 hours", "Plan the week, confirm Tuesday city meetings", "Record 2 reels ahead"] },
  "2026-09-28": { musts: ["Investor agreements: settle all open points with the lawyer",
                          "Sign board / AGM documents for each company",
                          "10 sponsor calls for Paribesh Bandhu"],
                  extra: [["09:00", "comp", "Lawyer call + final redlines on investor agreements"],
                          ["12:30", "comp", "Sign AGM / board documents sent by CS"]] },
  "2026-09-29": { musts: ["Sign investor agreements", "CA office: audited accounts + tax audit report cleared",
                          "2 sponsor meetings in person"],
                  extra: [["09:30", "comp", "Investor meeting: sign agreements"],
                          ["12:30", "comp", "CA office: sign financials, approve tax audit filing"]] },
  "2026-09-30": { musts: ["Deadline check with CA/CS, company by company",
                          "Get investor compliance list from CS (allotment, filings, dates)",
                          "Write the October plan around Puja"],
                  note: "Deadline day: AGMs and tax audit reports are due today. Confirm each company with your CA/CS." },
  "2026-10-02": { note: "Gandhi Jayanti holiday. Check which meetings still run." },
  "2026-10-05": { extra: [["14:30", "ngo", "Paribesh Bandhu: close all sponsors today"]] },
  "2026-10-10": { note: "Mahalaya", extra: [["09:00", "ngo", "Paribesh Bandhu: final briefing to pandal committees"]] },
  "2026-10-17": { note: "Maha Shashthi", puja: true },
  "2026-10-18": { note: "Maha Saptami", puja: true },
  "2026-10-19": { note: "Maha Ashtami", puja: true },
  "2026-10-20": { note: "Maha Navami", puja: true },
  "2026-10-21": { note: "Bijoya Dashami", puja: true },
  "2026-10-22": { extra: [["11:30", "meet", "Post-Puja restart: functional heads huddle"]] },
  "2026-10-25": { note: "Kojagari Lakshmi Puja" },
  "2026-10-26": { extra: [["14:30", "ngo", "Paribesh Bandhu: sponsor thank-you + impact report plan"]] },
  "2026-10-29": { extra: [["11:30", "comp", "Confirm tax-audit ITR due date with CA"]] },
  "2026-11-08": { note: "Diwali · Kali Puja" },
};

const WEEK_MAP = [
  ["Mon", "Deep work: priorities, investors & strategy (1st Monday: monthly reports)", "Functional heads huddle 11:30–12:30", "Open: sponsors, partners", "Weekly dashboard review 5:15"],
  ["Tue", "City day: drive in with the car list", "All zonal heads 11:30–12:30, then one zone in depth", "In person: investors, sponsors, CA", "Drive home: calls and rest"],
  ["Wed", "Deep work: book, training content", "Hiring interviews", "Open: networking calls", "Team training"],
  ["Thu", "Deep work: agreements & compliance", "Finance head + CA/CS", "Marketing, social media, events", "Open"],
  ["Fri", "Deep work: MSME Didi programme", "MSME Didi & Bhaiya training batch", "Paribesh Bandhu sponsors", "Hair-care startup review · plan next week"],
];

const QUARTER = [
  ["Oct 2026", "East chapters (Kolkata, WB). Few meetings in Puja week.", "September reports · tax-audit ITR filings · company filings after AGM", "Paribesh Bandhu: sponsors by 5 Oct · Mahalaya 10 Oct · Puja 17–21 Oct", "Plan the 2027 training calendar"],
  ["Nov 2026", "East & North-East chapter meets · Diwali 8 Nov", "Pending annual filings (confirm with CS)", "Awards report and sponsor thank-you pack", "2 training batches a month"],
  ["Dec 2026", "North chapters (Delhi NCR)", "Q3 review · board meetings in one day", "Plan the 2027 NGO calendar", "Year-end count"],
  ["Jan 2027", "West chapters (Mumbai, Gujarat)", "Q3 investor update", "Environment Champion Quiz, if running", "3 batches a month"],
  ["Feb 2027", "South chapters", "Budget and next-year plan per company", "—", "Certify 10 MSME Didis as trainers"],
  ["Mar 2027", "Chapter heads annual meet (all zones)", "Year-end closing · advance tax · audit prep", "Annual impact report", "Check against the 1,000 target"],
];

const REPORTS = [
  ["Daily", "5:00 pm", "Flash from each head: today's number, done, stuck", "Every functional & zonal head by 4:45 pm on WhatsApp"],
  ["Weekly", "Mon 5:15 pm", "Dashboard: sales, memberships, franchise pipeline, events, collections, social reach, hiring", "Strategy / MIS person"],
  ["Weekly", "Thu 11:30 am", "Compliance tracker: everything due in the next 30 days", "CA / CS"],
  ["Weekly", "Fri 5:15 pm", "Hair-care startup: orders, stock, cash", "Operations person"],
  ["Monthly", "1st Monday 9–11 am", "P&L per company, cash, receivables, chapter activity, NGO funds", "Finance head + each head"],
  ["Monthly", "Last Friday 5:15 pm", "Next month's targets · investor note if needed", "You"],
  ["Quarterly", "Week 1 of quarter", "Full review against targets · investor update", "All heads"],
];

const PRINCIPLES = [
  "One thing per block. In Part 1 the phone is face down.",
  "Before each meeting: one breath, one question — what do I want from this?",
  "Does this move investors, sponsors, chapters or the 1,000 goal? If not, delegate it.",
  "Under two minutes? Do it now. Otherwise, it goes on the list.",
  "In the car: 5 minutes with no phone, just the window.",
  "Top 3 first. Everything else is a bonus.",
  "Reply to the flash only when a decision is needed.",
];

const EIGHTY = {
  keep: [
    ["Money in", "Investors, sponsors, big franchise deals"],
    ["Relationships", "Networking, government and industry contacts"],
    ["Leaders", "Hiring and training heads. They train the rest"],
    ["Decisions & signatures", "Agreements, compliance, strategy"],
    ["Your voice", "The daily reel, anchoring, MSME Didi training"],
  ],
  give: [
    ["Event logistics, venue follow-ups", "Event planning head"],
    ["Posting, editing, captions", "Social media team"],
    ["Compiling reports", "Each head sends the daily flash"],
    ["Chapter admin and reminders", "Zonal heads"],
    ["NGO field work, pandal visits", "NGO team lead"],
    ["Accounts preparation", "Accountant and CA (you review and sign)"],
    ["Hair-care orders and stock", "One operations person"],
  ],
};

const CAR_IDEAS = [
  "Sponsor and zonal-head calls", "Voice-note assignments and feedback", "Dictate a book chapter with voice typing",
  "Reel script for tomorrow", "AI podcast or tutorial on earphones", "Listen to your music practice piece",
  "10 minutes of yoga nidra audio on the way home", "Call the children",
];

const DEFAULT_REMINDERS = [
  { time: "07:15", title: "Office assignments", body: "Send today's assignments to the MMPL group.", days: [1,2,3,4,5,6] },
  { time: "11:00", title: "MSME Times reel", body: "Pick one news item, script it, record.", days: [1,2,3,4,5,6] },
  { time: "13:35", title: "Call {child1}", body: "Your afternoon call.", days: [0,1,2,3,4,5,6] },
  { time: "16:30", title: "AI learning", body: "20 minutes, one tool.", days: [1,2,3,4,5] },
  { time: "17:00", title: "Daily flash", body: "Read the heads' flash reports. Reply only where a decision is needed.", days: [1,2,3,4,5] },
  { time: "17:15", title: "Weekly dashboard", body: "Review this week's dashboard.", days: [1] },
  { time: "09:00", title: "Monthly reports", body: "First Monday: review last month's reports.", days: [1], rule: "first_week" },
  { time: "11:30", title: "Compliance check", body: "30-day compliance tracker with finance and CA/CS.", days: [4] },
  { time: "18:15", title: "Plan tomorrow", body: "Write tomorrow's top 3 and draft the assignments.", days: [0,1,2,3,4,5,6] },
  { time: "19:45", title: "Call {child2}", body: "Your evening call.", days: [0,1,2,3,4,5,6] },
  { time: "20:00", title: "Music practice", body: "20 minutes.", days: [0,1,2,3,4,5,6] },
  { time: "20:45", title: "Wind down", body: "Foot care, eye pack, screens off.", days: [0,1,2,3,4,5,6] },
];

// ── Build the hour-by-hour plan for any date ─────────────────
function buildPlan(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const wd = d.getDay();
  const sp = SPECIAL[dateStr] || {};
  const r = (time, cat, text, star) => ({ time, cat, text, star: !!star });
  const morning = [
    r("03:00", "health", "Sadhana: chakra meditation + yoga nidra + Goraksha chalisa"),
    r("04:15", "health", "Pranayama · oil massage · eye & ear care · neem body wash"),
    r("05:00", "health", "Exercise / breathing · walking · relaxation"),
  ];
  const evening = [
    r("18:30", "family", "Dinner prep & family time"),
    r("19:45", "family", "Call {child2}"),
    r("20:00", "health", "Music practice 20 min"),
    r("20:30", "health", "Foot care + eye pack · screens off 8:45"),
    r("21:00", "health", "Lights off"),
  ];
  const lunch = [r("13:30", "family", "Lunch · call {child1} · 15-min walk")];
  let rows;

  if (sp.puja) {
    rows = [...morning,
      r("07:30", "family", "Food prep & family"),
      r("09:00", "ngo", "Paribesh Bandhu: pandal visits / judging / awards as per NGO plan", true),
      r("11:00", "ceo", "MSME Times reel: an eco-friendly pandal story"),
      r("12:00", "open", ""), ...lunch,
      r("14:30", "family", "Puja with family"),
      r("17:00", "report", "Daily flash (reply only if urgent)"), ...evening];
  } else if (wd === 6) {
    rows = [...morning,
      r("06:00", "family", "Long walk with Poonam"),
      r("07:30", "family", "Breakfast together, no phones"),
      r("09:00", "ceo", "Catch-up on the week, sign documents"),
      r("11:00", "ceo", "Batch-record reels for Sunday and Monday"),
      r("12:00", "open", ""), ...lunch,
      r("14:30", "family", "Poonam's time: studies, an outing, rest"),
      r("16:30", "open", ""), ...evening];
  } else if (wd === 0) {
    rows = [...morning,
      r("06:00", "family", "Slow morning, cooking together"),
      r("09:00", "ceo", "Book writing, 2 hours", true),
      r("11:00", "learn", "AI learning: one longer tutorial"),
      r("11:30", "open", ""), ...lunch,
      r("14:30", "family", "Rest, visits, Poonam's week ahead"),
      r("17:00", "ceo", "Plan the week: top 3 goals, fill open hours", true), ...evening];
  } else {
    const w = WEEKDAY[wd];
    let p1 = w.p1;
    if (wd === 1 && d.getDate() <= 7) p1 = ["report", "Monthly reports review: P&L per company, cash, receivables, chapters, NGO funds", true];
    let p4 = w.p4;
    if (wd === 5 && new Date(d.getTime() + 7 * 864e5).getMonth() !== d.getMonth())
      p4 = ["ceo", "Month-end: next month's targets · investor note if needed · hair-care review"];
    const wk = Math.floor((d - new Date(ZONE_START + "T00:00:00")) / (7 * 864e5));
    const zone = ZONES[((wk % 4) + 4) % 4];
    const fill = (x) => r(null, x[0], (x[1] || "").replace("{zone}", zone), x[2]);
    const at = (t, x) => Object.assign(fill(x), { time: t });
    rows = [...morning,
      r("06:00", "family", "School run: Poonam"),
      r("07:15", "ceo", "Send daily assignments to the MMPL office group"),
      r("07:30", "family", "Food prep"),
      r("08:30", "ceo", "Book writing, 30 min"),
      at("09:00", p1),
      r("11:00", "ceo", "MSME Times reel: script, record, send to editor"),
      at("11:30", w.p2),
      r("12:30", "open", ""), ...lunch,
      at("14:30", w.p3),
      r("15:30", "open", ""),
      r("16:30", "learn", "Tea + AI learning 20 min"),
      r("17:00", "report", "Read the daily flash from each head"),
      at("17:15", p4),
      r("18:15", "ceo", "Write tomorrow's top 3 + draft the 7:15 assignments"), ...evening];
  }
  (sp.extra || []).forEach(([t, c, x]) => {
    const i = rows.findIndex((row) => row.time === t && row.cat !== "health");
    if (i >= 0) rows[i] = r(t, c, x, true); else rows.push(r(t, c, x, true));
  });
  rows.sort((a, b) => a.time.localeCompare(b.time));
  // stable ids: time + position within the same time
  const seen = {};
  rows.forEach((row) => { seen[row.time] = (seen[row.time] || 0) + 1; row.id = row.time.replace(":", "") + "-" + seen[row.time]; });
  return rows;
}

function suggestedMusts(dateStr) {
  const sp = SPECIAL[dateStr];
  if (sp && sp.musts) return sp.musts.slice(0, 3);
  return buildPlan(dateStr).filter((x) => x.star && x.text).map((x) => x.text).slice(0, 3);
}
