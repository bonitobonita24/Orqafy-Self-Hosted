/**
 * Orqafy-Self-Hosted — Phase 2.8 Visual-Verification Mockup
 * ---------------------------------------------------------
 * ONE self-contained React component for OWNER VISUAL REVIEW ONLY. Not production code,
 * not scaffolding — a clickable interpretation of docs/PRODUCT.md + docs/DESIGN.md so the
 * owner can confirm the build matches their mental model before Phase 3/4.
 *
 * HOW TO PREVIEW: drop into any React sandbox with Tailwind available (Vite + Tailwind CDN,
 * CodeSandbox, etc.) and render <OrqafyMockup />. The design tokens (DESIGN.md §2 HSL values)
 * are defined as CSS variables in the <style> block below, so brand colors render even if a
 * Tailwind utility for a token name is absent. No routing library, no data fetching, no build
 * assumptions beyond React + Tailwind for layout utilities.
 *
 * SCREENS (DESIGN.md §7): Dashboard · Projects list (paginated) · Project board (kanban) ·
 * Task detail (location + radius + geofence schedule = the differentiator) · My Tasks (mobile) ·
 * Geofence alert (mobile, the one assertive amber treatment) · Files + document review tray ·
 * Apply-for-leave + Leave approvals · Users/Roles permission builder.
 *
 * data-loading-path contract (Phase 4 Part 5): every distinct component wrapper is tagged
 * "shadcn" (Card/Table/Form/Badge/Button compositions) or "custom" (Leaflet map placeholder,
 * kanban board, bespoke viz).
 */

import React, { useState } from "react";

/* ============================================================================
   DUMMY DATA — realistic PH construction firm (Calapan City, Oriental Mindoro)
   Cross-referenced: same project codes / people / sites across every screen.
   ============================================================================ */

const ORG = "Mindoro Builders & Structural Design Co.";

const CLIENTS = {
  C1: "Oriental Mindoro Provincial Government",
  C2: "Calapan City Water District",
  C3: "Golden Harvest Agri-Ventures Inc.",
  C4: "St. Augustine Parish — Calapan",
  C5: "Ramirez Property Holdings",
  C6: "Puerto Galera Beach Resort Group",
  C7: "Naujan Lake Agri Corp.",
};

const STAFF = {
  U1: { name: "Bonifacio Reyes", role: "Owner / Admin", initials: "BR" },
  U2: { name: "Engr. Reynaldo Mercado", role: "Project Manager", initials: "RM" },
  U3: { name: "Arch. Divina Salazar", role: "Project Manager", initials: "DS" },
  U4: { name: "Engr. Marlon Villanueva", role: "Project Manager", initials: "MV" },
  U5: { name: "Joselito Bautista", role: "Site Staff", initials: "JB" },
  U6: { name: "Ramon Dizon", role: "Site Staff", initials: "RD" },
  U7: { name: "Melanie Cruz", role: "Site Staff", initials: "MC" },
  U8: { name: "Arnel Panganiban", role: "Site Staff", initials: "AP" },
  U9: { name: "Cristina Aquino", role: "Accountant", initials: "CA" },
  U10: { name: "Grace Fabella", role: "Office Admin", initials: "GF" },
};

// 18 projects → pagination shows "1–10 of 18". Peso contract values.
const PROJECTS = [
  { code: "PRJ-2026-014", name: "Calapan City Public Market Rehabilitation", client: "C1", status: "active", pct: 62, pm: "U2", site: "Guinobatan, Calapan City", value: 48250000, end: "2026-12-20" },
  { code: "PRJ-2026-008", name: "Naujan Municipal Hall Annex", client: "C1", status: "active", pct: 41, pm: "U4", site: "Bancuro, Naujan", value: 22100000, end: "2027-02-15" },
  { code: "PRJ-2026-021", name: "Golden Harvest Rice Mill Warehouse", client: "C3", status: "active", pct: 28, pm: "U2", site: "Victoria, Or. Mindoro", value: 17800000, end: "2027-01-30" },
  { code: "PRJ-2026-005", name: "St. Augustine Belfry Restoration", client: "C4", status: "active", pct: 78, pm: "U3", site: "Ibaba East, Calapan City", value: 6450000, end: "2026-10-28" },
  { code: "PRJ-2026-017", name: "Ramirez Residence — San Vicente", client: "C5", status: "active", pct: 55, pm: "U3", site: "San Vicente Central, Calapan City", value: 9350000, end: "2026-11-30" },
  { code: "PRJ-2026-019", name: "Puerto Galera Shoreline Boardwalk Ph. 2", client: "C6", status: "on-hold", pct: 33, pm: "U4", site: "Sabang, Puerto Galera", value: 14600000, end: "2027-03-31" },
  { code: "PRJ-2026-003", name: "Water District Reservoir Retrofit", client: "C2", status: "active", pct: 70, pm: "U2", site: "Camilmil, Calapan City", value: 12750000, end: "2026-11-15" },
  { code: "PRJ-2026-011", name: "Naujan Lake Fish Landing & Cold Storage", client: "C7", status: "active", pct: 47, pm: "U4", site: "Naujan Lakeshore", value: 19900000, end: "2027-02-28" },
  { code: "PRJ-2026-023", name: "Golden Harvest Corn Drying Pavement", client: "C3", status: "planning", pct: 8, pm: "U2", site: "Socorro, Or. Mindoro", value: 4200000, end: "2027-04-15" },
  { code: "PRJ-2026-002", name: "Provincial Sports Complex Grandstand", client: "C1", status: "active", pct: 88, pm: "U3", site: "Camilmil, Calapan City", value: 33400000, end: "2026-10-10" },
  { code: "PRJ-2026-016", name: "Ramirez Commercial Building — Lalud", client: "C5", status: "active", pct: 22, pm: "U4", site: "Lalud, Calapan City", value: 27300000, end: "2027-05-20" },
  { code: "PRJ-2026-009", name: "Calapan Drainage Improvement Pkg. 3", client: "C2", status: "active", pct: 51, pm: "U2", site: "Sta. Isabel, Calapan City", value: 15600000, end: "2026-12-05" },
  { code: "PRJ-2026-025", name: "Puerto Galera Staff Housing", client: "C6", status: "planning", pct: 5, pm: "U3", site: "Sabang, Puerto Galera", value: 8900000, end: "2027-06-30" },
  { code: "PRJ-2026-007", name: "Parish Multi-Purpose Hall", client: "C4", status: "completed", pct: 100, pm: "U3", site: "Ibaba East, Calapan City", value: 7250000, end: "2026-06-28" },
  { code: "PRJ-2026-012", name: "Farm-to-Market Road Slope Protection", client: "C7", status: "active", pct: 64, pm: "U4", site: "Naujan", value: 11400000, end: "2026-11-22" },
  { code: "PRJ-2026-020", name: "Provincial Capitol Roof Replacement", client: "C1", status: "on-hold", pct: 37, pm: "U2", site: "Camilmil, Calapan City", value: 9800000, end: "2027-01-18" },
  { code: "PRJ-2026-018", name: "Warehouse Perimeter Fence", client: "C3", status: "completed", pct: 100, pm: "U4", site: "Victoria, Or. Mindoro", value: 3650000, end: "2026-05-30" },
  { code: "PRJ-2026-026", name: "Public Market Stalls Fit-out", client: "C1", status: "planning", pct: 3, pm: "U3", site: "Guinobatan, Calapan City", value: 5100000, end: "2027-07-10" },
];

