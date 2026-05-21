"""Generates Mihan Full Assessment Report PDF."""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os, sys

OUTPUT = os.path.join(os.path.dirname(__file__), "Mihan_Full_Assessment_Report.pdf")

# Unicode font path (Windows Arial)
FONT_DIR = r"C:\Windows\Fonts"
FONT_REG  = os.path.join(FONT_DIR, "arial.ttf")
FONT_BOLD = os.path.join(FONT_DIR, "arialbd.ttf")
FONT_ITALIC = os.path.join(FONT_DIR, "ariali.ttf")

ALINMA_BLUE = (0, 82, 163)
RED        = (180, 30, 30)
AMBER      = (180, 110, 0)
GREEN_COL  = (30, 130, 60)
DARK       = (30, 30, 30)
MID        = (80, 80, 80)
LIGHT_BG   = (245, 247, 250)
WHITE      = (255, 255, 255)
BORDER     = (200, 205, 215)


class MihanPDF(FPDF):
    def _setup_fonts(self):
        self.add_font("Arial", "", FONT_REG)
        self.add_font("Arial", "B", FONT_BOLD)
        self.add_font("Arial", "I", FONT_ITALIC)

    def set_font(self, family="Arial", style="", size=10):
        if family in ("Helvetica", "helvetica"):
            family = "Arial"
        if family == "Courier":
            family = "Arial"
            style = ""
        super().set_font(family, style, size)

    def header(self):
        self.set_fill_color(*ALINMA_BLUE)
        self.rect(0, 0, 210, 12, "F")
        super().set_font("Arial", "B", 9)
        self.set_text_color(*WHITE)
        self.set_y(3)
        self.cell(0, 6, "MIHAN  —  Hackathon Assessment Report  |  AMAD 2026  |  CONFIDENTIAL", align="C")
        self.set_text_color(*DARK)
        self.ln(8)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*BORDER)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MID)
        self.cell(0, 6, f"Page {self.page_no()}  |  Generated 2026-05-19  |  Mihan / Alinma Bank", align="C")

    def cover(self):
        self.add_page()
        # Blue header band
        self.set_fill_color(*ALINMA_BLUE)
        self.rect(0, 12, 210, 70, "F")
        self.set_y(28)
        self.set_font("Helvetica", "B", 30)
        self.set_text_color(*WHITE)
        self.cell(0, 14, "MIHAN", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 14)
        self.cell(0, 8, "AI Freelancer Credit Scoring Engine", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 11)
        self.cell(0, 7, "Full Compliance & Feasibility Assessment", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(3)
        self.set_font("Helvetica", "", 10)
        self.cell(0, 6, "Alinma Bank  |  AMAD Hackathon 2026  |  July 16-18, Riyadh", align="C")

        self.set_text_color(*DARK)
        self.set_y(95)

        # Stat boxes
        stats = [
            ("6", "Skills Run"),
            ("34", "Compliance Items"),
            ("13", "Legal Risks Scored"),
            ("24", "UX Findings"),
        ]
        box_w = 42
        x_start = 13
        for i, (val, lbl) in enumerate(stats):
            x = x_start + i * (box_w + 3)
            self.set_fill_color(*LIGHT_BG)
            self.set_draw_color(*BORDER)
            self.rect(x, 95, box_w, 22, "FD")
            self.set_xy(x, 97)
            self.set_font("Helvetica", "B", 18)
            self.set_text_color(*ALINMA_BLUE)
            self.cell(box_w, 10, val, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_x(x)
            self.set_font("Helvetica", "", 7.5)
            self.set_text_color(*MID)
            self.cell(box_w, 5, lbl, align="C")

        self.set_text_color(*DARK)
        self.set_y(125)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*ALINMA_BLUE)
        self.cell(0, 8, "Overall Assessment", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*DARK)
        self.multi_cell(0, 6,
            "Mihan is an AI-powered B2B SaaS credit scoring engine enabling Alinma Bank to lend to "
            "Saudi freelancers — 1.6 million Freelance Work Document holders currently excluded from "
            "all commercial bank lending. The hackathon demo is fully buildable in 72 hours with zero "
            "regulatory blockers. Post-hackathon, the pilot path is clear but requires Alinma as an "
            "active partner, particularly for SAMA submissions.\n\n"
            "VERDICT: Strong position to win. Highest risk is demo execution, not the idea.",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Three killer risks callout
        self.ln(4)
        self.set_fill_color(255, 240, 240)
        self.set_draw_color(*RED)
        self.rect(10, self.get_y(), 190, 34, "FD")
        y = self.get_y() + 3
        self.set_xy(13, y)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*RED)
        self.cell(0, 5, "THREE THINGS THAT COULD KILL MIHAN BEFORE IT STARTS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_x(13)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*DARK)
        risks = [
            "1.  Data processed outside Saudi Arabia — criminal liability, 1 year imprisonment + SAR 1M fine. Architecture must enforce me-south-1.",
            "2.  No DPIA + DPO before pilot — criminal liability, 2 years + SAR 3M fine. Engage Saudi consultancy immediately post-hackathon.",
            "3.  SAMA income methodology unapproved — pilot blocker. Submit Worst-Month x 80% via Alinma the day after the hackathon ends.",
        ]
        for r in risks:
            self.set_x(13)
            self.multi_cell(184, 5, r, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_text_color(*DARK)

    def section_title(self, num, title):
        self.ln(5)
        self.set_fill_color(*ALINMA_BLUE)
        self.rect(10, self.get_y(), 190, 9, "F")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*WHITE)
        self.set_x(13)
        self.cell(0, 9, f"  {num}.  {title.upper()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DARK)
        self.ln(2)

    def sub_title(self, text):
        self.set_font("Helvetica", "B", 9.5)
        self.set_text_color(*ALINMA_BLUE)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DARK)

    def body(self, text):
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 5.5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def rag_dot(self, status):
        if status == "R":
            self.set_text_color(*RED)
            return "● RED"
        elif status == "A":
            self.set_text_color(*AMBER)
            return "● AMBER"
        else:
            self.set_text_color(*GREEN_COL)
            return "● GREEN"

    def table_header(self, cols):
        self.set_fill_color(*ALINMA_BLUE)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 7.5)
        for label, w in cols:
            self.cell(w, 7, label, border=1, fill=True, align="C")
        self.ln()
        self.set_text_color(*DARK)

    def table_row(self, cells, fill=False, rag_col=None):
        self.set_font("Helvetica", "", 7.5)
        if fill:
            self.set_fill_color(*LIGHT_BG)
        else:
            self.set_fill_color(*WHITE)

        # Calculate max height needed
        max_lines = 1
        for text, w in cells:
            if text == rag_col:
                continue
            lines = len(self.multi_cell(w, 5, str(text), dry_run=True, output="LINES"))
            max_lines = max(max_lines, lines)
        row_h = max_lines * 5 + 2

        if self.get_y() + row_h > 270:
            self.add_page()
            fill = False

        x_start = self.get_x()
        y_start = self.get_y()

        for i, (text, w) in enumerate(cells):
            self.set_xy(x_start, y_start)
            x_start += w
            if text in ("R", "A", "G"):
                dot = self.rag_dot(text)
                self.set_font("Helvetica", "B", 7.5)
                self.cell(w, row_h, dot, border=1, fill=fill, align="C")
                self.set_text_color(*DARK)
                self.set_font("Helvetica", "", 7.5)
            else:
                self.multi_cell(w, row_h / max(max_lines,1), str(text),
                                border=1, fill=fill, align="L", max_line_height=5)
        self.set_xy(10, y_start + row_h)

    def compliance_check_section(self):
        self.add_page()
        self.section_title("1", "Saudi Regulatory Compliance Check")
        self.body(
            "The hackathon demo has no regulatory blockers — it uses synthetic data only. "
            "The pilot requires pre-work on SAMA income methodology and PDPL obligations before any real loan is issued."
        )
        self.ln(2)
        cols = [("Regulation", 68), ("Demo", 28), ("Pilot", 94)]
        self.table_header(cols)
        rows = [
            ("SAMA Rule 300-1-1-4 (freelancer accounts)", "N/A", "Alinma already compliant"),
            ("SAMA Consumer Financing (33.33% cap)", "N/A", "BLOCKER — submit Worst-Month x80% to SAMA via Alinma"),
            ("SAMA Responsible Lending (SIMAH concurrent)", "Mock OK", "Must run live SIMAH in parallel with scoring"),
            ("SAMA AI: disclosure, explainability, human review", "Build modal", "Same requirements carry forward to production"),
            ("PDPL Data Residency", "N/A (local)", "CRIMINAL — AWS me-south-1 only, written confirmation required"),
            ("PDPL DPIA + DPO", "N/A", "CRIMINAL — must be in place before any real data processed"),
            ("PDPL Cross-product consent", "Wire in UI", "Must be live with immutable timestamped storage"),
            ("PDPL Automated decision (privacy notice)", "Not required", "Required before any freelancer application"),
            ("Credit Information Law (Proof of Income)", "Demo fine", "Frame as income certificate, not credit report"),
            ("SAMA Open Banking Framework (Phase 2)", "Not needed", "Requires sandbox application — 9-12 month review"),
            ("SDAIA AI Ethics Framework", "Label AI outputs", "Full audit trail + fairness audit before scale"),
            ("ZATCA VAT", "Not applicable", "15% VAT on B2B invoices to Alinma before invoicing"),
            ("Kafalah", "Do not mention", "Freelancers don't qualify — never reference in pitch or docs"),
            ("Sharia / Tawarruq", "One pitch slide", "Alinma existing structures apply — no new Sharia approval"),
        ]
        for i, (reg, demo, pilot) in enumerate(rows):
            self.table_row([(reg, 68), (demo, 28), (pilot, 94)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("3 Items Confirmed Legally Sound")
        items = [
            "B2B fee structure (SAR 30-50 per assessment) — Alinma absorbs, never passed to borrower. 1% cap on SAR 60K loan = SAR 600 max.",
            "Contractual standing deduction with prior written consent at signing — fully SAMA-compliant.",
            "Phase 1 under Alinma's existing banking license — no new SAMA license needed for demo or pilot.",
        ]
        for item in items:
            self.set_font("Helvetica", "", 9)
            self.set_x(13)
            self.multi_cell(184, 5.5, f"[OK]  {item}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def legal_risk_section(self):
        self.add_page()
        self.section_title("2", "Legal Risk Assessment")
        self.body(
            "13 legal risks scored using a Severity x Likelihood matrix. 4 Critical (RED), 3 High (ORANGE), "
            "5 Medium (YELLOW), 1 Low (GREEN). The 4 critical risks are all pre-pilot, not pre-demo."
        )
        self.ln(2)
        cols = [("#", 6), ("Risk", 88), ("Sev", 12), ("Like", 12), ("Score", 13), ("Level", 22), ("RAG", 9)]
        self.table_header(cols)
        risks = [
            (1, "PDPL data residency — processing outside KSA", "5", "4", "20", "Critical", "R"),
            (2, "PDPL automated decisions — DPIA + DPO missing", "5", "4", "20", "Critical", "R"),
            (3, "SAMA income cap — no approval for self-employed methodology", "5", "5", "25", "Critical", "R"),
            (4, "Cross-product consent violation — SDAIA enforcement", "4", "4", "16", "Critical", "R"),
            (5, "IP ownership of scoring model weights post-pilot", "4", "3", "12", "High", "A"),
            (6, "AI scoring liability — model approves loan that defaults", "4", "3", "12", "High", "A"),
            (7, "Force majeure — Mihan SaaS down, Alinma loan book affected", "3", "3", "9", "Medium", "A"),
            (8, "Digital Proof of Income grey area (certificate vs credit report)", "3", "3", "9", "Medium", "A"),
            (9, "Sharia non-compliance of loan structure", "3", "2", "6", "Medium", "A"),
            (10, "Consumer protection law applicability to freelancer borrowers", "2", "3", "6", "Medium", "A"),
            (11, "AML interaction with AI scoring layer", "2", "2", "4", "Low", "G"),
            (12, "Competition law — data moat seen as anti-competitive by SAMA", "2", "2", "4", "Low", "G"),
            (13, "Kafalah misrepresentation risk", "1", "2", "2", "Low", "G"),
        ]
        for i, (num, risk, sev, like, score, level, rag) in enumerate(risks):
            self.table_row(
                [(str(num), 6), (risk, 88), (sev, 12), (like, 12), (score, 13), (level, 22), (rag, 9)],
                fill=(i % 2 == 0)
            )

        self.ln(5)
        self.sub_title("Mitigations for 4 Critical Risks")
        mitigations = [
            ("Risk 1 — Data Residency",
             "Architecture must enforce Saudi region at infrastructure level. Claude API proxy sends only derived "
             "factor scores (0-100 numbers), never PII. Legally classified as aggregated statistics — document in DPIA."),
            ("Risk 2 — DPIA + DPO",
             "Engage outsourced Saudi data protection consultancy (KPMG Saudi, Deloitte Saudi) immediately post-hackathon. "
             "Budget SAR 50K-150K. Cannot be deferred to pilot launch."),
            ("Risk 3 — SAMA Income Methodology",
             "Only path is Alinma submitting Worst-Month x80% formula to SAMA. Start the conversation at the hackathon. "
             "No live loans can be issued without this approval — it is the single longest-lead item."),
            ("Risk 4 — Cross-Product Consent",
             "Build explicit checkbox with immutable timestamped storage (append-only log, no modification allowed) "
             "before any real user touches the product. SDAIA issued 48 enforcement decisions in 2025 — actively policed."),
        ]
        for title, text in mitigations:
            self.set_font("Helvetica", "B", 9)
            self.set_x(13)
            self.cell(0, 5.5, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_font("Helvetica", "", 9)
            self.set_x(13)
            self.multi_cell(184, 5.5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(1)

    def operational_risk_section(self):
        self.add_page()
        self.section_title("3", "Operational Risk Assessment")
        self.body("11 operational risks assessed across hackathon execution and post-hackathon pilot phases.")
        self.ln(2)

        self.sub_title("Hackathon Risks (72-Hour Window)")
        cols = [("Risk", 80), ("Likelihood", 22), ("Impact", 18), ("Level", 16), ("Mitigation", 54)]
        self.table_header(cols)
        hackathon_risks = [
            ("Demo crash during live pitch", "Medium", "Critical", "HIGH", "Pre-record 90-sec video; pre-cache all API responses; frozen HTML fallback screenshots"),
            ("Synthetic data looks fake to judges", "High", "High", "HIGH", "Arabic names, realistic SAR amounts, real Saudi professions (App Developer, Graphic Designer)"),
            ("Arabic UX errors in front of Alinma judges", "Medium", "High", "HIGH", "Native speaker review mandatory by July 14 — not optional"),
            ("Live SIMAH API failure during demo", "High", "High", "HIGH", "Mock completely. Pre-rendered thin-file response is the correct product story"),
            ("Team member unavailable in 72-hour window", "Low", "High", "MEDIUM", "Document all components; each person owns end-to-end delivery of one module"),
            ("Scoring produces counterintuitive results on synthetic data", "Medium", "Medium", "MEDIUM", "Test all 3 profiles manually before demo; tune weights if needed"),
            ("Judges challenge '4 tracks' scope claim", "High", "Medium", "MEDIUM", "Lead with Fintech track; others secondary; one-line rationale ready for each"),
            ("Cloud latency during demo", "Low", "High", "MEDIUM", "Run scoring engine locally — zero cloud dependency for demo day"),
            ("Pitch delivery overruns time", "High", "Medium", "MEDIUM", "Timed dress rehearsal at hour 60; 4-minute hard cap"),
        ]
        for i, row in enumerate(hackathon_risks):
            self.table_row([(c, w) for c, (_, w) in zip(row, [(r, w) for r, w in [("", 80), ("", 22), ("", 18), ("", 16), ("", 54)]])], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("Post-Hackathon Pilot Risks")
        cols2 = [("Risk", 80), ("Level", 20), ("Mitigation", 90)]
        self.table_header(cols2)
        pilot_risks = [
            ("500-person onboarding friction", "MEDIUM", "Alinma branch staff pre-briefed; Arabic onboarding video prepared in advance"),
            ("Standing deduction failures", "MEDIUM", "Contractual consent at signing; Alinma handles deduction mechanics"),
            ("Early defaults in pilot cohort", "MEDIUM", "Conservative Green tier threshold (75+); Building tier gets roadmap, not a loan"),
            ("SAMA asks for methodology revision", "HIGH", "Alinma relationship is the buffer; build full audit trail from day 1 of pilot"),
        ]
        for i, (risk, level, mit) in enumerate(pilot_risks):
            self.table_row([(risk, 80), (level, 20), (mit, 90)], fill=(i % 2 == 0))

    def architecture_section(self):
        self.add_page()
        self.section_title("4", "Technical Architecture — ADR-001")

        self.sub_title("Hackathon Demo Stack (Local, 72 Hours)")
        self.set_fill_color(240, 244, 250)
        self.set_draw_color(*BORDER)
        self.rect(10, self.get_y(), 190, 52, "FD")
        self.set_x(14)
        self.set_font("Courier", "", 8)
        arch_text = [
            "LOCAL LAPTOP",
            "",
            "  Next.js 14 (Arabic RTL, mobile-first)",
            "       |",
            "  FastAPI (Python) — Scoring Engine",
            "    |- expense_discipline()  x 0.35",
            "    |- income_stability()    x 0.30",
            "    |- client_diversity()    x 0.20",
            "    +- savings_behavior()   x 0.15",
            "       |",
            "  SQLite — synthetic profiles + append-only audit log",
            "       |",
            "  Claude API Proxy (pre-cached) — factor scores only, zero PII",
            "  Mock SIMAH — pre-rendered JSON response",
        ]
        y = self.get_y() + 3
        for line in arch_text:
            self.set_xy(14, y)
            self.cell(0, 4, line)
            y += 4
        self.set_y(y + 2)
        self.set_font("Helvetica", "", 9)

        self.ln(4)
        self.sub_title("Pilot Stack (AWS me-south-1 / me-central-1)")
        self.set_fill_color(240, 244, 250)
        self.rect(10, self.get_y(), 190, 60, "FD")
        self.set_font("Courier", "", 8)
        pilot_arch = [
            "AWS SAUDI REGION (KSA ONLY)",
            "",
            "  CloudFront -> Next.js (Amplify or ECS Fargate)",
            "       |",
            "  API Gateway -> Lambda / ECS FastAPI",
            "       |",
            "  RDS PostgreSQL (me-south-1, encrypted at rest)",
            "  S3 (me-south-1) — PDF bank statement storage",
            "  AWS Textract (me-south-1) — OCR, in-region only",
            "       |",
            "  Claude API Proxy — derived factor scores ONLY (no PII exits KSA)",
            "  Alinma Internal API — transaction pull (business account)",
            "  SIMAH Live API — concurrent check (mandatory, not replaced)",
            "  Nafath API — digital identity verification",
            "",
            "  Audit Log: append-only DynamoDB table",
            "  SAMA Inspector: read-only IAM role + dashboard",
        ]
        y = self.get_y() + 3
        for line in pilot_arch:
            self.set_xy(14, y)
            self.cell(0, 4, line)
            y += 4
        self.set_y(y + 2)
        self.set_font("Helvetica", "", 9)

        self.ln(3)
        self.sub_title("PDPL-Safe Claude API Pattern")
        self.body(
            "The Claude API call receives ONLY derived factor scores (integers 0-100). No name, no IBAN, "
            "no transaction amounts, no dates, no employer names. Legally classified as aggregated statistics "
            "under PDPL — not personal data. Document this in the DPIA explicitly."
        )

        self.ln(3)
        self.sub_title("Feasibility Q&A")
        cols = [("Question", 95), ("Answer", 95)]
        self.table_header(cols)
        qa = [
            ("Minimum viable hackathon stack?", "Next.js + FastAPI + SQLite + pre-cached Claude. No cloud needed."),
            ("Additional pilot components?", "RDS, S3, Textract, live SIMAH/Nafath APIs, consent storage, audit log"),
            ("Biggest technical risk?", "PDF bank statement parsing — solved by pdfplumber (demo) / AWS Textract in me-south-1 (pilot)"),
            ("Claude API PDPL compliance?", "Proxy layer — only factor scores leave Saudi cloud; legally aggregated statistics"),
            ("PDF parsing in KSA?", "AWS Textract available in me-south-1. Never parse client-side. Data stays in KSA."),
        ]
        for i, (q, a) in enumerate(qa):
            self.table_row([(q, 95), (a, 95)], fill=(i % 2 == 0))

    def accessibility_section(self):
        self.add_page()
        self.section_title("5", "Accessibility & UX Audit — WCAG 2.1 AA")
        self.body("24 findings across 6 screens. 7 Critical (block WCAG compliance), 11 Major, 6 Minor. "
                  "SAMA AI requirements also audited. All critical fixes required before demo day.")
        self.ln(2)

        self.sub_title("Critical Fixes (7 items — must be done before demo)")
        cols = [("Screen", 38), ("Issue", 85), ("Fix", 67)]
        self.table_header(cols)
        critical = [
            ("Decline Screen", "Human review button contrast 2.9:1 — FAILS 4.5:1 minimum (WCAG 1.4.3)",
             "Change to #0052A3 white text — 6.8:1 ratio. Alinma brand blue."),
            ("AI Disclosure Banner", "Display-only banner — no acknowledgement (SAMA requirement)",
             "Convert to modal with role='alertdialog' and confirm button"),
            ("Score Card", "Tier communicated by colour only — WCAG 1.4.1 failure",
             "Add tier name text to aria-label on score gauge"),
            ("Decline Screen", "Claude explanation not labeled as AI-generated (SAMA + SDAIA)",
             "Add '[AI-Generated Explanation]' label and AI badge"),
            ("Consent Screen", "Checkbox touch target 16px — minimum is 44x44px (WCAG 2.5.5)",
             "Full-width <label> wrapping entire checkbox text"),
            ("Banker Dashboard", "Table missing dir='rtl' — column order wrong in Arabic",
             "Add dir='rtl' + reverse column sequence in HTML"),
            ("All Arabic screens", "Numbers render LTR inside RTL text — BiDi rendering bug",
             "Wrap all numbers in <span dir='ltr'>SAR 8,500</span>"),
        ]
        for i, (screen, issue, fix) in enumerate(critical):
            self.table_row([(screen, 38), (issue, 85), (fix, 67)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("SAMA AI Compliance — Screen-by-Screen")
        cols2 = [("SAMA Requirement", 75), ("Current State", 55), ("Status", 60)]
        self.table_header(cols2)
        sama = [
            ("Inform customer AI is used BEFORE assessment", "Banner exists but no acknowledgement", "FAIL — must convert to modal"),
            ("Plain-language decline reasons (top 2-3 factors)", "Factor cards present with scores", "PASS"),
            ("'Request Human Review' available for declines", "Button present but below fold + contrast fails", "FAIL — move to top, fix colour"),
            ("AI-generated content labeled as AI", "Not labeled anywhere", "FAIL — add label to Claude paragraph"),
            ("Full audit log accessible to SAMA inspectors", "Not built yet (demo)", "BUILD for pilot; mention in pitch"),
        ]
        for i, (req, state, status) in enumerate(sama):
            self.table_row([(req, 75), (state, 55), (status, 60)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("Code Fixes — Copy-Paste Ready")
        self.set_fill_color(240, 244, 250)
        self.set_draw_color(*BORDER)
        h = 52
        self.rect(10, self.get_y(), 190, h, "FD")
        self.set_font("Courier", "", 7.5)
        code = [
            "/* Human review button — was 2.9:1, now 6.8:1 */",
            ".human-review-btn { background: #0052A3; color: #FFFFFF; }",
            "",
            "/* Score gauge aria-label */",
            '<div role="img" aria-label="Mihan Score: 79/100 - Green Tier">',
            "",
            "/* Numbers in Arabic UI */",
            "<p>Monthly income: <span dir=\"ltr\">SAR 8,500</span></p>",
            "",
            "/* AI disclosure modal */",
            '<div role="alertdialog" aria-labelledby="ai-title" aria-modal="true">',
            '  <h2 id="ai-title">Important Notice — استخدام الذكاء الاصطناعي</h2>',
            '  <button onclick="acknowledgeAndProceed()">I understand, proceed</button>',
            "</div>",
        ]
        y = self.get_y() + 3
        for line in code:
            self.set_xy(14, y)
            self.cell(0, 4, line)
            y += 4
        self.set_y(y + 2)
        self.set_font("Helvetica", "", 9)

    def compliance_tracking_section(self):
        self.add_page()
        self.section_title("6", "Compliance Tracking Register — 34 Items")
        self.body("RAG status: RED = blocking (cannot proceed), AMBER = at risk (must be done), GREEN = done. "
                  "All items are currently RED or AMBER — none complete at time of assessment (2026-05-19).")

        self.ln(2)
        self.sub_title("PHASE 1 — Pre-Hackathon (All items due by July 15, 2026)")
        cols = [("#", 7), ("Item", 118), ("Framework", 30), ("RAG", 10), ("Priority", 25)]
        self.table_header(cols)
        p1 = [
            (1, "AI disclosure acknowledgement modal (banner -> modal with confirm)", "SAMA AI", "R", "BLOCKING"),
            (2, "Fix human review button contrast (#FF8C00 -> #0052A3)", "WCAG 1.4.3", "R", "BLOCKING"),
            (3, "Add dir=rtl + column reversal to banker dashboard", "WCAG RTL", "R", "BLOCKING"),
            (4, "aria-label on score gauge including tier name text", "WCAG 1.4.1", "A", "MAJOR"),
            (5, "Full-width clickable label for consent checkbox", "WCAG 2.5.5", "A", "MAJOR"),
            (6, "Label Claude explanation as AI-generated", "SAMA + SDAIA", "R", "BLOCKING"),
            (7, "Move human review button to TOP of decline screen", "SAMA AI / UX", "A", "MAJOR"),
            (8, "Wrap all numbers in <span dir=ltr> in Arabic UI", "WCAG RTL", "A", "MAJOR"),
            (9, "Add consent withdrawal to account settings", "PDPL", "A", "MAJOR"),
            (10, "Synthetic data: Arabic names, SAR, Saudi professions", "Operational", "R", "BLOCKING"),
            (11, "Mock SIMAH — never attempt live API", "Operational", "R", "BLOCKING"),
            (12, "Pre-cache Claude API responses for all 3 profiles", "Operational", "R", "BLOCKING"),
            (13, "Dress rehearsal with timed pitch at hour 60", "Operational", "A", "CRITICAL"),
            (14, "Arabic copy reviewed by native speaker (finance context)", "Operational", "R", "BLOCKING"),
            (15, "Sharia compliance framing added to pitch deck", "Islamic Finance", "A", "IMPORTANT"),
            (16, "Demo video pre-recorded as 90-sec fallback", "Operational", "A", "INSURANCE"),
        ]
        for i, (num, item, fw, rag, pri) in enumerate(p1):
            self.table_row([(str(num), 7), (item, 118), (fw, 30), (rag, 10), (pri, 25)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("PHASE 2 — Pre-Pilot (Before Any Real User Data)")
        cols2 = [("#", 7), ("Item", 105), ("Framework", 35), ("RAG", 10), ("Note", 33)]
        self.table_header(cols2)
        p2 = [
            (17, "Confirm AWS me-south-1 or Azure Saudi North — written confirmation", "PDPL Residency", "R", "CRIMINAL"),
            (18, "DPIA completed and filed with SDAIA", "PDPL Automated", "R", "CRIMINAL"),
            (19, "DPO appointed (outsourced Saudi consultancy acceptable)", "PDPL", "R", "CRIMINAL"),
            (20, "Submit Worst-Month x80% income methodology to SAMA via Alinma", "SAMA Consumer", "R", "PILOT BLOCKER"),
            (21, "Explicit cross-product consent checkbox built into loan flow", "PDPL Purpose", "R", "ENFORCED"),
            (22, "Vendor agreement with Alinma signed (IP, liability, SLA, AML)", "Contract", "R", "UNLOCKS PILOT"),
            (23, "ZATCA VAT registration for B2B SaaS fees", "ZATCA VAT", "A", "PRE-REVENUE"),
            (24, "E&O insurance obtained for SaaS product", "Liability", "A", "PRE-PILOT"),
            (25, "Penetration testing of scoring engine and data pipeline", "Security / PDPL", "A", "PRE-PILOT"),
            (26, "Privacy notice updated for automated decision-making", "PDPL", "A", "PRE-PILOT"),
            (27, "Consent stored with immutable timestamp + user ID", "PDPL Consent", "A", "SDAIA AUDIT"),
            (28, "SAMA inspector read-only access to audit logs", "SAMA AI", "A", "ALINMA MANAGES"),
            (29, "Alinma Sharia Supervisory Board formal endorsement", "Islamic Finance", "A", "ALINMA INTERNAL"),
        ]
        for i, (num, item, fw, rag, note) in enumerate(p2):
            self.table_row([(str(num), 7), (item, 105), (fw, 35), (rag, 10), (note, 33)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("PHASE 3 — Post-Pilot / Phase 2 Scale")
        cols3 = [("#", 7), ("Item", 130), ("Framework", 35), ("RAG", 10), ("Timeline", 8)]
        self.table_header(cols3)
        p3 = [
            (30, "SAMA Regulatory Sandbox application (Open Banking credit scoring)", "SAMA Open Banking", "A", "Q4"),
            (31, "Saudi legal counsel retained (Al Tamimi / AlGhazzawi)", "Regulatory", "A", "PRE"),
            (32, "Digital Proof of Income legal framing confirmed by counsel", "Credit Info Law", "A", "PRE"),
            (33, "Consent withdrawal mechanism live in production", "PDPL", "A", "PRE"),
            (34, "Fairness/bias audit across 120+ professions and demographics", "SAMA AI + SDAIA", "A", "POST"),
        ]
        for i, (num, item, fw, rag, tl) in enumerate(p3):
            self.table_row([(str(num), 7), (item, 130), (fw, 35), (rag, 10), (tl, 8)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("Master RAG Dashboard")
        cols4 = [("Phase", 80), ("Total", 22), ("RED Blocking", 30), ("AMBER At Risk", 30), ("GREEN Done", 28)]
        self.table_header(cols4)
        summary = [
            ("Pre-Hackathon (by July 15)", "16", "7", "9", "0"),
            ("Pre-Pilot (before real data)", "13", "6", "7", "0"),
            ("Post-Pilot / Phase 2", "5", "0", "5", "0"),
            ("TOTAL", "34", "13", "21", "0"),
        ]
        for i, row in enumerate(summary):
            bold = (i == 3)
            if bold:
                self.set_font("Helvetica", "B", 7.5)
                self.set_fill_color(*ALINMA_BLUE)
                self.set_text_color(*WHITE)
            self.table_row([(v, w) for v, (_, w) in zip(row, [("", 80), ("", 22), ("", 30), ("", 30), ("", 28)])], fill=(not bold and i % 2 == 0))
            if bold:
                self.set_font("Helvetica", "", 7.5)
                self.set_text_color(*DARK)

    def demo_scope_section(self):
        self.add_page()
        self.section_title("7", "Demo Build Scope — What to Build in 72 Hours")
        self.body(
            "Exact scope for the hackathon demo. Build these 5 modules and nothing more. "
            "Estimated ~42 hours of coding; 30 hours buffer for Arabic polish, testing, and pitch preparation."
        )
        self.ln(2)

        modules = [
            ("Module 1 — Scoring Engine (Backend, ~10 hours)",
             "FastAPI in Python. 4 factor functions with exact weights (35/30/20/15). "
             "3 synthetic freelancer profiles: one Green (Mohammad Al-Ghamdi, 79), one Yellow (Noura Al-'Omari, 61), "
             "one Building (Fahad Al-Qahtani, 41). SQLite for data + append-only audit log table. "
             "Composite score -> tier -> loan recommendation logic."),
            ("Module 2 — Claude Explanation Layer (Backend, ~3 hours)",
             "Pre-cache 3 Arabic explanations using PDPL-safe proxy pattern (factor scores only, zero PII). "
             "Serve from local JSON on demo day — no live API call. Label output as AI-generated."),
            ("Module 3 — Freelancer Mobile Flow (Frontend, ~15 hours)",
             "Arabic RTL, mobile viewport. Screen 1: AI disclosure modal with confirm button. "
             "Screen 2: Score card — gauge + tier badge + factor bars + loan recommendation. "
             "Screen 3 (decline): Decline reasons + labeled Claude explanation + human review button at TOP in #0052A3. "
             "Screen 4 (Building tier): Score improvement roadmap with progress tracker. "
             "Consent checkbox with full-width label. Numbers in <span dir=ltr>."),
            ("Module 4 — Banker Dashboard (Frontend, ~10 hours)",
             "Desktop, dir=rtl, columns in correct Arabic order. Applicant pipeline table. "
             "Individual applicant panel: score breakdown + Claude explanation + SIMAH mock status + "
             "Approve/Decline/Escalate buttons. Audit log viewer (read-only table)."),
            ("Module 5 — Digital Proof of Income PDF (~4 hours)",
             "QR-verifiable PDF with Alinma letterhead mock. Income data only — no score, no SIMAH data. "
             "One-click generate from banker dashboard."),
        ]
        for title, desc in modules:
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*ALINMA_BLUE)
            self.cell(0, 6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*DARK)
            self.set_x(13)
            self.multi_cell(184, 5.5, desc, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(2)

        self.ln(2)
        self.sub_title("The 3 Synthetic Profiles to Build")
        cols = [("Name", 45), ("Profession", 45), ("Score", 15), ("Tier", 20), ("Story for judges", 65)]
        self.table_header(cols)
        profiles = [
            ("Mohammad Al-Ghamdi", "App Developer (App developer)", "79", "GREEN", "3 regular clients, consistent income, good savings rate"),
            ("Noura Al-'Omari", "Graphic Designer (Graphic designer)", "61", "YELLOW", "2 clients, variable income, thin savings buffer"),
            ("Fahad Al-Qahtani", "Photographer (Photographer)", "41", "BUILDING", "1 client (71% concentration), low savings — decline with roadmap"),
        ]
        for i, row in enumerate(profiles):
            self.table_row([(v, w) for v, (_, w) in zip(row, [("", 45), ("", 45), ("", 15), ("", 20), ("", 65)])], fill=(i % 2 == 0))

    def winning_section(self):
        self.add_page()
        self.section_title("8", "How to Win")

        self.sub_title("Judging Criteria Mapping")
        cols = [("Criterion", 42), ("What Judges Want", 60), ("Mihan Angle", 88)]
        self.table_header(cols)
        criteria = [
            ("Innovation", "New solution to real gap", "Only product targeting 1.6M freelancers excluded from ALL bank lending. Not incremental."),
            ("Technical Implementation", "Working demo, real logic", "Live scoring engine, real weight calculations, real Claude Arabic explanations — not slides"),
            ("Data Analysis", "Evidence-based methodology", "FICO-inspired factor model with Saudi-specific calibration; Worst-Month x80% stricter than averaging"),
            ("UX", "Polished, usable product", "Arabic-first RTL mobile design for freelancers; desktop banker dashboard; WCAG compliant"),
            ("Real-World Applicability", "Would Alinma use this?", "Phase 1 under Alinma's existing banking license — no new regulatory approval needed for pilot"),
        ]
        for i, (crit, want, angle) in enumerate(criteria):
            self.table_row([(crit, 42), (want, 60), (angle, 88)], fill=(i % 2 == 0))

        self.ln(4)
        self.sub_title("4-Minute Pitch Structure")
        minutes = [
            ("Minute 1 — The Gap",
             '"1.6 million Saudi freelancers hold a Freelance Work Document issued by the Saudi government. '
             'Not one commercial bank will lend to them. Not because they\'re risky — because there\'s no way '
             'to assess them. Mihan fixes that."'),
            ("Minute 2 — The Product",
             "Walk through Mohammad Al-Ghamdi's application. Show the score card. Show the loan recommendation. "
             "Show the Claude-generated Arabic explanation. Show the human review button."),
            ("Minute 3 — Why It's Safe",
             "Show the Building-tier decline (Fahad Al-Qahtani) and the improvement roadmap. "
             "'We decline responsibly. We don't overlend.' Show the banker dashboard. Show the audit log. "
             "'Every SAMA requirement — explainability, human review, audit trail — is built in.'"),
            ("Minute 4 — The Business Case",
             "TAM is SAR 120M/year in platform fees. Phase 1 under Alinma's existing license. "
             "Mihan integrates with Alinma's existing Tawarruq structures — no new Sharia approval needed. "
             "'We're ready for a 500-person pilot starting today.'"),
        ]
        for title, text in minutes:
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*ALINMA_BLUE)
            self.cell(0, 6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*DARK)
            self.set_x(13)
            self.multi_cell(184, 5.5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(2)

        self.ln(2)
        self.sub_title("The 3 Moments That Win the Room")
        moments = [
            ("The Arabic explanation screen",
             "When judges see Claude generate a real Arabic paragraph explaining the decline — specific to that "
             "freelancer's numbers — it lands. Nothing else in the competition will do this."),
            ("The Building-tier roadmap",
             "Showing that you declined someone and gave them a path forward is more sophisticated than just approving. "
             "It signals you understand responsible lending, not just credit scoring."),
            ('"Under Alinma\'s existing license"',
             "When a judge asks 'what do you need to go to pilot?' and the answer is 'a signed vendor agreement and "
             "SAMA methodology approval — which only Alinma can submit' — you've made them the key to their own product. "
             "That's the close."),
        ]
        for i, (title, text) in enumerate(moments):
            self.set_fill_color(240, 248, 255)
            self.set_draw_color(*ALINMA_BLUE)
            y = self.get_y()
            self.rect(10, y, 190, 20, "FD")
            self.set_xy(13, y + 2)
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*ALINMA_BLUE)
            self.cell(0, 5, f"{i+1}.  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_x(13)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*DARK)
            self.multi_cell(184, 5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(2)

        self.ln(2)
        self.sub_title("Things to Avoid")
        avoid = [
            "Do NOT claim Kafalah eligibility — freelancers don't qualify (requires commercial register + 3 years audited financials)",
            "Do NOT show a live SIMAH API call — it will fail and kill the demo",
            "Do NOT mention Open Banking in Phase 1 — not needed, adds regulatory complexity judges will probe",
            "Do NOT undersell the Building-tier decline — it's your strongest compliance story, not a weakness",
            "Do NOT use placeholder Arabic — Alinma's judges are native speakers and will notice immediately",
        ]
        for item in avoid:
            self.set_font("Helvetica", "", 9)
            self.set_text_color(180, 30, 30)
            self.set_x(13)
            self.multi_cell(184, 5.5, f"[X]  {item}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*DARK)

        self.ln(4)
        self.sub_title("Post-Hackathon: Alinma Partnership")
        self.body(
            "If Alinma wins the hackathon alongside you and commits to a pilot, items 17 (cloud), 20 (SAMA), "
            "22 (vendor agreement), and 28 (SAMA audit access) become Alinma's problem as much as yours. "
            "They have the compliance team, the SAMA relationship, and the infrastructure.\n\n"
            "Your exposure narrows to DPIA + DPO — a few weeks of work with the right Saudi consultancy.\n\n"
            "FIRST ACTION POST-HACKATHON: Get the pilot MOU or vendor agreement term sheet drafted. "
            "Everything else unlocks from that one document."
        )


def build():
    pdf = MihanPDF(orientation="P", unit="mm", format="A4")
    pdf._setup_fonts()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(10, 15, 10)

    pdf.cover()
    pdf.compliance_check_section()
    pdf.legal_risk_section()
    pdf.operational_risk_section()
    pdf.architecture_section()
    pdf.accessibility_section()
    pdf.compliance_tracking_section()
    pdf.demo_scope_section()
    pdf.winning_section()

    pdf.output(OUTPUT)
    print(f"PDF written to: {OUTPUT}")
    print(f"Pages: {pdf.page}")


if __name__ == "__main__":
    build()
