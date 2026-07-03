import { requireStaff } from "@/lib/auth";
import { StaffShell } from "@/components/StaffShell";
import { staffNav } from "@/lib/staff-nav";
import { loadBranding } from "@/lib/branding-server";
import { loadTerminalConfig } from "@/lib/terminal-theme";
import BrandingEditor from "./BrandingEditor";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const { profile } = await requireStaff(["owner"]);
  const branding = await loadBranding();
  const terminalCfg = await loadTerminalConfig();
  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Your Clinic";

  return (
    <StaffShell role="owner" userName={profile.full_name} nav={await staffNav(profile.role)}>
      <h2 className="text-base font-medium mb-1">Branding &amp; theme</h2>
      <p className="text-xs text-stone-500 mb-4">
        Customise how the booking page looks. Changes apply across the system instantly — no rebuild needed.
        Refresh after saving to see the new theme everywhere.
      </p>
      <BrandingEditor
        initial={{
          ...branding,
          terminal_theme: terminalCfg.theme.name,
        }}
        clinicName={clinicName}
      />
    </StaffShell>
  );
}
