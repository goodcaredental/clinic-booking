# Kanan Digital Enterprise — Company Profile (10 slides)

Source of truth for the profile content. Edit here, then re-run `build_kanan_company_profile.py` to regenerate the PPTX. Same brand system as the sales deck (navy `#1B2A4A` + gold `#C9A227` + warm-white `#F4F1EA`, 60/30/10).

Audience: prospects, partners, potential clients evaluating whether to work with us. Longer horizon than the product sales deck — this is about who we are as an operating business.

Tone: measured, human, MY-friendly, operator voice. No AI buzzwords. Not "we leverage" — "we built."

---

## Slide 1 — Cover

**Title:** Kanan Digital Enterprise
**Subtitle:** Company profile
**Tagline:** your trusted right hand · kanan.my
**Visual:** Kanan wordmark, centered, large. Gold accent rail top + navy strip bottom.

---

## Slide 2 — Who we are

**Title:** A Malaysian software studio, built by operators.
**Lead:** *Kanan* — "KAH-nahn" — means **right** in Malay. As in *right hand*. Dependable. Close by. The hand that carries what the main one can't.
**Body copy:**
- Founded in Malaysia by [Founder name 1] and [Founder name 2], both with backgrounds in [role / industry].
- We build **software agents** — small, focused tools that automate the parts of a business that shouldn't need a human anymore.
- Every product we ship is one we'd use ourselves in a business we could run.
- We're not a consultancy chasing hours, and we're not a startup chasing venture rounds. We're an operating studio building products that fund themselves.

**Speaker note (for anyone presenting):** Personalize. Founder names + real backgrounds if possible. Own the "operator, not consultant" line.

---

## Slide 3 — What we build

**Title:** AI agents for Malaysian businesses.
**Lead:** One product per business problem. Deployed, supported, owned end-to-end.
**5-column icon strip (each with icon + one-liner):**
- 🩺 **Clinic Booking** — patient self-booking + nurse queue + owner dashboard for MY dental clinics *(shipped)*
- 📅 **Personal Assistant Agent** — meeting coordination + follow-ups + summary emails *(building)*
- 📋 **Purchase Order Agent** — vendor PO extraction, LMW/FTZ check, accounting sync *(building)*
- 📄 **PDF Translation Agent** — long-form document translation with layout preservation *(building)*
- 📢 **Marketing Agent** — content pipeline + audit trail for regulated industries *(building)*

**Footer line:** *Every product starts with a real client's real workflow. We don't build for hypothetical markets.*

---

## Slide 4 — Our approach

**Title:** Small team. Real users. No middlemen.
**4-block grid:**

**We build in weeks, not months.**
Prototype on your real data inside two weeks. If it doesn't earn the demo, we stop before you're committed.

**We stay after launch.**
No 3-month handover then radio silence. We're on WhatsApp when something breaks. We're on WhatsApp when you have a question. That's the deal.

**Your data stays yours.**
Hosted in Malaysia where possible (Supabase + Vercel). We don't train external AI models on your operational data. PDPA-aware from day one.

**We don't force upgrades.**
Feature tiers exist. Seat caps exist. But we top up seats on request — no forced tier bump just to add one more nurse or one more warehouse.

---

## Slide 5 — Selected work

**Title:** Kanan Clinic Booking — a case study.
**Lead:** Our first shipped product. Live at two demo clinics in KL, more onboarding through 2026.
**Bullets (with metrics placeholder):**
- **Problem:** Nurses at small dental clinics spent 30–50 minutes/day on WhatsApp — confirming, reminding, chasing. Owners had zero visibility into the day.
- **What we built:** Multi-tenant SaaS. Patient self-booking (EN/中文/BM), nurse queue with pre-written WhatsApp templates, terminal-kiosk model with PIN-per-action, owner dashboard with audit trail.
- **Two tiers:** Standard for single-doctor clinics; Premium adds a room flow (nurse check-in → doctor check-out with treatment logged), performance analytics, and chair utilization heatmap.
- **Outcome (indicative, ask us for latest):** No-show rate down, nurse WhatsApp time cut ~60%, owners can name their busiest day of the week for the first time.

