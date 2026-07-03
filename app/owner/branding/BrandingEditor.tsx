"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Branding = {
  primary_color: string;
  font_family: string;
  button_radius: "sharp" | "rounded" | "pill";
  logo_url: string | null;
  terminal_theme: "navy" | "midnight" | "dawn" | "sage" | "mono";
};

// Mirrors lib/terminal-theme.ts — kept here for the live preview chip
// without having to import server-only code into the editor.
// Per-theme tints used by the staff backend preview — mirrors
// lib/terminal-theme.ts's staffBg / staffAccentSoft / staffActiveText so
// the mini preview really looks like the deployed UI.
const STAFF_TINTS: Record<Branding["terminal_theme"], { bg: string; accentSoft: string; activeText: string }> = {
  navy:     { bg: "#F4F1EA", accentSoft: "#FBF6E5", activeText: "#1B2A4A" },
  midnight: { bg: "#F1F5F9", accentSoft: "#E2E8F0", activeText: "#0F172A" },
  dawn:     { bg: "#FFF7ED", accentSoft: "#FFEDD5", activeText: "#7C2D12" },
  sage:     { bg: "#F0FDF4", accentSoft: "#DCFCE7", activeText: "#14532D" },
  mono:     { bg: "#F5F5F5", accentSoft: "#E5E5E5", activeText: "#171717" },
};
function getStaffBg(t: Branding["terminal_theme"]) { return STAFF_TINTS[t]?.bg || "#F4F1EA"; }
function getStaffAccentSoft(t: Branding["terminal_theme"]) { return STAFF_TINTS[t]?.accentSoft || "#FBF6E5"; }
function getStaffActiveText(t: Branding["terminal_theme"]) { return STAFF_TINTS[t]?.activeText || "#1B2A4A"; }

const TERMINAL_THEME_OPTIONS: Array<{
  value: Branding["terminal_theme"];
  label: string;
  description: string;
  gradient: string;
  accent: string;
}> = [
  { value: "navy",     label: "Kanan navy",  description: "Default — deep navy + gold accent",
    gradient: "linear-gradient(135deg, #1B2A4A 0%, #2B3F70 60%, #C9A227 220%)", accent: "#C9A227" },
  { value: "midnight", label: "Midnight",    description: "Pure deep blue, no gold tint",
    gradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #334155 130%)", accent: "#64748B" },
  { value: "dawn",     label: "Dawn",        description: "Warm terracotta → navy",
    gradient: "linear-gradient(135deg, #5B2A1F 0%, #8B3A1F 35%, #1B2A4A 100%)", accent: "#E08855" },
  { value: "sage",     label: "Sage",        description: "Muted green → navy",
    gradient: "linear-gradient(135deg, #2D4A3E 0%, #4A6B5D 50%, #1B2A4A 100%)", accent: "#7BA88A" },
  { value: "mono",     label: "Monochrome",  description: "Black → charcoal, minimalist",
    gradient: "linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 60%, #333333 130%)", accent: "#737373" },
];

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter — clean modern (default)" },
  { value: "Roboto", label: "Roboto — friendly sans-serif" },
  { value: "Open Sans", label: "Open Sans — highly readable" },
  { value: "Poppins", label: "Poppins — geometric, energetic" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans — modern, soft" },
  { value: "Lora", label: "Lora — elegant serif" },
  { value: "Merriweather", label: "Merriweather — classic serif" },
  { value: "system-ui", label: "System default — fastest" },
];

const RADIUS_OPTIONS: Array<{ value: Branding["button_radius"]; label: string; preview: string }> = [
  { value: "sharp", label: "Sharp", preview: "0px" },
  { value: "rounded", label: "Rounded", preview: "6px" },
  { value: "pill", label: "Pill", preview: "9999px" },
];

const COLOR_PRESETS = [
  { name: "Dental teal", hex: "#0d9488" },
  { name: "Trust blue", hex: "#1d4ed8" },
  { name: "Medical green", hex: "#059669" },
  { name: "Warm coral", hex: "#dc2626" },
  { name: "Sunset orange", hex: "#ea580c" },
  { name: "Royal purple", hex: "#7c3aed" },
  { name: "Charcoal", hex: "#1f2937" },
  { name: "Rose pink", hex: "#e11d48" },
];

function darken(hex: string, amount = 0.15): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const dr = Math.max(0, Math.floor(r * (1 - amount)));
  const dg = Math.max(0, Math.floor(g * (1 - amount)));
  const db = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount = 0.92): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lr = Math.min(255, Math.floor(r + (255 - r) * amount));
  const lg = Math.min(255, Math.floor(g + (255 - g) * amount));
  const lb = Math.min(255, Math.floor(b + (255 - b) * amount));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

