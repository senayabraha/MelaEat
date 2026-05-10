import { useState } from "react";

const tasks = [
  {
    id: 1,
    priority: "CRITICAL",
    priorityColor: "#ef4444",
    label: "Fix Driver Profile RLS Leak",
    file: "sql/schema.sql",
    objective:
      "Prevent authenticated customers and restaurant owners from reading all driver profiles.",
    problem: `The current policy allows any authenticated user to read ALL driver profiles:
using (
  id = auth.uid()
  or public.is_admin()
  or role = 'driver'  ← leaks all driver data
)`,
    fix: `Replace with a scoped policy:
using (
  id = auth.uid()
  or public.is_admin()
  or (
    role = 'driver'
    and exists (
      select 1 from public.orders o
      where o.driver_id = profiles.id
      and public.can_access_order(o.id)
    )
  )
)`,
    success: [
      "A customer querying profiles WHERE role='driver' returns 0 rows (unless they share an order).",
      "A driver can still read their own profile row.",
      "An admin can still read all profiles.",
      "The driver card shown on OrderTracking still loads correctly (driver is linked to that order).",
      "Existing RLS tests in tests/security/rls-policy-static.test.js pass.",
    ],
    effort: "1–2 hours",
    risk: "High — security vulnerability live in production",
  },
  {
    id: 2,
    priority: "HIGH",
    priorityColor: "#f97316",
    label: "Rename base44 → melaeat Throughout Codebase",
    file: "src/api/base44Client.js + all importers",
    objective:
      "Remove the base44 platform name from your codebase. It is a third-party brand baked into the source.",
    problem: `base44Client.js exports base44.auth.me(), base44.users.completeRole(),
base44.orders.create() — imported in Login.jsx, RoleSelection.jsx,
Checkout.jsx, OrderTracking.jsx, and all dashboard screens.`,
    fix: `1. Rename base44Client.js → apiClient.js
2. Rename the base44 export object → melaeat (or api)
3. Global find+replace: import { base44 } → import { melaeat }
4. Global find+replace: base44.auth → melaeat.auth, etc.
5. Update all import paths`,
    success: [
      "Zero occurrences of 'base44' remain in /src (grep confirms).",
      "All existing functionality works identically after rename.",
      "npm run build passes with no errors.",
      "npm run lint passes with no errors.",
      "Login, signup, logout, and order placement all work end to end.",
    ],
    effort: "2–3 hours",
    risk: "Medium — pure rename, no logic changes, but touches many files",
  },
  {
    id: 3,
    priority: "HIGH",
    priorityColor: "#f97316",
    label: "Split Login.jsx Into Focused Modules",
    file: "src/screens/Login.jsx → src/screens/auth/",
    objective:
      "Break the 596-line Login.jsx into single-responsibility files so each auth flow is easy to locate and debug.",
    problem: `One file handles: sign in, sign up, reset request, update password,
AND three different Supabase recovery token formats (hash, PKCE code,
token_hash). When the recovery flow breaks, the bug is buried in 596 lines.`,
    fix: `Create src/screens/auth/:
  AuthPage.jsx         — reads URL + params, renders correct form (~40 lines)
  SignInForm.jsx       — email + password + finishAuth (~80 lines)
  SignUpForm.jsx       — name + email + password + confirm (~90 lines)
  ResetRequestForm.jsx — email field only (~50 lines)
  UpdatePasswordForm.jsx — new password + confirm (~60 lines)
  RecoveryCallback.jsx — all token processing useEffects (~100 lines)
  useAuthMode.js       — shared hook: derives mode from URL (~60 lines)
  useFinishAuth.js     — shared finishAuth + role redirect logic (~50 lines)

Update App.jsx routes to point to AuthPage.jsx`,
    success: [
      "No single auth file exceeds 100 lines.",
      "All 4 auth flows work end to end: sign in, sign up, reset request, password update.",
      "Recovery email link correctly lands on UpdatePasswordForm.",
      "Expired recovery link shows the error message, not a blank screen.",
      "Role switcher tabs (customer / restaurant / driver) still work on sign in and sign up.",
      "Admin sign up attempt is still blocked.",
      "npm run build passes.",
    ],
    effort: "4–6 hours",
    risk: "Medium — logic stays identical, only structure changes",
  },
  {
    id: 4,
    priority: "MEDIUM",
    priorityColor: "#eab308",
    label: "Delete or Wire Up RoleSelection.jsx",
    file: "src/screens/RoleSelection.jsx",
    objective:
      "Resolve the orphaned screen at /select-role. It duplicates role selection logic already in Login.jsx.",
    problem: `RoleSelection.jsx exists and is imported in App.jsx at /select-role,
but no screen, button, or redirect points to it. The signup flow goes
directly from SignUpForm → finishAuth → dashboard.
Two role-selection implementations exist; one is never used.`,
    fix: `Option A (recommended): Delete RoleSelection.jsx and remove
the /select-role route from App.jsx entirely.

Option B: Wire it up as the post-signup landing for OAuth users
(Google sign-in) who don't have a role yet — replace the finishAuth
redirect-to-dashboard with a redirect to /select-role when role='user'.`,
    success: [
      "Option A: RoleSelection.jsx is deleted, /select-role returns 404, no broken imports remain.",
      "Option A: npm run build passes, npm run lint passes.",
      "Option B: OAuth users who complete Google sign-in land on /select-role and can choose a role.",
      "Option B: After role selection, user is redirected to correct dashboard.",
      "Either option: only one role-selection flow exists in the codebase.",
    ],
    effort: "30 minutes (Option A) / 3 hours (Option B)",
    risk: "Low — dead code removal or wiring up an existing screen",
  },
  {
    id: 5,
    priority: "MEDIUM",
    priorityColor: "#eab308",
    label: "Raise Password Minimum to 8 Characters + Add Strength Indicator",
    file: "src/screens/auth/SignUpForm.jsx + src/screens/auth/UpdatePasswordForm.jsx",
    objective:
      "Enforce a stronger password policy at the form level. The current 6-character minimum is too weak.",
    problem: `minLength={6} is set in the Input components and validated in handleSubmit.
Supabase's default minimum is also 6. No strength feedback exists —
a user can set '123456' as their password with no warning.`,
    fix: `1. Change minLength to 8 in both SignUpForm and UpdatePasswordForm
2. Update Supabase Auth settings: Authentication → Policies →
   set minimum password length to 8
3. Add a simple strength indicator component (4-bar visual):
   - Red:    < 8 chars
   - Orange: 8+ chars, only one character class
   - Yellow: 8+ chars, two character classes
   - Green:  8+ chars, three+ character classes (upper, lower, number, symbol)
4. Update the placeholder text: "At least 8 characters"
5. Update error message: "Password must be at least 8 characters long."`,
    success: [
      "Submitting a 7-character password shows an error before hitting Supabase.",
      "The strength indicator updates in real time as the user types.",
      "A password like 'password1' shows Orange (weak), 'P@ssw0rd1' shows Green (strong).",
      "Supabase rejects passwords under 8 chars as a server-side backstop.",
      "The indicator does not show on the SignInForm (only on forms that create/update passwords).",
    ],
    effort: "2–3 hours",
    risk: "Low — additive UI change, no auth logic modified",
  },
  {
    id: 6,
    priority: "LOW",
    priorityColor: "#6b7280",
    label: "Persist Redirect Param Before Checkout Auth Redirect",
    file: "src/screens/Checkout.jsx + src/lib/AuthContext.jsx",
    objective:
      "Ensure that a customer who starts checkout, gets redirected to login, and logs in again is returned to /checkout.",
    problem: `ProtectedRoute redirects unauthenticated users to /login/customer
without a ?redirect= param for the /checkout route. A user who closes
the tab mid-checkout, reopens it, and logs in again lands on /browse
and loses their checkout context. The cart persists (localStorage)
but the redirect back to checkout does not.`,
    fix: `In App.jsx, update the ProtectedRoute for /checkout:
unauthenticatedElement={
  <Navigate
    to={'/login/customer?redirect=' + encodeURIComponent('/checkout')}
    replace
  />
}
The redirect param is already handled in Login.jsx's finishAuth —
it reads params.get('redirect') and navigates there after login.
No other changes needed.`,
    success: [
      "Logged-out user navigates to /checkout → redirected to /login/customer?redirect=%2Fcheckout.",
      "After successful login, user lands on /checkout (not /browse).",
      "Cart contents are still present after returning to /checkout.",
      "A redirect param pointing outside the app origin is ignored (existing security check in place).",
      "Logged-in users reach /checkout directly with no redirect.",
    ],
    effort: "30 minutes",
    risk: "Very low — one line change in App.jsx",
  },
];