**Visual:** 2-panel screenshot placeholder (owner dashboard + lockscreen)
**Speaker note:** Same product runs on both demo URLs — same code, different tier flag. That's the point.

---

## Slide 6 — How we work with clients

**Title:** Start to finish — no surprises.
**Grid 4×2:**
1. **Talk to us** — WhatsApp or a short call. Tell us what's slowing you down.
2. **Scoping session** — a longer conversation. No sales deck.
3. **Workflow map** — a few rounds mapping your current ops + where software fits.
4. **Written proposal** — 1-page scope, timeline, price. Push back where it doesn't fit.
5. **Working demo** — on your real data, in weeks not months.
6. **Commercial agreed** — once the demo proves out.
7. **Setup + training** — team trained, real users on the system. We're on WhatsApp throughout.
8. **Ongoing support** — we're still here. That's step 8, and it's the whole business model.

**Speaker note:** Lead with step 8. "We don't ghost you after launch" is the differentiator.

---

## Slide 7 — Our team

**Title:** Two founders. That's the whole team, for now.
**Two founder cards (large):**
- **[Founder name 1]** — [role: e.g. Product & Engineering] · [1-line bio]
- **[Founder name 2]** — [role: e.g. Client & Ops] · [1-line bio]

**Position line:** *We answer our own WhatsApp. If you sign with us, you're not going to be handed off to a junior.*
**Roadmap line (small):** Hiring plan: one engineer + one ops person once we've supported five paying customers through a full cycle. Slow by design.

---

## Slide 8 — Data + trust

**Title:** Your data stays yours.
**5 bullets:**
- **Hosted in Malaysia wherever possible.** Supabase (SG region) + Vercel edge. When we host in Singapore, it's because that's the closest region — data stays within the ASEAN legal envelope.
- **PDPA-aware.** Patient / customer data export any time. Schema visible on request. No third-party analytics inside operational apps.
- **We don't train external AI models on your operational data.** Where LLMs are used (translation, summarization), inference happens against your data only during the request.
- **You own your backups.** Owners can download a full CSV any day. Daily auto-email backup available.
- **Clear scope line.** Sterilization logs, X-rays, treatment notes for the clinic product live in the clinic's EMR — **not** in our system. We stay out of the lanes where our system shouldn't be the record of truth.

**Footer:** Kanan Digital Enterprise · SSM Enterprise registration in progress · Kuala Lumpur, Malaysia

---

## Slide 9 — What we won't do

**Title:** Scope discipline is a feature.
**Lead:** We say no to things that would dilute the products for the businesses that actually use them.
**Bullets:**
- **We don't build medical record systems.** The clinic booking app is an ops layer, not an EMR. If you need an EMR, we'll point you at one that does it well.
- **We don't do fixed-price "digital transformation" projects.** We ship one working thing, then the next.
- **We don't sell you AI as a feature.** We ship products that happen to use AI where it earns its keep. If a simple form works better than an agent, we build the form.
- **We don't take on projects we can't support for two years.** Small team, deep bench per product. When we take you on, we're on for the whole ride.

---

## Slide 10 — Get in touch

**Title:** Let's have a conversation.
**Contact block (large):**
- 💬 **WhatsApp** — +60 12-347 8126
- ✉ **Email** — hello@kanan.my
- 🌐 **Web** — kanan.my

**Product demos:**
- Clinic Booking (Standard) — standard-demo.kanan.my
- Clinic Booking (Premium) — premium-demo.kanan.my

**Footer line:** *No pitches on the first call. Just tell us what's not working, and we'll tell you honestly whether software is the right answer.*

---

## Production notes

- Founder names + roles are placeholders — fill in before sending to any prospect.
- WhatsApp number matches the sales deck (`+60 12-347 8126` → `wa.me/60123478126`).
- Metrics on Slide 5 are placeholders — replace with your actual latest numbers before external use.
- SSM Enterprise registration line — update when registration is complete (drop "in progress").
- Screenshots on Slide 5 — capture from `clinic-booking-kanan-team.vercel.app` (owner dashboard + terminal lockscreen).
- Product bullets on Slide 3 — mark items as *(shipped)* or *(building)* accurately. Right now only Clinic Booking is public-facing.
