# Mihan — Pitch Deck Outline (10 slides)

Slide-by-slide content for the AMAD 2026 presentation. Brand: Alinma dark
`#02141E`, copper `#CD907E`, logo from `docs/assets/mihan-logo.png`.
Screenshots referenced from `demo_screenshots/`.

| # | Slide | Content | Visual |
|---|---|---|---|
| 1 | **مِهَن** | Logo + one line: "لأن دخلك الحقيقي يستحق أن يُقرأ". Track: Open Banking. | Logo on dark |
| 2 | **The wall** | 1.674M active freelancers. Empty SIMAH + no Mudad record = `NO_SALARY_TRANSFER` from every commercial bank. 100% rejection of a working population. | `02_rejection_result.png` |
| 3 | **The unlock** | SAMA licensed Open Banking (Mar 2026). Tamara already proved +32% freelancer approvals on cash-flow data. Nobody has brought this into a commercial-bank term loan. Mihan = feature inside the Alinma app, not a new product. | Timeline graphic |
| 4 | **How it scores** | 5 factors / weights table. Highlight: stability = CV over zero-filled 18-month window, diversity = HHI over senders — **computed live from transactions, provenance-labeled**. Two engines: v1 rules + v2 VANC (μ−1.5σ). | `08_cashflow_reveal.png` |
| 5 | **Responsible by design** | Worst-month lending basis (not average) · 45% DBR cap (SAMA Art. 14(b)) with live compression · no auto-approval, ever · SIMAH exception sandbox for thin files ≥75. | `10_dbr_calculator.png` |
| 6 | **It's real** | Live Wathiq CR verification against api.wathq.sa — HTTP 200 on stage. Try-real-then-fallback architecture: Lean/SIMAH/Nafath are drop-in once licensed. Honest split table (live vs simulated). | `12_live_wathiq_proof.png` |
| 7 | **Fraud & compliance** | Shell-company flag (CR < 12 months) caught mid-pipeline · full SAMA audit log per scoring event · Claude-generated Arabic explanation per decision — **from anonymized scores only, zero PII, test-enforced** · human officer on every loan. | `13_officer_dashboard_full.png` + `screenshots/6_ai_privacy_proof.png` |
| 8 | **The demo** | (Live demo happens here — see DEMO_SCRIPT.md) | — |
| 9 | **Business case** | Bank: new lending segment currently rejected at 100%, Tamara's +32% as benchmark. Customer: first formal credit path + Cash Flow History Statement as a portable artifact. Deployable today under Alinma's license (per regulatory clearance doc). | Revenue model chart |
| 10 | **Ask & team** | Pilot inside Alinma's SAMA sandbox cohort. Team + repo QR. "دخل غير منتظم يدخل. مسار واحد موثّق يخرج." | Logo + QR |

## Design rules

- Arabic-first RTL; English technical terms inline (VANC, HHI, DBR) as in the app.
- One idea per slide, max 20 words of body text — the demo carries the detail.
- Every regulatory claim footnoted to the research PDFs (judges can verify).
- Slide 6's honesty table is a feature, not a confession — lead with it before judges ask.