const priorityBg = {
  CRITICAL: "rgba(239,68,68,0.12)",
  HIGH: "rgba(249,115,22,0.12)",
  MEDIUM: "rgba(234,179,8,0.12)",
  LOW: "rgba(107,114,128,0.12)",
};

export default function MelaEatTasks() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const filters = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

  const filtered =
    filter === "ALL" ? tasks : tasks.filter((t) => t.priority === filter);

  const active = tasks.find((t) => t.id === selected);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#e8e6e0",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #1e1e2e",
          padding: "24px 32px 20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#6b6b80",
              textTransform: "uppercase",
              fontFamily: "monospace",
              marginBottom: 6,
            }}
          >
            MelaEat · Auth Layer
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              color: "#f0ede8",
              letterSpacing: "-0.02em",
            }}
          >
            6 Actionable Tasks
          </h1>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => {
            const colors = {
              ALL: "#e8e6e0",
              CRITICAL: "#ef4444",
              HIGH: "#f97316",
              MEDIUM: "#eab308",
              LOW: "#6b7280",
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: `1px solid ${filter === f ? colors[f] : "#2a2a3a"}`,
                  background: filter === f ? `${colors[f]}22` : "transparent",
                  color: filter === f ? colors[f] : "#6b6b80",
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Task list */}
        <div
          style={{
            width: selected ? 340 : "100%",
            borderRight: selected ? "1px solid #1e1e2e" : "none",
            overflowY: "auto",
            padding: "20px 24px",
            transition: "width 0.2s",
            flexShrink: 0,
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#444460",
                fontFamily: "monospace",
                fontSize: 13,
                paddingTop: 60,
              }}
            >
              No tasks match this filter.
            </div>
          )}
          {filtered.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelected(selected === task.id ? null : task.id)}
              style={{
                marginBottom: 10,
                padding: "16px 18px",
                borderRadius: 10,
                border: `1px solid ${
                  selected === task.id
                    ? task.priorityColor + "60"
                    : "#1e1e2e"
                }`,
                background:
                  selected === task.id ? priorityBg[task.priority] : "#0f0f18",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    letterSpacing: "0.15em",
                    color: task.priorityColor,
                    textTransform: "uppercase",
                    background: `${task.priorityColor}18`,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: `1px solid ${task.priorityColor}30`,
                  }}
                >
                  {task.priority}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#444460",
                  }}
                >
                  #{task.id}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#444460",
                    marginLeft: "auto",
                  }}
                >
                  {task.effort}
                </span>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#f0ede8",
                  letterSpacing: "-0.01em",
                  marginBottom: 4,
                }}
              >
                {task.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#6b6b80",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.file}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {active && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 32px",
            }}
          >
            {/* Title row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 24,
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      letterSpacing: "0.15em",
                      color: active.priorityColor,
                      textTransform: "uppercase",
                      background: `${active.priorityColor}18`,
                      padding: "3px 10px",
                      borderRadius: 4,
                      border: `1px solid ${active.priorityColor}30`,
                    }}
                  >
                    {active.priority}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#6b6b80",
                    }}
                  >
                    Task #{active.id} · {active.effort}
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    color: "#f0ede8",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {active.label}
                </h2>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "#6b6b80",
                    marginTop: 6,
                  }}
                >
                  {active.file}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "#1a1a28",
                  border: "1px solid #2a2a3a",
                  color: "#6b6b80",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 16,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <Section label="Objective">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#c8c5bf" }}>
                {active.objective}
              </p>
            </Section>

            <Section label="The Problem">
              <CodeBlock>{active.problem}</CodeBlock>
            </Section>

            <Section label="What to Do">
              <CodeBlock>{active.fix}</CodeBlock>
            </Section>

            <Section label="Risk">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#1a1a28",
                  border: "1px solid #2a2a3a",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#c8c5bf",
                }}
              >
                <span style={{ color: active.priorityColor }}>⚠</span>
                {active.risk}
              </div>
            </Section>

            <Section label={`Success Criteria (${active.success.length} checks)`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {active.success.map((item, i) => (
                  <SuccessItem key={i} index={i + 1}>
                    {item}
                  </SuccessItem>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div
        style={{
          borderTop: "1px solid #1e1e2e",
          padding: "12px 32px",
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Critical", count: 1, color: "#ef4444" },
          { label: "High", count: 2, color: "#f97316" },
          { label: "Medium", count: 2, color: "#eab308" },
          { label: "Low", count: 1, color: "#6b7280" },
          { label: "Total effort", count: "~13–18 hrs", color: "#e8e6e0" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#6b6b80",
              }}
            >
              {s.label}:
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: s.color,
                fontWeight: 600,
              }}
            >
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#6b6b80",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid #1e1e2e",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "14px 16px",
        background: "#0d0d16",
        border: "1px solid #1e1e2e",
        borderRadius: 8,
        fontSize: 12,
        fontFamily: "monospace",
        color: "#a8c4a2",
        whiteSpace: "pre-wrap",
        lineHeight: 1.65,
        overflowX: "auto",
      }}
    >
      {children}
    </pre>
  );
}

function SuccessItem({ index, children }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 14px",
        background: "#0f0f18",
        border: "1px solid #1e1e2e",
        borderRadius: 8,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "#22c55e",
          marginTop: 2,
          flexShrink: 0,
          background: "#22c55e18",
          border: "1px solid #22c55e30",
          padding: "1px 6px",
          borderRadius: 4,
        }}
      >
        ✓ {index}
      </span>
      <span style={{ fontSize: 13, color: "#c8c5bf", lineHeight: 1.6 }}>
        {children}
      </span>
    </div>
  );
}
