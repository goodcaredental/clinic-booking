// Preset themes for the clinic-terminal lockscreen.
//
// Each preset is a CSS `background-image` value applied to the lockscreen
// container. When a custom photo URL is also set, the photo wins — but its
// preset is still used to colour the dark overlay tint so text on top stays
// legible regardless of the underlying image.

import { createAdminClient } from "@/lib/supabase-admin";

export type TerminalThemeName = "navy" | "midnight" | "dawn" | "sage" | "mono";

export type TerminalTheme = {
  name: TerminalThemeName;
  label: string;
  description: string;
  // CSS gradient used when no custom background photo is uploaded.
  gradient: string;
  // rgba overlay colours used when a custom photo IS uploaded — gives the
  // photo a brand-matched tint and keeps the clock readable.
  overlayTop: string;
  overlayBottom: string;
  // Hex of the small accent rail at the top.
  accent: string;
  // Staff backend tints — used by StaffShell when this theme is active.
  staffBg: string;        // overall page background (very subtle tint)
  staffAccent: string;    // active nav border, top header rail
  staffAccentSoft: string;// active nav background tint
  staffActiveText: string;// active nav label color
  staffHeaderBg: string;  // top header band background (matches console)
};

export const TERMINAL_THEMES: Record<TerminalThemeName, TerminalTheme> = {
  navy: {
    name: "navy",
    label: "Kanan navy",
    description: "Default — deep navy with a warm gold hint. Matches the Kanan brand.",
    gradient: "linear-gradient(135deg, #1B2A4A 0%, #2B3F70 60%, #C9A227 220%)",
    overlayTop: "rgba(27,42,74,0.55)",
    overlayBottom: "rgba(27,42,74,0.80)",
    accent: "#C9A227",
    staffBg: "#F4F1EA",
    staffAccent: "#C9A227",
    staffAccentSoft: "#FBF6E5",
    staffActiveText: "#1B2A4A",
    staffHeaderBg: "linear-gradient(90deg, #1B2A4A 0%, #2B3F70 100%)",
  },
  midnight: {
    name: "midnight",
    label: "Midnight",
    description: "Quieter, pure deep blue — no gold accent. Reads as serious / clinical.",
    gradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #334155 130%)",
    overlayTop: "rgba(15,23,42,0.55)",
    overlayBottom: "rgba(15,23,42,0.85)",
    accent: "#64748B",
    staffBg: "#F1F5F9",
    staffAccent: "#475569",
    staffAccentSoft: "#E2E8F0",
    staffActiveText: "#0F172A",
    staffHeaderBg: "linear-gradient(90deg, #0F172A 0%, #1E293B 100%)",
  },
  dawn: {
    name: "dawn",
    label: "Dawn",
    description: "Warm sunrise — terracotta into deep navy. Friendlier, less corporate.",
    gradient: "linear-gradient(135deg, #5B2A1F 0%, #8B3A1F 35%, #1B2A4A 100%)",
    overlayTop: "rgba(40,20,15,0.50)",
    overlayBottom: "rgba(20,15,30,0.80)",
    accent: "#E08855",
    staffBg: "#FFF7ED",
    staffAccent: "#C2410C",
    staffAccentSoft: "#FFEDD5",
    staffActiveText: "#7C2D12",
    staffHeaderBg: "linear-gradient(90deg, #5B2A1F 0%, #8B3A1F 100%)",
  },
  sage: {
    name: "sage",
    label: "Sage",
    description: "Muted green into navy. Soft, easy on the eyes during long shifts.",
    gradient: "linear-gradient(135deg, #2D4A3E 0%, #4A6B5D 50%, #1B2A4A 100%)",
    overlayTop: "rgba(20,40,30,0.50)",
    overlayBottom: "rgba(20,30,45,0.80)",
    accent: "#7BA88A",
    staffBg: "#F0FDF4",
    staffAccent: "#15803D",
    staffAccentSoft: "#DCFCE7",
    staffActiveText: "#14532D",
    staffHeaderBg: "linear-gradient(90deg, #2D4A3E 0%, #4A6B5D 100%)",
  },
  mono: {
    name: "mono",
    label: "Monochrome",
    description: "Black into charcoal. Minimalist — works well with any uploaded photo.",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 60%, #333333 130%)",
    overlayTop: "rgba(0,0,0,0.50)",
    overlayBottom: "rgba(0,0,0,0.80)",
    accent: "#737373",
    staffBg: "#F5F5F5",
    staffAccent: "#404040",
    staffAccentSoft: "#E5E5E5",
    staffActiveText: "#171717",
    staffHeaderBg: "linear-gradient(90deg, #0A0A0A 0%, #1F1F1F 100%)",
  },
};

// CSS variables exposed to all staff UI screens. Loaded at <html> root by
// app/layout.tsx so any component can use them (StaffShell, badges, etc.).
export function themeToCss(theme: TerminalTheme): string {
  return `
    :root {
      --staff-bg: ${theme.staffBg};
      --staff-accent: ${theme.staffAccent};
      --staff-accent-soft: ${theme.staffAccentSoft};
      --staff-active-text: ${theme.staffActiveText};
      --staff-header-bg: ${theme.staffHeaderBg};
    }
  `.trim();
}

export const DEFAULT_THEME: TerminalThemeName = "navy";

export function getTheme(name: string | null | undefined): TerminalTheme {
  if (name && name in TERMINAL_THEMES) return TERMINAL_THEMES[name as TerminalThemeName];
  return TERMINAL_THEMES[DEFAULT_THEME];
}

export type TerminalLockscreenConfig = {
  theme: TerminalTheme;
};

// Custom background photos were removed — clinics use the theme presets only.
// The terminal_background_url column stays in the DB for now (harmless) but
// isn't read anywhere in the app.
export async function loadTerminalConfig(): Promise<TerminalLockscreenConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("clinic_settings")
      .select("terminal_theme")
      .eq("id", true)
      .maybeSingle();
    return { theme: getTheme(data?.terminal_theme) };
  } catch {
    return { theme: getTheme(null) };
  }
}
