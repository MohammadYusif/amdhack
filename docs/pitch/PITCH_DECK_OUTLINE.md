# Mihan — Pitch Deck Outline

Slide-by-slide content for the AMAD 2026 presentation. Brand: Alinma dark
`#02141E`, copper `#CD907E`, logo from `docs/assets/mihan-logo.png`.
Screenshots referenced from `demo_screenshots/`.

> **Note:** the deck submitted for stage 1 is the 10-slide version below.
> Slide **9b (the "graduation" slide)** is a NEXT-STAGE addition — insert it
> only in the revised deck if we advance. See [COMPETITIVE_LANDSCAPE.md](COMPETITIVE_LANDSCAPE.md).

| # | Slide | Content | Visual |
|---|---|---|---|
| 1 | **مِهَن** | Logo + one line: "لأن دخلك الحقيقي يستحق أن يُقرأ". Track: Open Banking. | Logo on dark |
| 2 | **The wall** | 1.8M+ active freelancers (2.2M+ registered on the national platform). Empty SIMAH + no Mudad record = `NO_SALARY_TRANSFER` from every commercial bank. 100% rejection of a working population. | `02_rejection_result.png` |
| 3 | **The unlock** | SAMA licensed Open Banking (Mar 2026) — the regulator explicitly names freelancers/gig workers as beneficiaries. Tamara + Lean proved +32% approvals on cash-flow data. Nobody has brought this into a commercial-bank term loan. Mihan = feature inside the Alinma app, not a new product. **Battle-tested infrastructure:** built on SAMA-licensed Open Banking APIs — a framework that has already securely connected **1M+ bank accounts** and analyzed **1B+ transactions**, trusted and proven at scale by regional anchors incl. **Tabby, Tamara, and Abdul Latif Jameel**. | Timeline graphic |
| 4 | **How it scores** | 5 factors / weights table. Highlight: stability = CV over zero-filled 18-month window, diversity = HHI over senders — **computed live from transactions, provenance-labeled**. Two engines: v1 rules + v2 VANC (μ−1.5σ). | `08_cashflow_reveal.png` |
| 5 | **Responsible by design** | Worst-month lending basis (not average) · 45% DBR cap (SAMA Art. 14(b)) with live compression · no auto-approval, ever · SIMAH exception sandbox for thin files ≥75. | `10_dbr_calculator.png` |
| 6 | **It's real** | Live Wathq CR verification against api.wathq.sa — HTTP 200 on stage. Try-real-then-fallback architecture: Lean is a drop-in today (SAMA-licensed rail — gate is commercial, not regulatory); SIMAH/Nafath drop in once licensed. Honest split table (live vs simulated). | `12_live_wathq_proof.png` |
| 7 | **Fraud & compliance** | Shell-company flag (CR < 12 months) caught mid-pipeline · full SAMA audit log per scoring event · Claude-generated Arabic explanation per decision — **from anonymized scores only, zero PII, test-enforced** · human officer on every loan. | `13_officer_dashboard_full.png` + `screenshots/6_ai_privacy_proof.png` |
| 8 | **The demo** | (Live demo happens here — script kept in the team-only prep folder) | — |
| 9 | **Business case** | Bank: new lending segment currently rejected at 100%, Tamara + Lean's +32% as benchmark. Customer: first formal credit path + Cash Flow History Statement as a portable artifact. **Deployable today under Alinma's commercial architecture via live SAMA-licensed Open Banking rails** (per regulatory clearance doc). | Revenue model chart |
| **9b** | **⭐ Completing Alinma's own bet** (NEXT-STAGE ADD) | Alinma's Apr-2025 Freelance Card (SDB-funded, interest-free, ≤SAR 48K) proved the bank believes in this segment — but it's a *subsidized on-ramp*, not a credit relationship. Mihan is the graduation path: proven cash-flow history → commercially underwritten borrower on Alinma's own capital, priced to risk, at scale. Not a new bet — completing one already made. | Freelance Card → Mihan arrow graphic |
| 10 | **Ask & team** | Request a **Commercial Connection Approval** and entry into a **Dedicated Credit-Officer Cohort** to test and refine the risk-engine scoring models inside the bank's live environment. Team + repo QR. "دخل غير منتظم يدخل. مسار واحد موثّق يخرج." | Logo + QR |

## Design rules

- Arabic-first RTL; English technical terms inline (VANC, HHI, DBR) as in the app.
- One idea per slide, max 20 words of body text — the demo carries the detail.
- Every regulatory claim footnoted to the research PDFs (judges can verify).
- Slide 6's honesty table is a feature, not a confession — lead with it before judges ask.
