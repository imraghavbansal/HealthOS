export const user = {
  name: "Alex Morgan",
  initials: "AM",
  age: 34,
  sex: "Female",
  healthScore: 87,
  scoreDelta: +3,
  lastSync: "2 min ago",
};

export const insights = [
  { id: 1, title: "Vitamin D trending low", body: "Your last 3 panels show a downward trend. Consider 15 min of morning sun or ask your PCP about supplementation.", severity: "warning" as const },
  { id: 2, title: "Excellent recovery streak", body: "HRV averaged 68ms this week — 12% above your 90-day baseline.", severity: "success" as const },
  { id: 3, title: "Sleep debt building", body: "You're ~3h 20m short vs. your 8h goal over the last 5 nights.", severity: "info" as const },
];

export const sleepData = [
  { day: "Mon", hours: 7.2, deep: 1.4 },
  { day: "Tue", hours: 6.5, deep: 1.1 },
  { day: "Wed", hours: 8.1, deep: 1.8 },
  { day: "Thu", hours: 6.9, deep: 1.3 },
  { day: "Fri", hours: 7.4, deep: 1.5 },
  { day: "Sat", hours: 8.3, deep: 1.9 },
  { day: "Sun", hours: 7.8, deep: 1.7 },
];

export const activityData = [
  { day: "Mon", steps: 8420, cal: 2180 },
  { day: "Tue", steps: 11200, cal: 2410 },
  { day: "Wed", steps: 6100, cal: 1980 },
  { day: "Thu", steps: 9800, cal: 2290 },
  { day: "Fri", steps: 12600, cal: 2530 },
  { day: "Sat", steps: 14300, cal: 2680 },
  { day: "Sun", steps: 7200, cal: 2050 },
];

export const labMarkers = [
  { name: "Vitamin D", value: 24, unit: "ng/mL", range: "30–100", status: "low" as const, delta: -6 },
  { name: "HbA1c", value: 5.2, unit: "%", range: "<5.7", status: "normal" as const, delta: -0.1 },
  { name: "LDL Cholesterol", value: 118, unit: "mg/dL", range: "<100", status: "high" as const, delta: +4 },
  { name: "HDL", value: 62, unit: "mg/dL", range: ">40", status: "normal" as const, delta: +2 },
  { name: "TSH", value: 2.1, unit: "mIU/L", range: "0.4–4.0", status: "normal" as const, delta: 0 },
  { name: "Ferritin", value: 45, unit: "ng/mL", range: "15–150", status: "normal" as const, delta: -8 },
];

export const labTrend = [
  { month: "Jan", value: 32 }, { month: "Mar", value: 29 }, { month: "May", value: 28 },
  { month: "Jul", value: 26 }, { month: "Sep", value: 25 }, { month: "Nov", value: 24 },
];

export const ldlTrend = [
  { month: "Jan", value: 128 }, { month: "Mar", value: 124 }, { month: "May", value: 122 },
  { month: "Jul", value: 120 }, { month: "Sep", value: 119 }, { month: "Nov", value: 118 },
];

export const records = [
  { id: "r1", type: "Lab Report", title: "Complete Blood Panel", provider: "Quest Diagnostics", date: "Nov 12, 2026", tag: "Labs" },
  { id: "r2", type: "Imaging", title: "Chest X-Ray", provider: "Mercy Radiology", date: "Oct 04, 2026", tag: "Imaging" },
  { id: "r3", type: "Prescription", title: "Vitamin D3 5000 IU", provider: "Dr. Patel", date: "Sep 28, 2026", tag: "Rx" },
  { id: "r4", type: "Visit Summary", title: "Annual Physical", provider: "One Medical", date: "Sep 21, 2026", tag: "Visit" },
  { id: "r5", type: "Lab Report", title: "Lipid Panel", provider: "LabCorp", date: "Aug 15, 2026", tag: "Labs" },
  { id: "r6", type: "Vaccination", title: "Influenza Vaccine", provider: "CVS Pharmacy", date: "Aug 02, 2026", tag: "Vax" },
];

