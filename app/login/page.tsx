import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { loadTerminalConfig } from "@/lib/terminal-theme";

// /login renders the active terminal theme. Mark dynamic so theme changes
// reflect immediately without a redeploy.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Clinic";
  const { theme } = await loadTerminalConfig();

  return (
    <main
      className="relative min-h-dvh flex items-center justify-center px-5 py-10 text-white overflow-hidden"
      style={{ backgroundImage: theme.gradient, backgroundSize: "cover" }}
    >
      <div className="absolute top-0 inset-x-0 h-[3px]" style={{ background: theme.accent }} />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-7">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-white/60 mb-2">
            Clinic console
          </div>
          <h1 className="text-2xl font-semibold mb-3">{clinicName}</h1>
          <p className="text-sm text-white/80 leading-relaxed">
            Welcome back. Sign in below to open your clinic console.
          </p>
        </div>
        <Suspense fallback={<div className="bg-white text-stone-900 rounded-2xl shadow-2xl p-6">Loading…</div>}>
          <LoginForm />
        </Suspense>
        <footer className="mt-8 text-center text-[11px] text-white/65">
          Powered by{" "}
          <a
            href="https://kanan.my"
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline underline-offset-2"
            style={{ color: "#C9A227" }}
          >
            Kanan
          </a>{" "}
          · your trusted right hand
        </footer>
      </div>
    </main>
  );
}