export default function BrandingEditor({
  initial,
  clinicName,
}: {
  initial: Branding;
  clinicName: string;
}) {
  const router = useRouter();
  const [color, setColor] = useState(initial.primary_color);
  const [font, setFont] = useState(initial.font_family);
  const [radius, setRadius] = useState<Branding["button_radius"]>(initial.button_radius);
  const [logo, setLogo] = useState(initial.logo_url || "");
  const [terminalTheme, setTerminalTheme] = useState<Branding["terminal_theme"]>(initial.terminal_theme || "navy");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const darkColor = darken(color, 0.15);
  const lightColor = lighten(color, 0.92);
  const radiusPx =
    radius === "sharp" ? "0px" : radius === "pill" ? "9999px" : "6px";

  // Dynamically load the previewed font's stylesheet on dropdown change so the
  // live preview actually renders with that face (otherwise the browser falls
  // back to system-ui because only the saved font is loaded by the layout).
  useEffect(() => {
    const safeStacks = ["system-ui", "sans-serif", "serif"];
    if (safeStacks.includes(font)) return;
    const id = `preview-font-${font.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [font]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_color: color,
          font_family: font,
          button_radius: radius,
          logo_url: logo.trim() || null,
          terminal_theme: terminalTheme,
          // Wipe any pre-existing custom background — the theme presets
          // are now the only lockscreen backdrop, so this setting is deprecated.
          terminal_background_url: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Failed to save" });
        return;
      }
      setMsg({ type: "ok", text: "Saved. Refresh to see changes everywhere." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Look up the gradient string for the currently-selected terminal theme so
  // the homepage preview matches what the staff backend will look like.
  const activeTheme = TERMINAL_THEME_OPTIONS.find((o) => o.value === terminalTheme) || TERMINAL_THEME_OPTIONS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Editor controls */}
      <div className="space-y-4">
        {/* Theme is the umbrella setting — drives lockscreen, staff backend,
            and the booking-page accent rail in one go. Lives at the top so
            the owner picks the overall feel first, then fine-tunes the
            patient-facing booking page below. */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Overall theme</h3>
          <p className="text-[11px] text-stone-500 -mt-1">
            Drives the staff backend (page tint, top header band, active nav highlight, accent rail), the clinic-terminal lockscreen, and the accent rail on the patient booking page — pick one and the whole app restyles. Optionally drop in a photo URL — used only on the terminal lockscreen, auto-blurred so the clock stays readable.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TERMINAL_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTerminalTheme(opt.value)}
                className={`relative text-left p-3 border rounded-lg transition-colors overflow-hidden ${
                  terminalTheme === opt.value
                    ? "border-stone-900 ring-2 ring-stone-900/20"
                    : "border-stone-200 hover:border-stone-400"
                }`}
                style={{ backgroundImage: opt.gradient, backgroundSize: "cover" }}
              >
                <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: opt.accent }} />
                <div className="text-xs font-medium text-white drop-shadow">{opt.label}</div>
                <div className="text-[10px] text-white/80 drop-shadow mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium px-1 pt-2">
          Patient booking page
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Primary colour</h3>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-14 h-10 rounded border border-stone-200 cursor-pointer"
            />
            <input
              type="text"
              className="input max-w-[140px] font-mono"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              maxLength={7}
            />
            <span className="text-xs text-stone-500">e.g. #0d9488</span>
          </div>
          <div>
            <p className="text-[11px] text-stone-500 mb-1.5">Quick picks</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setColor(p.hex)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-stone-200 hover:border-stone-400 bg-white"
                  title={p.name}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.hex }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Font</h3>
          <select
            className="input"
            value={font}
            onChange={(e) => setFont(e.target.value)}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Button shape</h3>
          <div className="grid grid-cols-3 gap-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRadius(opt.value)}
                className={`p-3 text-sm border transition-colors ${
                  radius === opt.value
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 hover:border-stone-400"
                }`}
                style={{ borderRadius: opt.preview }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Logo (optional)</h3>
          <input
            type="url"
            className="input"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          <p className="text-[11px] text-stone-500">
            Paste a direct link to your logo image. PNG with transparent background, ~200px square works
            best. Leave blank to show the clinic name as text.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save branding"}
          </button>
          {msg && (
            <span className={`text-xs ${msg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {/* Live preview — sticky on lg+ so it follows the editor scroll. */}
      <div className="space-y-3 lg:sticky lg:top-[60px] self-start">
        <h3 className="text-sm font-medium text-stone-600 uppercase tracking-wider">Live preview</h3>

        {/* Staff backend preview — drives by the chosen theme. Shows the
            header band, accent rail, page tint, and an active-nav row so the
            owner can see how /home + sidebar will look. */}
        <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">
              Staff backend
            </span>
            <span className="text-[10px] text-stone-400">{activeTheme.label}</span>
          </div>
          {/* Themed accent rail */}
          <div className="h-[3px]" style={{ background: activeTheme.accent }} />
          {/* Header band */}
          <div
            className="px-3 py-2 text-white text-[11px] font-medium flex items-center justify-between"
            style={{ background: activeTheme.gradient }}
          >
            <span>Clinic Console · {clinicName}</span>
            <span className="text-white/70 text-[10px]">Sign out</span>
          </div>
          {/* Page area with two nav-row examples on a tinted background */}
          <div className="p-3 space-y-1" style={{ background: getStaffBg(terminalTheme) }}>
            <div
              className="px-3 py-1.5 text-[11px] font-medium rounded flex items-center justify-between"
              style={{
                background: getStaffAccentSoft(terminalTheme),
                color: getStaffActiveText(terminalTheme),
                borderLeft: `2px solid ${activeTheme.accent}`,
                paddingLeft: "10px",
              }}
            >
              <span>Pending</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">3</span>
            </div>
            <div className="px-3 py-1.5 text-[11px] text-stone-600">All bookings</div>
            <div className="px-3 py-1.5 text-[11px] text-stone-600">Patients</div>
          </div>
        </div>

        <p className="text-[11px] text-stone-500">
          ↓ Patient-facing booking page below.
        </p>

        <div
          className="border border-stone-200 rounded-xl overflow-hidden shadow-sm"
          style={{
            fontFamily: `"${font}", system-ui, sans-serif`,
            backgroundColor: "#fafaf7",
          }}
        >
          {/* Accent rail at the top of the booking page (mirrors /book) */}
          <div className="h-[3px]" style={{ background: activeTheme.accent }} />
          <div className="px-6 py-5 text-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={clinicName}
                className="mx-auto mb-2 max-h-14 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <h1
              className="text-2xl font-medium tracking-tight"
              style={{ color: "#1a1a1a" }}
            >
              {clinicName}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#78716c" }}>
              Appointment booking
            </p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 m-4 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                style={{
                  background: color,
                  color: "#fff",
                  borderRadius: radiusPx,
                  fontFamily: "inherit",
                }}
                className="p-2 text-xs font-medium"
              >
                Booking
              </button>
              <button
                style={{
                  background: "#fff",
                  color: "#1a1a1a",
                  border: "1px solid #e7e5e4",
                  borderRadius: radiusPx,
                  fontFamily: "inherit",
                }}
                className="p-2 text-xs"
              >
                Reschedule
              </button>
              <button
                style={{
                  background: "#fff",
                  color: "#1a1a1a",
                  border: "1px solid #e7e5e4",
                  borderRadius: radiusPx,
                  fontFamily: "inherit",
                }}
                className="p-2 text-xs"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] text-stone-500">Sample slot picker</div>
              <div className="grid grid-cols-4 gap-1.5">
                {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"].map(
                  (t, i) => (
                    <button
                      key={t}
                      style={{
                        background: i === 1 ? color : "#fff",
                        color: i === 1 ? "#fff" : "#1a1a1a",
                        border: `1px solid ${i === 1 ? color : "#e7e5e4"}`,
                        borderRadius: radiusPx,
                        fontFamily: "inherit",
                      }}
                      className="p-1.5 text-[11px]"
                    >
                      {t}
                    </button>
                  )
                )}
              </div>
            </div>
            <button
              style={{
                background: color,
                color: "#fff",
                borderRadius: radiusPx,
                fontFamily: "inherit",
              }}
              className="w-full p-2.5 text-sm font-medium"
            >
              Submit request
            </button>
          </div>
        </div>

        <div className="text-[11px] text-stone-500 pt-2">
          Hover-darkened: <code className="bg-stone-100 px-1 rounded">{darkColor}</code> ·{" "}
          Soft tint: <code className="bg-stone-100 px-1 rounded">{lightColor}</code>
        </div>
      </div>
    </div>
  );
}