export const wearables = [
  { name: "Apple Health", desc: "iPhone + Apple Watch Series 10", connected: true, last: "2 min ago", color: "from-slate-500 to-slate-700" },
  { name: "Google Health Connect", desc: "Pixel Watch, Fitbit sync", connected: true, last: "18 min ago", color: "from-blue-500 to-teal-500" },
  { name: "Garmin", desc: "Fenix 8, cycling + sleep", connected: false, last: "—", color: "from-cyan-600 to-blue-700" },
  { name: "Fitbit", desc: "Charge 6", connected: true, last: "1 hr ago", color: "from-teal-500 to-emerald-600" },
  { name: "WHOOP", desc: "Strain, recovery, HRV", connected: false, last: "—", color: "from-zinc-700 to-zinc-900" },
  { name: "Oura Ring", desc: "Sleep & readiness", connected: false, last: "—", color: "from-indigo-500 to-purple-600" },
];

export const medications = [
  { id: "m1", name: "Vitamin D3", dose: "5000 IU", schedule: "Daily · 8:00 AM", adherence: 94, next: "Tomorrow, 8:00 AM", type: "Supplement" },
  { id: "m2", name: "Omega-3", dose: "1000 mg", schedule: "Daily · 8:00 AM", adherence: 88, next: "Tomorrow, 8:00 AM", type: "Supplement" },
  { id: "m3", name: "Magnesium Glycinate", dose: "400 mg", schedule: "Nightly · 10:00 PM", adherence: 91, next: "Tonight, 10:00 PM", type: "Supplement" },
  { id: "m4", name: "Levothyroxine", dose: "50 mcg", schedule: "Daily · 7:00 AM", adherence: 97, next: "Tomorrow, 7:00 AM", type: "Prescription" },
];

export const goals = [
  { id: "g1", title: "Sleep 8 hours nightly", progress: 78, category: "Sleep", streak: 12 },
  { id: "g2", title: "10,000 steps daily", progress: 92, category: "Activity", streak: 24 },
  { id: "g3", title: "LDL below 100 mg/dL", progress: 45, category: "Labs", streak: 0 },
  { id: "g4", title: "Vitamin D to 40+ ng/mL", progress: 30, category: "Labs", streak: 0 },
  { id: "g5", title: "Strength train 3×/week", progress: 66, category: "Exercise", streak: 6 },
  { id: "g6", title: "Protein 120g/day", progress: 84, category: "Nutrition", streak: 9 },
];

export const familyHistory = [
  { relation: "Father", conditions: ["Type 2 Diabetes", "Hypertension"], age: 68 },
  { relation: "Mother", conditions: ["Hypothyroidism"], age: 65 },
  { relation: "Paternal grandfather", conditions: ["Coronary artery disease"], age: 82 },
  { relation: "Maternal grandmother", conditions: ["Breast cancer (stage II)"], age: 74 },
  { relation: "Sister", conditions: ["None reported"], age: 31 },
];

export const risks = [
  { name: "Cardiovascular disease", level: "Moderate", pct: 42, note: "LDL trending high + paternal CAD history", action: "Discuss lipid panel with PCP; Mediterranean-style diet." },
  { name: "Type 2 Diabetes", level: "Low", pct: 18, note: "Normal HbA1c, but paternal T2D warrants annual screening.", action: "Continue annual A1c; maintain fiber intake." },
  { name: "Hypothyroidism", level: "Moderate", pct: 38, note: "Maternal history + you already take levothyroxine.", action: "Continue TSH monitoring every 6 months." },
  { name: "Breast cancer", level: "Elevated", pct: 24, note: "Maternal grandmother diagnosis at 74.", action: "Discuss earlier baseline mammography with your PCP." },
];

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; date: string }[];
};

export const seedChat: ChatMessage[] = [
  { id: "c1", role: "assistant", content: "Hi Alex — I've reviewed your latest records. Ask me anything about your labs, medications, or trends. I'll cite the exact reports I'm drawing from." },
  { id: "c2", role: "user", content: "Why did my LDL go up this year?" },
  {
    id: "c3",
    role: "assistant",
    content: "Your LDL rose from 108 mg/dL (Jan) to 118 mg/dL (Nov) — a ~9% increase. Two signals in your data align with that shift: your average weekly cardio dropped from 4.1 to 2.8 sessions between Q2 and Q3, and your logged saturated fat intake ticked up during a 6-week travel period in July–August. Genetics likely play a role too given your paternal history of coronary artery disease.\n\nThis is informational, not medical advice — please review with your PCP.",
    citations: [
      { title: "Lipid Panel — LabCorp", date: "Aug 15, 2026" },
      { title: "Complete Blood Panel — Quest", date: "Nov 12, 2026" },
      { title: "Family History — Paternal", date: "Onboarding" },
    ],
  },
];