// Kanban tasks for PRJ-2026-014 (Calapan City Public Market Rehabilitation)
const BOARD = {
  todo: [
    { id: "T-1042", title: "Pour column footings — Grid C", assignee: "U5", priority: "High", due: "2026-09-18", geofenced: true },
    { id: "T-1048", title: "Deliver & tag rebar batch 3", assignee: "U6", priority: "Medium", due: "2026-09-16", geofenced: false },
    { id: "T-1051", title: "Formworks for slab-on-grade — Bay 4", assignee: "U8", priority: "Medium", due: "2026-09-22", geofenced: true },
  ],
  "in-progress": [
    { id: "T-1039", title: "Structural steel erection — Bay 2", assignee: "U5", priority: "High", due: "2026-09-18", geofenced: true },
    { id: "T-1044", title: "Electrical rough-in — ground floor", assignee: "U6", priority: "Medium", due: "2026-09-25", geofenced: false },
  ],
  blocked: [
    { id: "T-1036", title: "Roofing installation — awaiting truss delivery", assignee: "U7", priority: "High", due: "2026-09-20", geofenced: false },
  ],
  done: [
    { id: "T-1012", title: "Site clearing & staking", assignee: "U5", priority: "Medium", due: "2026-08-12", geofenced: false },
    { id: "T-1019", title: "Excavation for footings", assignee: "U8", priority: "Medium", due: "2026-08-28", geofenced: false },
    { id: "T-1027", title: "Backfill & compaction — Zone A", assignee: "U6", priority: "Low", due: "2026-09-04", geofenced: false },
  ],
};

// My Tasks — Joselito Bautista (U5), across sites
const MY_TASKS = [
  { id: "T-1039", title: "Structural steel erection — Bay 2", proj: "PRJ-2026-014", site: "Calapan Public Market", due: "Today", state: "in-progress", geofenced: true },
  { id: "T-1042", title: "Pour column footings — Grid C", proj: "PRJ-2026-014", site: "Calapan Public Market", due: "Sep 18", state: "todo", geofenced: true },
  { id: "T-0988", title: "Concrete slump test — Reservoir wall", proj: "PRJ-2026-003", site: "Camilmil Reservoir", due: "Sep 4 · overdue", state: "blocked", geofenced: true },
  { id: "T-0951", title: "Grandstand column staking", proj: "PRJ-2026-002", site: "Sports Complex", due: "Aug 30", state: "done", geofenced: false },
];

// Document review tray
const REVIEW = [
  { file: "SO-Invoice-2298.pdf", type: "PDF", client: "Golden Harvest Agri-Ventures Inc.", proj: "PRJ-2026-021", category: "invoice", confidence: 94, spi: false },
  { file: "DR-CalapanHardware-01187.jpg", type: "IMG", client: "Calapan City Water District", proj: "PRJ-2026-003", category: "receipt", confidence: 71, spi: false },
  { file: "payslip-2026-08-Bautista.pdf", type: "PDF", client: "—", proj: "—", category: "payroll (SPI)", confidence: 88, spi: true },
  { file: "scan_0442.pdf", type: "PDF", client: "—", proj: "—", category: "unsorted — no confident match", confidence: 39, spi: false },
];

const FILE_ROWS = [
  { name: "Structural-Drawings-RevC.pdf", cat: "drawing", size: "8.4 MB", by: "U3", when: "Sep 5" },
  { name: "Bldg-Permit-2026-0417.pdf", cat: "permit", size: "1.1 MB", by: "U10", when: "Sep 3" },
  { name: "SO-Invoice-2288.pdf", cat: "invoice", size: "240 KB", by: "U9", when: "Sep 2" },
  { name: "SiteProgress-Bay2-0906.jpg", cat: "photo", size: "3.7 MB", by: "U5", when: "Sep 6" },
  { name: "PO-Steel-Batch3.pdf", cat: "PO", size: "180 KB", by: "U9", when: "Aug 30" },
];

// Leave approvals (approver view)
const LEAVE_PENDING = [
  { who: "U6", type: "Sick", from: "Sep 9", to: "Sep 10", days: 2, flag: null },
  { who: "U7", type: "Vacation", from: "Sep 22", to: "Sep 26", days: 5, flag: "Overlaps 1 approved leave" },
  { who: "U8", type: "Emergency", from: "Sep 8", to: "Sep 8", days: 1, flag: null },
];
const LEAVE_DECIDED = [
  { who: "U6", type: "Vacation", from: "Aug 18", to: "Aug 20", days: 3, state: "approved", by: "U2" },
  { who: "U7", type: "Sick", from: "Aug 25", to: "Aug 25", days: 1, state: "approved", by: "U2" },
  { who: "U8", type: "Vacation", from: "Sep 1", to: "Sep 5", days: 5, state: "rejected", by: "U4" },
];

// Permission builder
const PERMISSIONS = [
  { key: "manage_users", label: "Manage users" },
  { key: "create_project", label: "Create projects" },
  { key: "view_finances", label: "View finances" },
  { key: "manage_finances", label: "Manage finances" },
  { key: "approve_leave", label: "Approve leave" },
  { key: "manage_files", label: "Manage files" },
  { key: "view_all_projects", label: "View all projects" },
];
const GROUPS = [
  { name: "Finance Viewers", members: 3, perms: ["view_finances"] },
  { name: "Leave Approvers", members: 4, perms: ["approve_leave"] },
  { name: "Senior Engineers", members: 2, perms: ["create_project", "view_all_projects", "manage_files"] },
];
// initial per-user grant matrix
const USER_MATRIX = {
  U1: { manage_users: true, create_project: true, view_finances: true, manage_finances: true, approve_leave: true, manage_files: true, view_all_projects: true },
  U2: { manage_users: false, create_project: true, view_finances: true, manage_finances: false, approve_leave: true, manage_files: true, view_all_projects: true },
  U3: { manage_users: false, create_project: true, view_finances: false, manage_finances: false, approve_leave: true, manage_files: true, view_all_projects: false },
  U4: { manage_users: false, create_project: true, view_finances: true, manage_finances: false, approve_leave: false, manage_files: true, view_all_projects: true },
  U5: { manage_users: false, create_project: false, view_finances: false, manage_finances: false, approve_leave: false, manage_files: false, view_all_projects: false },
  U9: { manage_users: false, create_project: false, view_finances: true, manage_finances: true, approve_leave: false, manage_files: false, view_all_projects: false },
};

