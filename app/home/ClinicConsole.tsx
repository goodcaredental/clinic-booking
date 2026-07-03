"use client";

// Clinic-terminal home — two-stage flow:
//   1) LOCKED: terminal is signed in but no PIN holder identified. Shows the
//      full lockscreen (big clock + count tiles + "Sign in" / "Owner sign-in"
//      buttons). Count tiles are read-only here; tapping them prompts PIN.
//   2) IDENTIFIED: a nurse/doctor has PIN'd in. Lockscreen shrinks to a
//      compact header; below it, role-specific category cards group the
//      pages this staff member typically uses. "Lock" returns to LOCKED.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import PinChallenge from "@/components/PinChallenge";
import {
  readPinSession,
  writePinSession,
  clearPinSession,
  type PinSession,
} from "@/lib/pin-client";
import type { TerminalTheme } from "@/lib/terminal-theme";

type Counts = {
  pending: number;
  recalls: number;
  today: number;
  reminders: number;
};

type TodayBooking = {
  id: string;
  slot_start: string;
  service: string;
  attended: boolean;
  no_show: boolean;
  patient_name: string;
  patient_id_label?: string | null;
  doctor_name: string;
  // Premium room-flow fields — null when feature is off or step not taken yet.
  room?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  treatment_done?: string | null;
};

// Role-specific category cards on the identified screen. Kept lightweight
// (no DB lookups) — labels/links mirror the staff sidebar nav structure.
// Context-specific noun for each count key so the sub-line on a category
// card reads naturally ("5 awaiting", "3 due") instead of a generic "items".
type CountSemantics = "awaiting" | "due" | "today" | "to send";

type CategoryItem = { href: string; label: string; countKey?: keyof Counts };
type Category = { title: string; items: CategoryItem[] };

const COUNT_SEMANTICS: Record<keyof Counts, CountSemantics> = {
  pending: "awaiting",
  recalls: "due",
  today: "today",
  reminders: "to send",
};

const NURSE_CATEGORIES: Category[] = [
  {
    title: "Bookings",
    items: [
      { href: "/nurse", label: "Pending", countKey: "pending" },
      { href: "/staff/new", label: "New booking" },
      { href: "/nurse/all", label: "All bookings" },
      { href: "/nurse/patients", label: "Patients" },
    ],
  },
  {
    title: "Communications",
    items: [
      { href: "/staff/reminders", label: "Send reminders", countKey: "reminders" },
      { href: "/staff/recalls", label: "Send recalls", countKey: "recalls" },
      { href: "/staff/templates", label: "WhatsApp templates" },
    ],
  },
  {
    title: "Calendar",
    items: [
      { href: "/nurse/calendar", label: "Clinical calendar", countKey: "today" },
      { href: "/staff/duty-calendar", label: "Duty calendar" },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/staff/leave", label: "Leave" },
      { href: "/staff/duty", label: "Shift changes" },
      { href: "/staff/profile", label: "Change my PIN" },
    ],
  },
];

// Doctor PIN holders see a doctor-scoped subset — their own bookings + the
// patients they've seen, plus calendar views + HR. Recall-sending is a
// nurse front-desk task so it's not surfaced here.
const DOCTOR_CATEGORIES: Category[] = [
  {
    title: "Today",
    items: [
      { href: "/nurse/calendar", label: "Clinical calendar", countKey: "today" },
      { href: "/staff/duty-calendar", label: "Duty calendar" },
      { href: "/nurse/all?scope=mine", label: "My bookings" },
    ],
  },
  {
    title: "Patients",
    items: [
      { href: "/nurse/patients?scope=mine", label: "My patients" },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/staff/leave", label: "Leave" },
      { href: "/staff/duty", label: "Shift changes" },
      { href: "/staff/profile", label: "Change my PIN" },
    ],
  },
];

