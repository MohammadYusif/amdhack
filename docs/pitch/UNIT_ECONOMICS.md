# Mihan — Unit Economics Appendix (illustrative, assumptions labeled)

For the "how does the bank make money?" question. Product figures come
straight from the scoring engine; market-behavior figures are **assumptions
to validate with Alinma data** and are marked ⓐ. Keep the tone on stage:
*"an illustrative model with conservative assumptions — the pilot exists to
replace ⓐ with measured numbers."*

## Per-loan economics (exact, from `scoring.py`)

| | GREEN | YELLOW |
|---|---|---|
| Principal | SAR 60,000 | SAR 25,000 |
| Duration | 24 mo | 18 mo |
| APR | 8.2% | 11.5% |
| Monthly installment | SAR 2,700 | SAR 1,550 |
| **Gross interest income / loan** | **SAR 4,800** | **SAR 2,900** |

(Interest = installment × months − principal. DBR compression reduces both
principal and interest proportionally — margins hold.)

## Year-1 pilot funnel

| Step | Value | Basis |
|---|---|---|
| Active Saudi freelancers | 1,674,000 | Official freelance-platform figure (research brief) |
| With ≥12 months banking history | ~670,000 (40% ⓐ) | Needed for meaningful CV/VANC |
| Alinma reach, year 1 | 10,000 applicants (1.5% of addressable ⓐ) | In-app placement to existing customers only |
| Tier mix after scoring | 25% GREEN / 35% YELLOW / 40% BUILDING ⓐ | Persona-calibrated; pilot will measure |
| Offer take-up | 60% ⓐ | Pre-qualified in-app offers convert high |
| **Funded loans** | **1,500 GREEN + 2,100 YELLOW = 3,600** | |

## Year-1 revenue (base case)

| | Loans | Portfolio | Gross interest (over loan life) |
|---|---|---|---|
| GREEN | 1,500 | SAR 90.0M | SAR 7.2M |
| YELLOW | 2,100 | SAR 52.5M | SAR 6.1M |
| **Total** | **3,600** | **SAR 142.5M** | **SAR 13.3M** |

**Against that:** cost of funds (~5% ⓐ → ≈ SAR 8.0M over the same life),
expected credit loss (4% of portfolio ⓐ — deliberately conservative for a
new segment ≈ SAR 5.7M), acquisition ≈ 0 (in-app, existing customers).
Base case is roughly **break-even on interest in year 1** — and that is the
honest pitch: year 1 buys the data. Levers that flip it clearly positive:

1. **ECL is the swing variable.** Tamara's experience on identical Open
   Banking data suggests losses well below a blanket 4%; every point of ECL
   saved ≈ SAR 1.4M. The worst-month/VANC basis exists precisely to earn that.
2. **Scale is nearly free.** The engine is software; 3× applicants ≈ 3×
   portfolio at the same fixed cost.
3. **Repeat lending.** A BUILDING customer who follows the roadmap becomes a
   GREEN customer with a documented history — a pipeline, not a rejection.

## Non-interest value (often worth more than the interest)

- **Deposits & primacy**: freelancers consolidate cash flow into Alinma to
  strengthen their Mihan profile — low-cost deposits.
- **Cross-sell**: cards, insurance, POS financing to a segment no competitor
  can underwrite yet.
- **First-mover data moat**: every scored freelancer improves calibration;
  competitors start from zero.
- **Vision 2030 alignment**: direct contribution to the SME lending share
  target (20%) — strategic credit with the regulator.

## The one-liner

> «٣٬٦٠٠ قرض في السنة الأولى، محفظة ١٤٢ مليون ريال، من شريحة يرفضها
> الجميع اليوم بنسبة ١٠٠٪ — والمحرك برمجيات، فالتوسع شبه مجاني.»