const peso = (n) => "₱" + n.toLocaleString("en-PH");

/* ============================================================================
   TOKEN / PRIMITIVE STYLING  (DESIGN.md §2 semantic colors)
   ============================================================================ */

// soft status badge tones → { background, color } from CSS variables
const TONE = {
  todo: { bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))" },
  "in-progress": { bg: "hsl(var(--primary) / 0.12)", fg: "hsl(var(--primary))" },
  blocked: { bg: "hsl(var(--destructive) / 0.12)", fg: "hsl(var(--destructive))" },
  done: { bg: "hsl(var(--success) / 0.14)", fg: "hsl(var(--success))" },
  active: { bg: "hsl(var(--primary) / 0.12)", fg: "hsl(var(--primary))" },
  planning: { bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))" },
  "on-hold": { bg: "hsl(var(--warning) / 0.16)", fg: "hsl(38 92% 34%)" },
  completed: { bg: "hsl(var(--success) / 0.14)", fg: "hsl(var(--success))" },
  pending: { bg: "hsl(var(--warning) / 0.16)", fg: "hsl(38 92% 34%)" },
  approved: { bg: "hsl(var(--success) / 0.14)", fg: "hsl(var(--success))" },
  rejected: { bg: "hsl(var(--destructive) / 0.12)", fg: "hsl(var(--destructive))" },
};

const Badge = ({ tone = "todo", children }) => {
  const t = TONE[tone] || TONE.todo;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={{ background: t.bg, color: t.fg }}
    >
      {children || tone}
    </span>
  );
};

const Avatar = ({ id, size = 32 }) => (
  <span
    className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
    style={{
      width: size, height: size, fontSize: size * 0.36,
      background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))",
    }}
    title={STAFF[id]?.name}
  >
    {STAFF[id]?.initials || "?"}
  </span>
);

const Card = ({ children, className = "", path = "shadcn", style }) => (
  <div data-loading-path={path} className={"card " + className} style={style}>
    {children}
  </div>
);

