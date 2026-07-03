import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { StaffShell } from "@/components/StaffShell";
import { staffNav } from "@/lib/staff-nav";
import { loadPlan } from "@/lib/branding-server";
import { loadTerminalConfig } from "@/lib/terminal-theme";
import HomeLauncher from "./HomeLauncher";
import ClinicConsole from "./ClinicConsole";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function HomePage() {
  const { user, profile } = await requireStaff(["nurse", "owner", "doctor", "terminal"]);
  const admin = createAdminClient();

  // Counts useful for any role's home cards
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 24 * 3600 * 1000));
  const todayStart = new Date(today + "T00:00:00").toISOString();
  const todayEnd = new Date(today + "T23:59:59").toISOString();
  const tomorrowStart = new Date(tomorrow + "T00:00:00").toISOString();
  const tomorrowEnd = new Date(tomorrow + "T23:59:59").toISOString();

  // Pending count (nurse + owner)
  const { count: pendingCount } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Today's confirmed bookings count
  let todayQuery = admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .gte("slot_start", todayStart)
    .lte("slot_start", todayEnd);
  // For doctor, scope to own
  if (profile.role === "doctor") {
    const { data: doc } = await admin.from("doctors").select("id").eq("profile_id", user.id).maybeSingle();
    if (doc) todayQuery = todayQuery.eq("doctor_id", doc.id);
  }
  const { count: todayCount } = await todayQuery;

  // Tomorrow's bookings that haven't had reminder sent (nurse + owner)
  const { count: remindersPendingCount } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .gte("slot_start", tomorrowStart)
    .lte("slot_start", tomorrowEnd)
    .is("reminder_sent_at", null);

  // Pending leave + shift requests (owner)
  const { count: pendingLeavesCount } = await admin
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: pendingShiftsCount } = await admin
    .from("duty_shifts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Past-unmarked attendance (nurse follow-up)
  const { count: pastUnmarkedCount } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .lt("slot_start", new Date().toISOString())
    .is("attended_at", null)
    .eq("no_show", false);

  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "the clinic";
  const plan = await loadPlan();

  // Terminal mode — lockscreen kiosk. Bypasses StaffShell so the clock
  // fills the full viewport.
  if (profile.role === "terminal") {
    // Recalls due (computed in app code: months-since-visit >= recall_interval)
    const { data: recallRows } = await admin
      .from("patients")
      .select("id, last_visit_at, recall_interval_months, recall_reminder_sent_at")
      .not("last_visit_at", "is", null)
      .is("recall_reminder_sent_at", null);
    const nowMs = Date.now();
    const recallsDue = (recallRows || []).filter((p) => {
      const lastMs = p.last_visit_at ? new Date(p.last_visit_at).getTime() : 0;
      const monthsSince = (nowMs - lastMs) / (30 * 24 * 3600 * 1000);
      return monthsSince >= (p.recall_interval_months || 6);
    }).length;

    // Today's confirmed bookings — left panel on the lockscreen shows the
    // upcoming list with quick attendance buttons. Limit to 12 visible rows.
    // Upcoming confirmed bookings — start-of-today through 48 hours from now.
    // Using "from now" was excluding morning-today bookings when the user
    // checked the dashboard in the afternoon (Vercel runs UTC + clinic data
    // is MYT, so the math was off). Show all of today + the next ~2 days.
    const todayStartMs = new Date();
    todayStartMs.setHours(0, 0, 0, 0);
    const horizonStart = todayStartMs.toISOString();
    const horizonEnd = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const { data: todayList, error: todayErr } = await admin
      .from("bookings")
      .select(
        "id, slot_start, slot_end, visit_reason, attended_at, no_show, room, checked_in_at, checked_out_at, treatment_done, patient:patients(full_name, id_type, id_number), doctor:doctors(display_name)"
      )
      .eq("status", "confirmed")
      .gte("slot_start", horizonStart)
      .lte("slot_start", horizonEnd)
      .order("slot_start");
    if (todayErr) console.error("upcoming bookings query failed:", todayErr.message);

    const terminalCfg = await loadTerminalConfig();
    const { loadPremiumConfig } = await import("@/lib/premium-config");
    const { hasFeature } = await import("@/lib/plan");
    const premiumCfg = await loadPremiumConfig();
    const roomsEnabled = hasFeature(plan, "rooms");
    return (
      <ClinicConsole
        clinicName={clinicName}
        theme={terminalCfg.theme}
        counts={{
          pending: pendingCount || 0,
          recalls: recallsDue,
          today: todayCount || 0,
          reminders: remindersPendingCount || 0,
        }}
        todayBookings={(todayList || []).map((b) => {
          const pat = b.patient as { full_name?: string; id_type?: "ic" | "passport"; id_number?: string } | null;
          return {
            id: b.id,
            slot_start: b.slot_start,
            service: b.visit_reason || "—",
            attended: !!b.attended_at,
            no_show: !!b.no_show,
            patient_name: pat?.full_name || "—",
            patient_id_label: pat?.id_number
              ? `${pat.id_type === "ic" ? "IC" : "Passport"} ${pat.id_number}`
              : null,
            doctor_name: (b.doctor as { display_name?: string } | null)?.display_name || "—",
            room: b.room || null,
            checked_in_at: b.checked_in_at || null,
            checked_out_at: b.checked_out_at || null,
            treatment_done: b.treatment_done || null,
          };
        })}
        roomsEnabled={roomsEnabled}
        rooms={premiumCfg.rooms}
        treatmentOptions={premiumCfg.treatmentOptions}
      />
    );
  }

  // Owner gets two extra summaries — today-on-the-floor + this-week pulse
  let doctorsToday: Array<{ id: string; name: string; count: number }> = [];
  let weekPulse: {
    thisWeek: number;
    lastWeek: number;
    deltaPct: number | null;
    newPatients: number;
  } | null = null;
  if (profile.role === "owner") {
    const startOfThisWeek = new Date();
    startOfThisWeek.setDate(startOfThisWeek.getDate() - 7);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const [todayBookingsRes, doctorsRes, weekRes, lastWeekRes, newPatientsRes] = await Promise.all([
      admin
        .from("bookings")
        .select("doctor_id, attended_at, no_show")
        .eq("status", "confirmed")
        .gte("slot_start", todayStart)
        .lte("slot_start", todayEnd),
      admin.from("doctors").select("id, display_name").eq("active", true),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfThisWeek.toISOString()),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfLastWeek.toISOString())
        .lt("created_at", startOfThisWeek.toISOString()),
      admin
        .from("patients")
        .select("id", { count: "exact", head: true })
        .gte("first_seen_at", startOfThisWeek.toISOString()),
    ]);
    const docName = new Map<string, string>();
    (doctorsRes.data || []).forEach((d) => docName.set(d.id, d.display_name));
    const docCount = new Map<string, number>();
    (todayBookingsRes.data || []).forEach((b) => {
      if (b.doctor_id) docCount.set(b.doctor_id, (docCount.get(b.doctor_id) || 0) + 1);
    });
    doctorsToday = Array.from(docCount.entries())
      .map(([id, count]) => ({ id, name: docName.get(id) || "Doctor", count }))
      .sort((a, b) => b.count - a.count);

    const tw = weekRes.count || 0;
    const lw = lastWeekRes.count || 0;
    weekPulse = {
      thisWeek: tw,
      lastWeek: lw,
      deltaPct: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : null,
      newPatients: newPatientsRes.count || 0,
    };
  }

  return (
    <StaffShell
      role={profile.role as "owner" | "nurse" | "doctor"}
      userName={profile.full_name}
      nav={await staffNav(profile.role, pendingCount || 0)}
    >
      <HomeLauncher
        role={profile.role as "nurse" | "owner" | "doctor"}
        userName={profile.full_name}
        clinicName={clinicName}
        plan={plan}
        counts={{
          pending: pendingCount || 0,
          today: todayCount || 0,
          remindersPending: remindersPendingCount || 0,
          pendingLeaves: pendingLeavesCount || 0,
          pendingShifts: pendingShiftsCount || 0,
          pastUnmarked: pastUnmarkedCount || 0,
        }}
        doctorsToday={doctorsToday}
        weekPulse={weekPulse}
      />
    </StaffShell>
  );
}