export default function ClinicConsole({
  clinicName,
  theme,
  counts,
  todayBookings = [],
  roomsEnabled = false,
  rooms = [],
  treatmentOptions = [],
}: {
  clinicName: string;
  theme: TerminalTheme;
  counts: Counts;
  todayBookings?: TodayBooking[];
  // Premium room flow — when roomsEnabled, the upcoming-patients panel shows
  // Check-in (nurse) + Check-out (doctor, with treatment picker) instead of
  // the basic Attended / No-show shortcut.
  roomsEnabled?: boolean;
  rooms?: string[];
  treatmentOptions?: string[];
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [session, setSession] = useState<PinSession | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  // Where to navigate after a successful PIN verify, when the user opened
  // the modal from a specific count tile. Null = stay on /home.
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // When the PIN modal opens from an admin tile (booking confirmation,
  // reminders, recalls), the picker should hide doctor cards — only nurses
  // perform those tasks. Attendance + general sign-in stay open to both.
  const [pendingAllowedRoles, setPendingAllowedRoles] = useState<("nurse" | "doctor")[] | undefined>(undefined);
  // Pending attendance action — when user clicks Attended / No-show on a
  // booking in the locked state, we open the PIN modal first.
  const [pendingMark, setPendingMark] = useState<{ booking_id: string; mark: "attended" | "no_show" } | null>(null);
  // Premium room flow — once nurse picks a room we open the PIN modal
  // (nurse-only); on verify we hit /api/bookings/check-in.
  const [pendingCheckIn, setPendingCheckIn] = useState<{ booking_id: string; room: string } | null>(null);
  // Premium check-out — doctor picks treatment_done, PIN modal (doctor-only),
  // then /api/bookings/check-out.
  const [pendingCheckOut, setPendingCheckOut] = useState<{ booking_id: string; treatment_done: string } | null>(null);
  // Open the room picker for a given booking before the PIN flow.
  const [roomPickerFor, setRoomPickerFor] = useState<TodayBooking | null>(null);
  // Open the treatment picker for a given booking before the PIN flow.
  const [treatmentPickerFor, setTreatmentPickerFor] = useState<TodayBooking | null>(null);
  // Optimistic local state for booking marks (so UI updates without a refresh)
  const [localMarks, setLocalMarks] = useState<Record<string, "attended" | "no_show" | "clear">>({});
  // Optimistic room + treatment locals for the Premium flow.
  const [localRooms, setLocalRooms] = useState<Record<string, string>>({});
  const [localTreatments, setLocalTreatments] = useState<Record<string, string>>({});
  const [ownerOpen, setOwnerOpen] = useState(false);

  // Clock tick
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Detect PIN session on mount + when storage changes (e.g. expiry tick)
  useEffect(() => {
    const tick = () => setSession(readPinSession());
    tick();
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, []);

  async function endSession() {
    // Clear PIN artefacts BEFORE signing out so the next user signing in
    // at this terminal doesn't inherit the previous PIN holder's cookie.
    clearPinSession();
    await fetch("/api/pin/lock-token", { method: "DELETE" }).catch(() => {});
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function lockPersonal() {
    // Clear PIN session + per-page cookie; terminal stays signed in.
    clearPinSession();
    fetch("/api/pin/lock-token", { method: "DELETE" }).catch(() => {});
    setSession(null);
  }

  // Idle auto-signout — 30 min no input → end terminal session entirely.
  useEffect(() => {
    const IDLE_MS = 30 * 60_000;
    let timer: ReturnType<typeof setTimeout>;
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => endSession(), IDLE_MS);
    }
    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  const weekday = now ? now.toLocaleDateString("en-GB", { weekday: "long" }) : "";
  const dateLine = now
    ? now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  // Theme gradient painted directly on the parent container's inline style
  // — guaranteed to apply (Tailwind arbitrary-value classes get JIT-purged
  // when held in variables; inline style is immune).
  const parentStyle: React.CSSProperties = {
    backgroundImage: theme.gradient,
    backgroundSize: "cover",
  };

  const bg = (
    <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: theme.accent }} />
  );

  const categories =
    session?.role === "doctor" ? DOCTOR_CATEGORIES : session?.role === "nurse" ? NURSE_CATEGORIES : [];

  // ── IDENTIFIED LAYOUT ────────────────────────────────────────────────────
  if (session) {
    return (
      <div className="min-h-dvh relative overflow-hidden text-white" style={parentStyle}>
        {bg}
        {/* Compact header (relative + z-10 stacks above the absolute bg layers) */}
        <div className="relative z-10 px-4 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-6 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/60">
              {clinicName}
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-3xl sm:text-4xl font-light tabular-nums leading-none">
                {hh}<span className="opacity-75">:</span>{mm}
              </div>
              <div className="text-xs sm:text-sm text-white/70">{weekday} · {dateLine}</div>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 text-[12px] sm:text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              <span>
                Signed in as <strong className="font-semibold">{session.full_name}</strong>{" "}
                <span className="text-white/60">({session.role})</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={lockPersonal}
              className="text-[11px] uppercase tracking-wider text-white/70 hover:text-white px-3 py-1.5 rounded border border-white/20 hover:border-white/40"
            >
              Lock
            </button>
            <button
              type="button"
              onClick={endSession}
              className="text-[11px] uppercase tracking-wider text-white/50 hover:text-white px-3 py-1.5 rounded border border-white/15 hover:border-white/40"
              title="Sign out the entire terminal (not just your PIN)"
            >
              End session
            </button>
          </div>
        </div>

        {/* Category cards */}
        <div className="relative z-10 px-4 pb-6 sm:px-6 sm:pb-8 space-y-4">
          {categories.map((cat) => (
            <section key={cat.title}>
              <h3 className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/55 mb-2 px-1">
                {cat.title}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {cat.items.map((item) => {
                  const count = item.countKey ? counts[item.countKey] : null;
                  const semantic = item.countKey ? COUNT_SEMANTICS[item.countKey] : null;
                  // Attention badge — red ! for pending bookings (urgent),
                  // amber ! for reminders + recalls (notices), nothing for
                  // informational counts (today's view).
                  const isUrgent = item.countKey === "pending";
                  const isNotice = item.countKey === "reminders" || item.countKey === "recalls";
                  const showAlert = count != null && count > 0 && (isUrgent || isNotice);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative block bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 hover:border-white/30 rounded-xl px-3 py-3 transition-colors"
                    >
                      {showAlert && (
                        <span
                          aria-hidden
                          className={`absolute top-1.5 right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow ring-2 ring-black/10 animate-pulse ${
                            isUrgent ? "bg-red-500" : "bg-amber-500"
                          }`}
                        >
                          !
                        </span>
                      )}
                      <div className="text-sm font-medium leading-tight">{item.label}</div>
                      {count != null && count > 0 && (
                        <div className="mt-1 text-[11px] text-white/80 tabular-nums">
                          {count} {semantic}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Shared post-action cleanup — drop PIN session so the lockscreen reverts
  // to LOCKED, otherwise the 5s polling tick flips into the identified view.
  function clearAfterOneShot() {
    clearPinSession();
    fetch("/api/pin/lock-token", { method: "DELETE" }).catch(() => {});
    setSession(null);
  }

  async function markAttendance(booking_id: string, mark: "attended" | "no_show", profile_id: string, pin: string) {
    setLocalMarks((m) => ({ ...m, [booking_id]: mark }));
    try {
      await fetch("/api/bookings/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id, mark, pin_profile_id: profile_id, pin }),
      });
    } catch {
      setLocalMarks((m) => {
        const next = { ...m };
        delete next[booking_id];
        return next;
      });
    } finally {
      clearAfterOneShot();
    }
  }

  async function checkInBooking(booking_id: string, room: string, profile_id: string, pin: string) {
    setLocalRooms((r) => ({ ...r, [booking_id]: room }));
    try {
      await fetch("/api/bookings/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id, room, pin_profile_id: profile_id, pin }),
      });
    } catch {
      setLocalRooms((r) => {
        const next = { ...r };
        delete next[booking_id];
        return next;
      });
    } finally {
      clearAfterOneShot();
    }
  }

  async function checkOutBooking(booking_id: string, treatment_done: string, profile_id: string, pin: string) {
    setLocalTreatments((t) => ({ ...t, [booking_id]: treatment_done }));
    setLocalMarks((m) => ({ ...m, [booking_id]: "attended" }));
    try {
      await fetch("/api/bookings/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id, treatment_done, pin_profile_id: profile_id, pin }),
      });
    } catch {
      setLocalTreatments((t) => {
        const next = { ...t };
        delete next[booking_id];
        return next;
      });
    } finally {
      clearAfterOneShot();
    }
  }

  // ── LOCKED LAYOUT ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col text-white overflow-hidden" style={parentStyle}>
      {bg}

      {/* Corner end-session — terminal full sign-out */}
      <button
        type="button"
        onClick={endSession}
        className="absolute top-4 right-4 z-10 text-[11px] uppercase tracking-wider text-white/60 hover:text-white px-3 py-1 rounded border border-white/20 hover:border-white/40 transition-colors"
      >
        End session
      </button>

      {/* Two-column hero — clock on the LEFT, upcoming patients on the RIGHT.
          The patient list is busier visually; keeping it on the right means
          the "rest area" (clock + sign-in CTAs) is what reads first. */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] min-h-0 overflow-hidden">
        {/* LEFT — clock + sign-in CTAs */}
        <div className="flex flex-col items-center justify-center px-6 py-8 text-center min-h-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.4em] text-white/60 mb-2">
            Clinic console
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-semibold mb-6 sm:mb-8 max-w-full truncate">
            {clinicName}
          </div>

          <div className="text-[14vw] sm:text-[12vw] md:text-[10vw] lg:text-[8vw] font-light tabular-nums leading-none tracking-tight">
            {hh}<span className="opacity-75">:</span>{mm}
          </div>
          <div className="mt-3 text-xs sm:text-sm md:text-base text-white/75">
            {weekday}
            {weekday && dateLine && <span className="mx-2 text-white/40">·</span>}
            {dateLine}
          </div>

          {/* Primary CTA — staff PIN sign-in */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setPinOpen(true)}
              className="bg-white text-stone-900 hover:bg-white/90 rounded-full px-7 py-2.5 text-sm font-medium shadow-xl"
            >
              Sign in (staff PIN)
            </button>
            <button
              type="button"
              onClick={() => setOwnerOpen(true)}
              className="text-[12px] text-white/70 hover:text-white underline-offset-2 hover:underline"
            >
              Owner sign-in →
            </button>
          </div>
        </div>

        {/* RIGHT — upcoming patients with quick attendance buttons */}
        <UpcomingPatientsPanel
          bookings={todayBookings}
          localMarks={localMarks}
          localRooms={localRooms}
          localTreatments={localTreatments}
          onMark={(booking_id, mark) => {
            setPendingMark({ booking_id, mark });
            setPinOpen(true);
          }}
          roomsEnabled={roomsEnabled}
          onCheckInRequest={(b) => setRoomPickerFor(b)}
          onCheckOutRequest={(b) => setTreatmentPickerFor(b)}
        />
      </div>

      {/* Counts strip — bottom band, full width */}
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl">
          <div className="grid grid-cols-4 divide-x divide-white/15">
            <CountTile
              label="Pending"
              value={counts.pending}
              attention="urgent"
              onClick={() => {
                setPendingNav("/nurse");
                setPendingAllowedRoles(["nurse"]);
                setPinOpen(true);
              }}
            />
            <CountTile
              label="Recalls due"
              value={counts.recalls}
              attention="notice"
              onClick={() => {
                setPendingNav("/staff/recalls");
                setPendingAllowedRoles(["nurse"]);
                setPinOpen(true);
              }}
            />
            <CountTile
              label="Today"
              value={counts.today}
              onClick={() => {
                setPendingNav("/nurse/all?day=today");
                setPendingAllowedRoles(["nurse"]);
                setPinOpen(true);
              }}
            />
            <CountTile
              label="Reminders"
              value={counts.reminders}
              attention="notice"
              onClick={() => {
                setPendingNav("/staff/reminders");
                setPendingAllowedRoles(["nurse"]);
                setPinOpen(true);
              }}
            />
          </div>
        </div>
        <p className="text-[10px] sm:text-[11px] text-white/55 text-center mt-3">
          Powered by <a href="https://kanan.my" target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: "#C9A227" }}>Kanan</a> · your trusted right hand
        </p>
      </div>

      {/* PIN modal — verifies + sets per-page lock-token cookie. Three
          possible intents: navigate (pendingNav, with per-tile allowedRoles),
          mark attendance (pendingMark, nurse-only), or just identify (no
          pending action — both nurse + doctor since doctors PIN-in for HR). */}
      <PinChallenge
        open={pinOpen}
        allowedRoles={
          pendingMark || pendingCheckIn
            ? ["nurse"]
            : pendingCheckOut
              ? ["doctor"]
              : pendingAllowedRoles
        }
        onClose={() => {
          setPinOpen(false);
          setPendingNav(null);
          setPendingAllowedRoles(undefined);
          setPendingMark(null);
          setPendingCheckIn(null);
          setPendingCheckOut(null);
        }}
        onVerified={async ({ profile_id, pin, full_name, role }) => {
          writePinSession({ profile_id, pin, full_name, role });
          await fetch("/api/pin/lock-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile_id, pin }),
          }).catch(() => {});
          setPinOpen(false);
          if (pendingMark) {
            const pm = pendingMark;
            setPendingMark(null);
            markAttendance(pm.booking_id, pm.mark, profile_id, pin);
          } else if (pendingCheckIn) {
            const pc = pendingCheckIn;
            setPendingCheckIn(null);
            checkInBooking(pc.booking_id, pc.room, profile_id, pin);
          } else if (pendingCheckOut) {
            const pc = pendingCheckOut;
            setPendingCheckOut(null);
            checkOutBooking(pc.booking_id, pc.treatment_done, profile_id, pin);
          } else if (pendingNav) {
            const dest = pendingNav;
            setPendingNav(null);
            setPendingAllowedRoles(undefined);
            router.push(dest);
          } else {
            setSession(readPinSession());
          }
        }}
      />

      {/* Premium room-flow modals — open BEFORE the PIN modal so the staff
          member picks the room / treatment first, then PINs in. */}
      <RoomPickerModal
        booking={roomPickerFor}
        rooms={rooms}
        onPick={(room) => {
          if (!roomPickerFor) return;
          setPendingCheckIn({ booking_id: roomPickerFor.id, room });
          setRoomPickerFor(null);
          setPinOpen(true);
        }}
        onClose={() => setRoomPickerFor(null)}
      />
      <TreatmentPickerModal
        booking={treatmentPickerFor}
        options={treatmentOptions}
        onPick={(treatment_done) => {
          if (!treatmentPickerFor) return;
          setPendingCheckOut({ booking_id: treatmentPickerFor.id, treatment_done });
          setTreatmentPickerFor(null);
          setPinOpen(true);
        }}
        onClose={() => setTreatmentPickerFor(null)}
      />

      {/* Owner sign-in — leaves terminal, sends to /login */}
      <OwnerSignInModal
        open={ownerOpen}
        onClose={() => setOwnerOpen(false)}
        onProceed={async () => {
          // Sign out terminal so the next page is /login.
          const supabase = createClient();
          await supabase.auth.signOut();
          router.replace("/login");
        }}
      />
    </div>
  );
}

function CountTile({
  label,
  value,
  onClick,
  attention,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  attention?: "urgent" | "notice";
}) {
  const showAlert = attention && value > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full relative px-3 py-4 sm:py-5 text-center first:rounded-l-2xl last:rounded-r-2xl hover:bg-white/5 transition-colors"
    >
      {showAlert && (
        <span
          aria-hidden
          className={`absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white shadow-md ring-2 ring-black/10 animate-pulse ${
            attention === "urgent" ? "bg-red-500" : "bg-amber-500"
          }`}
        >
          !
        </span>
      )}
      <div className="text-3xl sm:text-4xl font-light tabular-nums leading-none">{value}</div>
      <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70">
        {label}
      </div>
    </button>
  );
}

function OwnerSignInModal({
  open,
  onClose,
  onProceed,
}: {
  open: boolean;
  onClose: () => void;
  onProceed: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white text-stone-900 rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="text-base font-semibold mb-1">Owner sign-in</h3>
        <p className="text-xs text-stone-500 mb-4">
          You&apos;ll be signed out of the terminal and sent to the login screen, where you can enter your owner email + password.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onProceed} className="btn-primary flex-1">
            Continue
          </button>
          <button onClick={onClose} className="btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Left-column panel on the lockscreen — today's confirmed bookings as a
// scrollable list, each row showing time + patient + service + doctor + a
// pair of quick action buttons (Attended / No-show) that trigger the PIN
// modal. The list updates optimistically via localMarks.
function UpcomingPatientsPanel({
  bookings,
  localMarks,
  localRooms,
  localTreatments,
  onMark,
  roomsEnabled,
  onCheckInRequest,
  onCheckOutRequest,
}: {
  bookings: TodayBooking[];
  localMarks: Record<string, "attended" | "no_show" | "clear">;
  localRooms: Record<string, string>;
  localTreatments: Record<string, string>;
  onMark: (booking_id: string, mark: "attended" | "no_show") => void;
  roomsEnabled: boolean;
  onCheckInRequest: (b: TodayBooking) => void;
  onCheckOutRequest: (b: TodayBooking) => void;
}) {
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  // Group bookings by day for a clear "Today / Tomorrow / <date>" divider.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayLabel = (iso: string) => {
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  };

  // Once a booking is marked (attended / no-show / checked-out), it's
  // "settled" — no further action needed from the front desk. Settled rows
  // get hidden behind a collapsible bar so the list focuses on patients who
  // still need attention. Premium check-in (in-room) is NOT settled — the
  // patient is still in the clinic and the doctor hasn't checked them out.
  function settledStatus(b: TodayBooking): "attended" | "no_show" | null {
    if (localMarks[b.id] === "attended" || b.attended) return "attended";
    if (localMarks[b.id] === "no_show" || b.no_show) return "no_show";
    return null;
  }
  const active = bookings.filter((b) => !settledStatus(b));
  const settled = bookings.filter((b) => settledStatus(b));
  const [showSettled, setShowSettled] = useState(false);

  let lastDay = "";
  const renderRow = (b: TodayBooking) => {
            const status =
              localMarks[b.id] === "attended" || b.attended
                ? "attended"
                : localMarks[b.id] === "no_show" || b.no_show
                  ? "no_show"
                  : "pending";
            const t = new Date(b.slot_start);
            const hh = String(t.getHours()).padStart(2, "0");
            const mm = String(t.getMinutes()).padStart(2, "0");
            const slotMs = t.getTime();
            const isPast = slotMs < now;
            const isImminent =
              status === "pending" && slotMs >= now && slotMs - now <= ONE_HOUR_MS;
            const isActionable =
              status === "pending" && (slotMs <= now || slotMs - now <= THIRTY_MIN_MS);
            const thisDay = dayLabel(b.slot_start);
            const showDayHeader = thisDay !== lastDay;
            if (showDayHeader) lastDay = thisDay;
            return (
              <div key={b.id}>
              {showDayHeader && (
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-medium mt-3 first:mt-0 mb-1.5">
                  {thisDay}
                </div>
              )}
              <div
                className={`rounded-xl border transition-all ${
                  status === "attended"
                    ? "bg-emerald-400/15 border-emerald-300/30 px-3 py-2.5"
                    : status === "no_show"
                      ? "bg-red-400/15 border-red-300/30 px-3 py-2.5"
                      : isImminent
                        ? "bg-white/20 border-amber-300/60 ring-2 ring-amber-300/40 shadow-lg px-3.5 py-3"
                        : isPast
                          ? "bg-amber-400/10 border-amber-300/25 px-3 py-2.5"
                          : "bg-white/8 border-white/15 px-3 py-2.5"
                }`}
              >
                {isImminent && (
                  <div className="text-[9px] uppercase tracking-[0.25em] text-amber-200 font-semibold mb-1">
                    ⚡ Up next
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={`tabular-nums leading-none pt-0.5 ${
                      isImminent ? "text-xl font-medium w-14" : "text-base font-light w-12"
                    }`}
                  >
                    {hh}<span className="opacity-60">:</span>{mm}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium leading-tight truncate ${isImminent ? "text-base" : "text-sm"}`}>
                      {b.patient_name}
                    </div>
                    {b.patient_id_label && (
                      <div className="text-[10px] text-white/55 font-mono tabular-nums truncate">
                        {b.patient_id_label}
                      </div>
                    )}
                    <div className="text-[11px] text-white/70 truncate">
                      {b.service || "—"} · {b.doctor_name}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  {/* Premium room flow — replaces Attended button with
                      Check-in → Room badge → Check-out. No-show keeps the
                      same fast path (Premium clinics still need to clear
                      pending no-shows from the dashboard). */}
                  {roomsEnabled ? (
                    <PremiumActionRow
                      booking={b}
                      status={status}
                      isActionable={isActionable}
                      isPast={isPast}
                      currentRoom={localRooms[b.id] ?? b.room ?? null}
                      currentTreatment={localTreatments[b.id] ?? b.treatment_done ?? null}
                      onCheckIn={() => onCheckInRequest(b)}
                      onCheckOut={() => onCheckOutRequest(b)}
                      onNoShow={() => onMark(b.id, "no_show")}
                    />
                  ) : (
                    <>
                      {status === "attended" && (
                        <span className="text-[11px] text-emerald-200 font-medium">✓ Attended</span>
                      )}
                      {status === "no_show" && (
                        <span className="text-[11px] text-red-200 font-medium">✕ No-show</span>
                      )}
                      {status === "pending" && (
                        <span className="text-[10px] text-white/50">
                          {isActionable
                            ? (isPast ? "Past — needs marking" : "Awaiting check-in")
                            : isPast
                              ? "Past — needs marking"
                              : "Scheduled"}
                        </span>
                      )}
                      {isActionable && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onMark(b.id, "attended")}
                            className="bg-emerald-500/80 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
                          >
                            Attended
                          </button>
                          <button
                            type="button"
                            onClick={() => onMark(b.id, "no_show")}
                            className="bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
                          >
                            No-show
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </div>
            );
          };

  return (
    <div className="flex flex-col min-h-0 px-4 pt-6 pb-3 sm:px-6 sm:pt-8 sm:pb-4">
      <h3 className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-white/60 font-medium mb-3 flex items-baseline gap-2">
        <span>Upcoming patients</span>
        <span className="text-[10px] text-white/45 tabular-nums tracking-normal normal-case">
          · {active.length} active
          {settled.length > 0 && <span className="text-white/35"> · {settled.length} done</span>}
        </span>
      </h3>
      {bookings.length === 0 ? (
        <p className="text-xs text-white/60 italic">Nothing in the next 48 hours.</p>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin-dark -mx-2 px-2 space-y-2">
          {active.length === 0 ? (
            <p className="text-xs text-white/60 italic mt-1">
              All caught up — every booking has been marked.
            </p>
          ) : (
            active.map(renderRow)
          )}

          {/* Collapsible settled section — keeps the focus on patients who
              still need action. Clicking the bar expands the list inline. */}
          {settled.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowSettled((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
              >
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-medium">
                  {showSettled ? "▾" : "▸"} Marked
                </span>
                <span className="text-[10px] text-white/50 tabular-nums">
                  {settled.filter((b) => settledStatus(b) === "attended").length} attended
                  {" · "}
                  {settled.filter((b) => settledStatus(b) === "no_show").length} no-show
                </span>
              </button>
              {showSettled && (() => {
                // Reset the day divider so the settled list also paginates by day.
                lastDay = "";
                return (
                  <div className="mt-2 space-y-2">
                    {settled.map(renderRow)}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-white/40 mt-3">
        {roomsEnabled
          ? "Nurse PIN to check in · doctor PIN to check out."
          : "Tap a button — PIN required to mark attendance."}
      </p>
    </div>
  );
}

// Premium action row — replaces Attended button with a 3-stage flow:
//   1. PENDING (not in a room): "Check in" button + "No-show" button
//   2. IN ROOM: badge showing "Room X · Checked in HH:MM" + "Check out" button
//   3. DONE: "✓ Done · {treatment}" line.
// Past pending bookings still get No-show in case the clinic forgot.
function PremiumActionRow({
  booking,
  status,
  isActionable,
  isPast,
  currentRoom,
  currentTreatment,
  onCheckIn,
  onCheckOut,
  onNoShow,
}: {
  booking: TodayBooking;
  status: "attended" | "no_show" | "pending";
  isActionable: boolean;
  isPast: boolean;
  currentRoom: string | null;
  currentTreatment: string | null;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onNoShow: () => void;
}) {
  if (status === "no_show") {
    return <span className="text-[11px] text-red-200 font-medium">✕ No-show</span>;
  }
  // checked out → done line wins over generic "Attended"
  if (currentTreatment || (status === "attended" && booking.checked_out_at)) {
    return (
      <span className="text-[11px] text-emerald-200 font-medium truncate">
        ✓ Done{currentTreatment ? ` · ${currentTreatment}` : ""}
      </span>
    );
  }
  // checked in but not yet checked out → room badge + Check out
  if (currentRoom) {
    return (
      <div className="flex items-center justify-between gap-2 w-full flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-300/40 text-blue-100 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse" />
          In {currentRoom}
        </span>
        <button
          type="button"
          onClick={onCheckOut}
          className="bg-emerald-500/80 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
        >
          Check out
        </button>
      </div>
    );
  }
  // attended (legacy / pre-Premium row but no room set) → keep the simple chip
  if (status === "attended") {
    return <span className="text-[11px] text-emerald-200 font-medium">✓ Attended</span>;
  }
  // pending — show check-in CTA when actionable
  return (
    <>
      <span className="text-[10px] text-white/50">
        {isActionable
          ? (isPast ? "Past — needs marking" : "Awaiting check-in")
          : isPast
            ? "Past — needs marking"
            : "Scheduled"}
      </span>
      {isActionable && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCheckIn}
            className="bg-blue-500/80 hover:bg-blue-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
          >
            Check in
          </button>
          <button
            type="button"
            onClick={onNoShow}
            className="bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
          >
            No-show
          </button>
        </div>
      )}
    </>
  );
}

function RoomPickerModal({
  booking,
  rooms,
  onPick,
  onClose,
}: {
  booking: TodayBooking | null;
  rooms: string[];
  onPick: (room: string) => void;
  onClose: () => void;
}) {
  if (!booking) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white text-stone-900 rounded-2xl shadow-2xl w-full max-w-md p-5">
        <h3 className="text-base font-semibold mb-1">Assign a room</h3>
        <p className="text-xs text-stone-500 mb-4">
          <strong>{booking.patient_name}</strong> · {booking.service} · {booking.doctor_name}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {rooms.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onPick(r)}
              className="px-3 py-3 rounded-lg border border-stone-200 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-left transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-xs text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TreatmentPickerModal({
  booking,
  options,
  onPick,
  onClose,
}: {
  booking: TodayBooking | null;
  options: string[];
  onPick: (treatment: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  if (!booking) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white text-stone-900 rounded-2xl shadow-2xl w-full max-w-md p-5">
        <h3 className="text-base font-semibold mb-1">What was done?</h3>
        <p className="text-xs text-stone-500 mb-4">
          <strong>{booking.patient_name}</strong> · {booking.doctor_name}
          {booking.room && <span> · {booking.room}</span>}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {options.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              className="px-3 py-2.5 rounded-lg border border-stone-200 hover:border-emerald-400 hover:bg-emerald-50 text-sm text-left transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
        <div className="border-t border-stone-100 pt-3">
          <label className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">
            Or describe it
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              className="input flex-1 text-sm"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. composite filling on #16"
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) onPick(custom.trim());
              }}
            />
            <button
              type="button"
              onClick={() => custom.trim() && onPick(custom.trim())}
              disabled={!custom.trim()}
              className="btn-primary text-xs disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
        <button onClick={onClose} className="mt-4 text-xs text-stone-500 hover:text-stone-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