const Btn = ({ children, variant = "primary", className = "", ...rest }) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-9 px-4 transition-colors";
  const styles = {
    primary: { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" },
    outline: { background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" },
    ghost: { background: "transparent", color: "hsl(var(--muted-foreground))" },
    destructive: { background: "hsl(var(--destructive))", color: "#fff" },
  };
  return (
    <button className={base + " " + className} style={styles[variant]} {...rest}>
      {children}
    </button>
  );
};

const SectionTitle = ({ title, sub, action }) => (
  <div className="flex items-end justify-between gap-4 mb-4">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>{title}</h2>
      {sub && <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</p>}
    </div>
    {action}
  </div>
);

// tiny inline lucide-style icons (stroke) so no icon dependency is needed for the mockup
const Icon = ({ d, size = 18, fill = "none", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const I = {
  dash: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  file: "M14 3v5h5M6 3h9l4 4v14H6V3Z",
  leave: "M8 2v3M16 2v3M4 8h16M4 6h16v14H4z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11",
  search: "M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0",
  pin: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  chevR: "M9 18l6-6-6-6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
};

/* ============================================================================
   THEME <style>  — DESIGN.md §2 tokens as CSS variables + shadcn-like helpers
   ============================================================================ */

const ThemeStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    :root{
      --background:222 20% 99%; --foreground:222 47% 11%;
      --card:0 0% 100%; --card-foreground:222 47% 11%;
      --muted:215 28% 95%; --muted-foreground:215 16% 42%;
      --border:215 20% 88%; --input:215 20% 88%;
      --primary:215 70% 42%; --primary-foreground:210 40% 98%;
      --accent:38 92% 50%; --accent-foreground:222 47% 11%;
      --destructive:0 72% 51%; --success:142 60% 38%; --warning:38 92% 50%;
      --ring:215 70% 42%; --radius:0.625rem;
    }
    .orqafy-root{
      font-family:'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
      color:hsl(var(--foreground)); background:hsl(var(--muted)); font-size:14px;
      -webkit-font-smoothing:antialiased;
    }
    .orqafy-root .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
    .card{
      background:hsl(var(--card)); border:1px solid hsl(var(--border));
      border-radius:var(--radius); box-shadow:0 1px 2px 0 rgb(16 24 40 / 0.05);
    }
    .orqafy-root ::-webkit-scrollbar{ width:10px; height:10px; }
    .orqafy-root ::-webkit-scrollbar-thumb{ background:hsl(var(--border)); border-radius:9999px; }
    .row-hover:hover{ background:hsl(var(--muted) / 0.5); }
    .nav-item{ color:hsl(var(--muted-foreground)); }
    .nav-item:hover{ background:hsl(var(--muted)); color:hsl(var(--foreground)); }
    .nav-item.active{ background:hsl(var(--primary) / 0.10); color:hsl(var(--primary)); font-weight:600; }
    .switch-pill{ border:1px solid hsl(var(--border)); background:hsl(var(--card)); color:hsl(var(--muted-foreground)); }
    .switch-pill.active{ background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); }
    .field{ border:1px solid hsl(var(--input)); background:hsl(var(--card)); border-radius:0.5rem; }
    .field:focus{ outline:2px solid hsl(var(--ring) / 0.4); outline-offset:1px; }
    .grid-bg{
      background-image:linear-gradient(hsl(var(--border)/.6) 1px,transparent 1px),
                       linear-gradient(90deg,hsl(var(--border)/.6) 1px,transparent 1px);
      background-size:22px 22px;
    }
  `}</style>
);

/* ============================================================================
   NAV / SHELL
   ============================================================================ */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: I.dash },
  { key: "projects", label: "Projects", icon: I.folder },
  { key: "board", label: "Project board", icon: I.check },
  { key: "files", label: "Files", icon: I.file },
  { key: "leave", label: "Leave", icon: I.leave },
  { key: "users", label: "Users & Roles", icon: I.users },
];

function Sidebar({ screen, go }) {
  return (
    <aside
      data-loading-path="custom"
      className="hidden md:flex md:flex-col w-60 shrink-0 border-r"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
    >
      <div className="h-14 flex items-center gap-2 px-5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white font-bold"
          style={{ background: "hsl(var(--primary))" }}>O</span>
        <span className="font-semibold">Orqafy</span>
      </div>
      <nav className="p-3 flex flex-col gap-1">
        {NAV.map((n) => (
          <button key={n.key} onClick={() => go(n.key)}
            className={"nav-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors " + (screen === n.key ? "active" : "")}>
            <Icon d={n.icon} size={18} />
            {n.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto p-3">
        <div className="rounded-lg p-3 text-xs" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
          <div className="font-medium" style={{ color: "hsl(var(--foreground))" }}>Self-hosted · LAN-first</div>
          Single-company install. Your server, your data.
        </div>
      </div>
    </aside>
  );
}

function BottomTabs({ screen, go }) {
  const items = [
    { key: "dashboard", label: "Home", icon: I.dash },
    { key: "projects", label: "Projects", icon: I.folder },
    { key: "mytasks", label: "My Tasks", icon: I.check },
    { key: "leave", label: "Leave", icon: I.leave },
  ];
  return (
    <nav data-loading-path="custom"
      className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t flex items-stretch"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
      {items.map((n) => (
        <button key={n.key} onClick={() => go(n.key)}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs"
          style={{ color: screen === n.key ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
          <Icon d={n.icon} size={20} />
          {n.label}
        </button>
      ))}
    </nav>
  );
}

function TopBar() {
  return (
    <header data-loading-path="shadcn"
      className="h-14 shrink-0 border-b flex items-center gap-3 px-4 sm:px-6"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
      <div className="font-semibold truncate">{ORG}</div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 field h-9 px-3 w-64" style={{ color: "hsl(var(--muted-foreground))" }}>
          <Icon d={I.search} size={16} />
          <span className="text-sm">Search projects, files, people…</span>
        </div>
        <button className="relative h-9 w-9 rounded-lg grid place-items-center" style={{ border: "1px solid hsl(var(--border))" }}>
          <Icon d={I.bell} size={18} />
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold grid place-items-center text-white"
            style={{ background: "hsl(var(--destructive))" }}>3</span>
        </button>
        <Avatar id="U1" size={32} />
      </div>
    </header>
  );
}

/* ============================================================================
   SCREEN — DASHBOARD
   ============================================================================ */

function Dashboard({ go }) {
  const active = PROJECTS.filter((p) => p.status === "active");
  const kpis = [
    { label: "Active projects", value: active.length, hint: "of 18 total" },
    { label: "My tasks due / overdue", value: "6 / 1", hint: "next 7 days" },
    { label: "Unsorted documents", value: 4, hint: "in review tray" },
    { label: "Pending leave approvals", value: LEAVE_PENDING.length, hint: "awaiting you" },
  ];
  return (
    <div className="space-y-6">
      <SectionTitle title="Dashboard" sub="Monday, 6 September 2026 · overview across all sites" />
      <div data-loading-path="shadcn" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>{k.label}</div>
            <div className="mono text-3xl font-semibold mt-2">{k.value}</div>
            <div className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{k.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6" path="shadcn">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Active projects</h3>
            <Btn variant="ghost" onClick={() => go("projects")} className="!h-8 !px-2">View all <Icon d={I.chevR} size={16} /></Btn>
          </div>
          <div className="space-y-4">
            {active.slice(0, 5).map((p) => (
              <div key={p.code} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{p.code}</span>
                    <Badge tone={p.status}>{p.status}</Badge>
                  </div>
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{CLIENTS[p.client]} · {STAFF[p.pm].name}</div>
                </div>
                <div className="w-40 shrink-0">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-full rounded-full" style={{ width: p.pct + "%", background: "hsl(var(--primary))" }} />
                  </div>
                  <div className="mono text-xs mt-1 text-right" style={{ color: "hsl(var(--muted-foreground))" }}>{p.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6" path="shadcn">
            <h3 className="text-lg font-semibold mb-3">Recent site photos</h3>
            <div data-loading-path="custom" className="grid grid-cols-3 gap-2">
              {["Bay 2 steel", "Grid C forms", "Reservoir", "Belfry", "Grandstand", "Drainage"].map((c, i) => (
                <div key={i} className="aspect-square rounded-lg grid place-items-end p-1.5 text-[10px] text-white/90 grid-bg"
                  style={{ background: `linear-gradient(135deg, hsl(${210 + i * 6} 30% ${40 + i * 3}%), hsl(${210 + i * 6} 30% 28%))` }}>
                  {c}
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6" path="shadcn">
            <h3 className="text-lg font-semibold mb-3">Pending your approval</h3>
            <div className="space-y-3">
              {LEAVE_PENDING.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Avatar id={l.who} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{STAFF[l.who].name}</div>
                    <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.type} · {l.from}–{l.to}</div>
                  </div>
                  <Badge tone="pending">pending</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — PROJECTS LIST (paginated)
   ============================================================================ */

function ProjectsList({ go }) {
  const [page, setPage] = useState(0);
  const per = 10;
  const total = PROJECTS.length;
  const rows = PROJECTS.slice(page * per, page * per + per);
  return (
    <div className="space-y-6">
      <SectionTitle title="Projects" sub={`${total} projects across 7 clients`}
        action={<Btn><Icon d={I.plus} size={16} /> New project</Btn>} />

      <Card path="shadcn" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="field h-9 px-3 flex items-center gap-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Icon d={I.search} size={16} /> Filter projects…
          </div>
          {["All statuses", "Active", "Planning", "On-hold", "Completed"].map((f, i) => (
            <button key={f} className={"h-9 px-3 rounded-lg text-sm switch-pill " + (i === 0 ? "active" : "")}>{f}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "hsl(var(--muted-foreground))" }}>
                <th className="font-medium px-4 py-2.5">Code</th>
                <th className="font-medium px-4 py-2.5">Project</th>
                <th className="font-medium px-4 py-2.5 hidden lg:table-cell">Client</th>
                <th className="font-medium px-4 py-2.5">Status</th>
                <th className="font-medium px-4 py-2.5 hidden md:table-cell">PM</th>
                <th className="font-medium px-4 py-2.5 hidden xl:table-cell text-right">Contract</th>
                <th className="font-medium px-4 py-2.5 w-40">Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.code} className="row-hover border-t cursor-pointer" style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => go("board")}>
                  <td className="px-4 py-3 mono text-xs whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>{p.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs lg:hidden" style={{ color: "hsl(var(--muted-foreground))" }}>{CLIENTS[p.client]}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "hsl(var(--muted-foreground))" }}>{CLIENTS[p.client]}</td>
                  <td className="px-4 py-3"><Badge tone={p.status}>{p.status}</Badge></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2"><Avatar id={p.pm} size={26} /><span className="text-xs">{STAFF[p.pm].name.split(" ").slice(-1)}</span></div>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-right mono text-xs whitespace-nowrap">{peso(p.value)}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                      <div className="h-full rounded-full" style={{ width: p.pct + "%", background: p.pct === 100 ? "hsl(var(--success))" : "hsl(var(--primary))" }} />
                    </div>
                    <div className="mono text-[11px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{p.pct}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 border-t text-sm" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
          <span>Showing <span className="mono">{page * per + 1}–{Math.min((page + 1) * per, total)}</span> of <span className="mono">{total}</span></span>
          <div className="flex gap-2">
            <Btn variant="outline" className="!h-8" onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Btn>
            <Btn variant="outline" className="!h-8" onClick={() => setPage((p) => ((p + 1) * per < total ? p + 1 : p))}>Next</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   SCREEN — PROJECT BOARD (kanban)  [custom]
   ============================================================================ */

function Board({ go }) {
  const proj = PROJECTS.find((p) => p.code === "PRJ-2026-014");
  const cols = [
    { key: "todo", label: "To do" },
    { key: "in-progress", label: "In progress" },
    { key: "blocked", label: "Blocked" },
    { key: "done", label: "Done" },
  ];
  const dot = { todo: "hsl(var(--muted-foreground))", "in-progress": "hsl(var(--primary))", blocked: "hsl(var(--destructive))", done: "hsl(var(--success))" };
  return (
    <div className="space-y-6">
      <SectionTitle
        title={proj.name}
        sub={<><span className="mono">{proj.code}</span> · {CLIENTS[proj.client]} · {proj.site} · PM {STAFF[proj.pm].name}</>}
        action={<Btn><Icon d={I.plus} size={16} /> Add task</Btn>} />

      <div data-loading-path="custom" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cols.map((c) => (
          <div key={c.key} className="rounded-lg p-3" style={{ background: "hsl(var(--muted) / 0.5)" }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot[c.key] }} />
              <span className="font-medium text-sm">{c.label}</span>
              <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{BOARD[c.key].length}</span>
            </div>
            <div className="space-y-2.5">
              {BOARD[c.key].map((t) => (
                <button key={t.id} onClick={() => go("task")}
                  className="card w-full text-left p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="mono text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{t.id}</span>
                    {t.geofenced && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-1.5 py-0.5"
                        style={{ background: "hsl(var(--accent) / 0.16)", color: "hsl(38 92% 34%)" }}>
                        <Icon d={I.pin} size={12} /> Geofenced
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium leading-snug">{t.title}</div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <Avatar id={t.assignee} size={24} />
                      <Badge tone={t.priority === "High" ? "blocked" : t.priority === "Low" ? "todo" : "pending"}>{t.priority}</Badge>
                    </div>
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{t.due.slice(5)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   MAP PLACEHOLDER  [custom]  — pin + amber radius circle (SVG, no Leaflet)
   ============================================================================ */

function MapPlaceholder({ lat, lng, radius, label, height = 260 }) {
  return (
    <div data-loading-path="custom" className="relative rounded-lg overflow-hidden border grid-bg"
      style={{ height, borderColor: "hsl(var(--border))", background: "hsl(210 30% 96%)" }}>
      {/* faux streets */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.5 }}>
        <path d="M0 70 H400 M0 170 H400 M90 0 V300 M250 0 V300" stroke="hsl(var(--muted-foreground))" strokeWidth="6" fill="none" opacity="0.15" />
      </svg>
      {/* radius circle + pin, centered */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid place-items-center">
          <span className="absolute rounded-full" style={{
            width: 150, height: 150,
            background: "hsl(var(--accent) / 0.18)",
            border: "2px solid hsl(var(--accent))",
          }} />
          <span className="absolute rounded-full" style={{ width: 8, height: 8, background: "hsl(var(--accent))", top: "50%" }} />
          <span style={{ color: "hsl(var(--destructive))", transform: "translateY(-14px)" }}>
            <Icon d={I.pin} size={30} fill="hsl(var(--destructive))" stroke="#fff" />
          </span>
        </div>
      </div>
      <div className="absolute left-3 bottom-3 rounded-md px-2.5 py-1.5 text-xs"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="font-medium">{label}</div>
        <div className="mono" style={{ color: "hsl(var(--muted-foreground))" }}>{lat}, {lng} · r={radius} m</div>
      </div>
      <div className="absolute right-3 top-3 text-[10px] px-1.5 py-0.5 rounded"
        style={{ background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))" }}>Leaflet · OpenStreetMap</div>
    </div>
  );
}

/* ============================================================================
   SCREEN — TASK DETAIL (the differentiator: location + radius + geofence schedule)
   ============================================================================ */

function TaskDetail() {
  const proj = PROJECTS.find((p) => p.code === "PRJ-2026-014");
  const t = {
    id: "T-1039", title: "Structural steel erection — Bay 2", status: "in-progress",
    priority: "High", assignee: "U5", createdBy: "U2", due: "2026-09-18",
    lat: "13.40850", lng: "121.18021", radius: 120,
    activeFrom: "2026-09-08", activeUntil: "2026-09-30",
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        <span className="mono">{proj.code}</span><Icon d={I.chevR} size={14} /><span>Board</span><Icon d={I.chevR} size={14} /><span className="mono">{t.id}</span>
      </div>
      <SectionTitle title={t.title}
        sub={<>Assigned to {STAFF[t.assignee].name} · created by {STAFF[t.createdBy].name}</>}
        action={<Btn variant="outline">Mark done <Icon d={I.check} size={16} /></Btn>} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6" path="shadcn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[["Status", <Badge tone="in-progress">in progress</Badge>], ["Priority", <Badge tone="blocked">High</Badge>],
              ["Due date", <span className="mono text-sm">{t.due}</span>], ["Task ID", <span className="mono text-sm">{t.id}</span>]].map(([k, v], i) => (
                <div key={i}><div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{k}</div>{v}</div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Description</div>
              <p className="text-sm leading-relaxed">Erect and plumb structural steel columns and beams for Bay 2 of the public market
                superstructure. Coordinate with the delivered rebar batch. Torque all bolted connections to spec and
                capture progress photos on the assigned tasks before marking done.</p>
            </div>
          </Card>

          {/* GEOFENCE panel — the differentiator */}
          <Card className="p-6" path="shadcn">
            <div className="flex items-center gap-2 mb-4">
              <span className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: "hsl(var(--accent) / 0.16)", color: "hsl(38 92% 34%)" }}>
                <Icon d={I.pin} size={18} />
              </span>
              <h3 className="text-lg font-semibold">Site location & geofence</h3>
            </div>
            <MapPlaceholder lat={t.lat} lng={t.lng} radius={t.radius} label="Calapan City Public Market — Guinobatan" />
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Location (lat, lng)</div>
                <div className="mono text-sm">{t.lat}, {t.lng}</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Trigger radius</div>
                <div className="mono text-sm">{t.radius} meters</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Dwell before alert</div>
                <div className="mono text-sm">~3 minutes</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Geofence active from</div>
                <div className="mono text-sm">{t.activeFrom}</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Active until (optional)</div>
                <div className="mono text-sm">{t.activeUntil}</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Alert behaviour</div>
                <div className="text-sm">Re-alerts on every re-entry</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg p-3 text-xs flex items-start gap-2"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
              <Icon d={I.check} size={14} />
              <span>Evaluated on-device, works fully offline. Presence-only — no location history is stored.
                Fires only for the assigned worker, on or after the active-from date.</span>
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          <Card className="p-6" path="shadcn">
            <h3 className="text-sm font-semibold mb-3">Progress photos</h3>
            <div data-loading-path="custom" className="grid grid-cols-2 gap-2">
              {["Bay 2 · Sep 6", "Bolts · Sep 6"].map((c, i) => (
                <div key={i} className="aspect-square rounded-lg grid place-items-end p-1.5 text-[10px] text-white/90"
                  style={{ background: `linear-gradient(135deg, hsl(210 28% ${42 - i * 6}%), hsl(210 28% 26%))` }}>{c}</div>
              ))}
              <button className="aspect-square rounded-lg border-2 border-dashed grid place-items-center"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                <div className="flex flex-col items-center gap-1 text-xs"><Icon d={I.camera} size={20} /> Capture</div>
              </button>
            </div>
          </Card>
          <Card className="p-6" path="shadcn">
            <h3 className="text-sm font-semibold mb-3">Activity</h3>
            <ol className="space-y-3 text-xs">
              {[["RM", "created this task", "Sep 1"], ["RM", "set geofence · r=120 m", "Sep 1"], ["JB", "moved to In progress", "Sep 6"], ["JB", "added 2 photos", "Sep 6"]].map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ background: "hsl(var(--primary))" }} />
                  <span><b>{a[0]}</b> {a[1]} · <span style={{ color: "hsl(var(--muted-foreground))" }}>{a[2]}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PHONE FRAME  — for Mobile First screens
   ============================================================================ */

function Phone({ children, label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {label && <div className="text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>}
      <div className="rounded-[2.2rem] p-2.5 shadow-xl" style={{ background: "hsl(222 47% 11%)", width: 380 }}>
        <div className="rounded-[1.7rem] overflow-hidden relative" style={{ background: "hsl(var(--background))", height: 760 }}>
          <div className="absolute top-0 inset-x-0 h-7 flex items-center justify-between px-6 text-[11px] font-medium z-10"
            style={{ background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>
            <span className="mono">9:41</span>
            <span className="h-4 w-16 rounded-b-xl bg-black/80 absolute left-1/2 -translate-x-1/2 top-0" />
            <span className="mono">100%</span>
          </div>
          <div className="absolute inset-0 top-7 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — MY TASKS (Mobile First)
   ============================================================================ */

function MyTasksBody() {
  const dot = { todo: "hsl(var(--muted-foreground))", "in-progress": "hsl(var(--primary))", blocked: "hsl(var(--destructive))", done: "hsl(var(--success))" };
  return (
    <div className="min-h-full flex flex-col" style={{ background: "hsl(var(--muted) / 0.4)" }}>
      <div className="px-5 pt-4 pb-3" style={{ background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <Avatar id="U5" size={40} />
          <div>
            <div className="font-semibold">My Tasks</div>
            <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{STAFF.U5.name} · Site Staff</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {["All", "Today", "Overdue", "Done"].map((f, i) => (
            <span key={f} className={"px-3 py-1 rounded-full text-xs switch-pill " + (i === 0 ? "active" : "")}>{f}</span>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {MY_TASKS.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="mono text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{t.id} · {t.proj}</span>
              {t.geofenced && <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "hsl(38 92% 34%)" }}><Icon d={I.pin} size={12} /> Geofenced</span>}
            </div>
            <div className="font-medium leading-snug">{t.title}</div>
            <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Icon d={I.pin} size={13} /> {t.site}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: dot[t.state] }} />
                <span className="capitalize" style={{ color: dot[t.state] }}>{t.state.replace("-", " ")}</span>
              </span>
              <span className="text-xs font-medium" style={{ color: t.due.includes("overdue") ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                <Icon d={I.clock} size={12} /> {t.due}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — GEOFENCE ALERT (Mobile First) — the ONE assertive amber treatment
   ============================================================================ */

function GeofenceBody() {
  const here = [
    { id: "T-1039", title: "Structural steel erection — Bay 2", priority: "High" },
    { id: "T-1042", title: "Pour column footings — Grid C", priority: "High" },
  ];
  return (
    <div className="min-h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
      {/* assertive amber hero */}
      <div className="px-6 pt-8 pb-7 text-center"
        style={{ background: "linear-gradient(160deg, hsl(38 92% 52%), hsl(36 92% 46%))", color: "hsl(222 47% 11%)" }}>
        <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-full" style={{ background: "rgba(255,255,255,0.35)" }}>
          <Icon d={I.pin} size={34} fill="hsl(222 47% 11%)" stroke="hsl(38 92% 50%)" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider opacity-80">You've arrived on site</div>
        <h1 className="text-3xl font-bold leading-tight mt-1">You have 2 things<br />to do here</h1>
        <div className="text-sm font-medium mt-2 opacity-90">Calapan City Public Market · Guinobatan</div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {here.map((t) => (
          <button key={t.id} className="card w-full text-left p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className="grid place-items-center h-11 w-11 rounded-xl shrink-0"
              style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
              <Icon d={I.check} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{t.id}</div>
              <div className="font-semibold leading-snug">{t.title}</div>
            </div>
            <Icon d={I.chevR} size={20} />
          </button>
        ))}

        <button className="w-full h-14 rounded-xl flex items-center justify-center gap-2 font-semibold text-white mt-2"
          style={{ background: "hsl(var(--primary))" }}>
          <Icon d={I.camera} size={22} /> Capture site photo
        </button>
        <p className="text-center text-xs pt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
          Triggered on arrival · re-alerts each re-entry · presence only, no tracking
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — FILES + DOCUMENT REVIEW TRAY
   ============================================================================ */

function Files() {
  const catTone = { invoice: "in-progress", receipt: "pending", PO: "planning", drawing: "todo", permit: "done", photo: "active" };
  return (
    <div className="space-y-6">
      <SectionTitle title="Files" sub="Nextcloud two-way sync · revisions · auto-filed into Client › Project › category"
        action={<Btn><Icon d={I.plus} size={16} /> Upload</Btn>} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* browser */}
        <Card className="lg:col-span-2 overflow-hidden" path="shadcn">
          <div className="p-4 border-b flex items-center gap-2 text-sm" style={{ borderColor: "hsl(var(--border))" }}>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>Golden Harvest Agri-Ventures</span>
            <Icon d={I.chevR} size={14} />
            <span className="mono">PRJ-2026-021</span>
            <Icon d={I.chevR} size={14} />
            <span className="font-medium">All categories</span>
          </div>
          {/* dropzone */}
          <div data-loading-path="custom" className="m-4 rounded-lg border-2 border-dashed grid place-items-center py-6 text-sm"
            style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
            <div className="flex flex-col items-center gap-1">
              <Icon d={I.file} size={22} />
              Drag &amp; drop documents to auto-file · OCR + record match
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: "hsl(var(--muted-foreground))" }}>
              <th className="font-medium px-4 py-2">Name</th>
              <th className="font-medium px-4 py-2">Category</th>
              <th className="font-medium px-4 py-2 hidden sm:table-cell">Size</th>
              <th className="font-medium px-4 py-2 hidden md:table-cell">Uploaded</th>
            </tr></thead>
            <tbody>
              {FILE_ROWS.map((f) => (
                <tr key={f.name} className="row-hover border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <td className="px-4 py-3 flex items-center gap-2"><Icon d={I.file} size={16} /><span className="mono text-xs">{f.name}</span></td>
                  <td className="px-4 py-3"><Badge tone={catTone[f.cat]}>{f.cat}</Badge></td>
                  <td className="px-4 py-3 hidden sm:table-cell mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{f.size}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{STAFF[f.by].initials} · {f.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* review tray */}
        <Card className="p-6" path="shadcn">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold">Review tray</h3>
            <Badge tone="pending">4 pending</Badge>
          </div>
          <p className="text-xs mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>Confidence-gated. Financial docs never auto-file silently.</p>
          <div className="space-y-3">
            {REVIEW.map((r) => (
              <div key={r.file} className="rounded-lg border p-3" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-2">
                  <Icon d={I.file} size={16} />
                  <span className="mono text-xs truncate flex-1">{r.file}</span>
                  {r.spi && <Badge tone="blocked">SPI</Badge>}
                </div>
                <div className="text-xs mt-2 mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Suggested: <span style={{ color: "hsl(var(--foreground))" }}>{r.client}</span>
                  {r.proj !== "—" && <> › <span className="mono">{r.proj}</span></>} › <span className="capitalize">{r.category}</span>
                </div>
                {/* confidence bar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-full rounded-full" style={{
                      width: r.confidence + "%",
                      background: r.confidence >= 85 ? "hsl(var(--success))" : r.confidence >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                    }} />
                  </div>
                  <span className="mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{r.confidence}%</span>
                </div>
                <div className="flex gap-2">
                  {r.spi
                    ? <Btn variant="outline" className="!h-8 flex-1 text-xs">File as SPI (finance-gated)</Btn>
                    : <>
                      <Btn className="!h-8 flex-1 text-xs" variant={r.confidence >= 60 ? "primary" : "outline"}>Confirm</Btn>
                      <Btn variant="outline" className="!h-8 flex-1 text-xs">Reassign</Btn>
                    </>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — APPLY FOR LEAVE (mobile-framed) + LEAVE APPROVALS (list)
   ============================================================================ */

function ApplyLeaveBody() {
  return (
    <div className="min-h-full" style={{ background: "hsl(var(--muted) / 0.4)" }}>
      <div className="px-5 pt-4 pb-3" style={{ background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="font-semibold">Apply for leave</div>
        <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{STAFF.U5.name}</div>
      </div>
      <div className="p-4 space-y-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Vacation balance</div>
            <div className="mono text-2xl font-semibold">8.5 <span className="text-sm font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/ 15 days</span></div>
          </div>
          <div className="text-right text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Sick 4 · Emergency 2 left</div>
        </div>
        <div>
          <label className="text-sm font-medium">Leave type</label>
          <div className="field h-11 px-3 mt-1 flex items-center justify-between text-sm">Vacation <Icon d={I.chevR} size={16} style={{ transform: "rotate(90deg)" }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-medium">From</label><div className="field h-11 px-3 mt-1 flex items-center mono text-sm">2026-09-29</div></div>
          <div><label className="text-sm font-medium">To</label><div className="field h-11 px-3 mt-1 flex items-center mono text-sm">2026-10-01</div></div>
        </div>
        <div>
          <label className="text-sm font-medium">Reason <span style={{ color: "hsl(var(--muted-foreground))" }}>(optional)</span></label>
          <div className="field px-3 py-2 mt-1 text-sm" style={{ height: 80, color: "hsl(var(--muted-foreground))" }}>Family event in Naujan. No health detail required.</div>
        </div>
        <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
          <Icon d={I.check} size={14} /> 3 days requested · balance covers it. Routes to a manager with approve-leave.
        </div>
        <button className="w-full h-12 rounded-xl font-semibold text-white" style={{ background: "hsl(var(--primary))" }}>Submit request</button>
      </div>
    </div>
  );
}

function Leave() {
  return (
    <div className="space-y-6">
      <SectionTitle title="Leave" sub="Apply from a phone (Mobile First) · approvers review at the desk (Mobile Ready)" />
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 flex justify-center">
          <Phone label="Apply for leave · Mobile First"><ApplyLeaveBody /></Phone>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden" path="shadcn">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "hsl(var(--border))" }}>
              <h3 className="text-lg font-semibold">Pending approvals</h3>
              <Badge tone="pending">{LEAVE_PENDING.length} to review</Badge>
            </div>
            <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
              {LEAVE_PENDING.map((l, i) => (
                <div key={i} className="p-4 flex items-center gap-3 flex-wrap" style={{ borderColor: "hsl(var(--border))" }}>
                  <Avatar id={l.who} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{STAFF[l.who].name}</div>
                    <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {l.type} · <span className="mono">{l.from}–{l.to}</span> · {l.days} day{l.days > 1 ? "s" : ""}
                    </div>
                    {l.flag && <div className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: "hsl(var(--destructive))" }}>⚠ {l.flag}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Btn className="!h-8" >Approve</Btn>
                    <Btn variant="outline" className="!h-8">Reject</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden" path="shadcn">
            <div className="p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}><h3 className="text-lg font-semibold">Recently decided</h3></div>
            <table className="w-full text-sm">
              <tbody>
                {LEAVE_DECIDED.map((l, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar id={l.who} size={28} /><span className="font-medium">{STAFF[l.who].name}</span></div></td>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.type}</td>
                    <td className="px-4 py-3 mono text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{l.from}–{l.to}</td>
                    <td className="px-4 py-3"><Badge tone={l.state}>{l.state}</Badge></td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "hsl(var(--muted-foreground))" }}>by {STAFF[l.by].initials}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SCREEN — USERS / ROLES permission builder
   ============================================================================ */

function Users() {
  const [matrix, setMatrix] = useState(USER_MATRIX);
  const userIds = ["U1", "U2", "U3", "U4", "U5", "U9"];
  const toggle = (u, k) => setMatrix((m) => ({ ...m, [u]: { ...m[u], [k]: !m[u][k] } }));

  const Toggle = ({ on, onClick, locked }) => (
    <button onClick={locked ? undefined : onClick} disabled={locked}
      className="relative h-5 w-9 rounded-full transition-colors mx-auto block"
      style={{ background: on ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)", opacity: locked ? 0.5 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
    </button>
  );

  return (
    <div className="space-y-6">
      <SectionTitle title="Users & Roles" sub="Role + custom permission-group + per-user override · single-company install"
        action={<Btn><Icon d={I.plus} size={16} /> Invite user</Btn>} />

      {/* custom groups */}
      <Card className="p-6" path="shadcn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Custom permission groups</h3>
          <Btn variant="outline" className="!h-8"><Icon d={I.plus} size={14} /> New group</Btn>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {GROUPS.map((g) => (
            <div key={g.name} className="rounded-lg border p-4" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="font-medium">{g.name}</div>
              <div className="text-xs mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>{g.members} members</div>
              <div className="flex flex-wrap gap-1.5">
                {g.perms.map((p) => (
                  <span key={p} className="mono text-[11px] px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* per-user permission matrix */}
      <Card className="overflow-hidden" path="shadcn">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "hsl(var(--border))" }}>
          <h3 className="text-lg font-semibold">Per-user permissions</h3>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Owner/Admin permissions are locked (immutable superadmin)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "hsl(var(--muted-foreground))" }}>
                <th className="text-left font-medium px-4 py-3 sticky left-0" style={{ background: "hsl(var(--card))" }}>User</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                {PERMISSIONS.map((p) => (
                  <th key={p.key} className="font-medium px-2 py-3 text-center">
                    <div className="mono text-[10px] whitespace-nowrap" title={p.label}>{p.key}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userIds.map((u) => (
                <tr key={u} className="row-hover border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <td className="px-4 py-3 sticky left-0" style={{ background: "hsl(var(--card))" }}>
                    <div className="flex items-center gap-2"><Avatar id={u} size={28} /><span className="font-medium whitespace-nowrap">{STAFF[u].name}</span></div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={u === "U1" ? "active" : "todo"}>{STAFF[u].role}</Badge></td>
                  {PERMISSIONS.map((p) => {
                    const locked = u === "U1"; // owner immutable
                    const highlight = p.key === "view_finances" || p.key === "approve_leave";
                    return (
                      <td key={p.key} className="px-2 py-3" style={highlight ? { background: "hsl(var(--accent) / 0.06)" } : undefined}>
                        <Toggle on={!!matrix[u][p.key]} locked={locked} onClick={() => toggle(u, p.key)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t text-xs flex items-center gap-4 flex-wrap" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded" style={{ background: "hsl(var(--accent) / 0.14)" }} /> Highlighted: <b className="mono">view_finances</b> &amp; <b className="mono">approve_leave</b> are permissions, not hardwired to a role</span>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   DESKTOP SHELL + MOBILE VIEW ROUTER
   ============================================================================ */

const MOBILE_SCREENS = { mytasks: "My Tasks · Mobile First", geofence: "Geofence alert · Mobile First" };

function DesktopScreen({ screen, go }) {
  const map = {
    dashboard: <Dashboard go={go} />,
    projects: <ProjectsList go={go} />,
    board: <Board go={go} />,
    task: <TaskDetail />,
    files: <Files />,
    leave: <Leave />,
    users: <Users />,
  };
  return (
    <div className="flex h-full">
      <Sidebar screen={screen} go={go} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8" style={{ background: "hsl(var(--background))" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{map[screen]}</div>
        </main>
        <BottomTabs screen={screen} go={go} />
      </div>
    </div>
  );
}

function MobileScreen({ screen }) {
  return (
    <div className="h-full overflow-y-auto grid-bg" style={{ background: "hsl(var(--muted))" }}>
      <div className="min-h-full grid place-items-center py-10 px-4">
        <Phone label={MOBILE_SCREENS[screen]}>
          {screen === "mytasks" ? <MyTasksBody /> : <GeofenceBody />}
        </Phone>
      </div>
    </div>
  );
}

/* ============================================================================
   ROOT
   ============================================================================ */

const SWITCHER = [
  ["dashboard", "Dashboard"],
  ["projects", "Projects"],
  ["board", "Project board"],
  ["task", "Task detail"],
  ["mytasks", "My Tasks · mobile"],
  ["geofence", "Geofence alert · mobile"],
  ["files", "Files + review tray"],
  ["leave", "Leave apply + approvals"],
  ["users", "Users & Roles"],
];

export default function OrqafyMockup() {
  const [screen, setScreen] = useState("dashboard");
  const go = (s) => setScreen(s);
  const isMobile = screen in MOBILE_SCREENS;

  return (
    <div className="orqafy-root" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ThemeStyle />

      {/* Mockup screen switcher (review-only chrome, not part of the product) */}
      <div className="shrink-0 border-b" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-semibold shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
            Phase 2.8 mockup ·
          </span>
          {SWITCHER.map(([k, label]) => (
            <button key={k} onClick={() => go(k)}
              className={"switch-pill shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors " + (screen === k ? "active" : "")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isMobile ? <MobileScreen screen={screen} /> : <DesktopScreen screen={screen} go={go} />}
      </div>
    </div>
  );
}
