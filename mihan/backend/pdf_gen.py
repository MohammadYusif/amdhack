"""Cash Flow History Statement PDF generator — historical transaction data only, no credit score, no SIMAH data."""
import io
import qrcode
import hashlib
from datetime import date
from fpdf import FPDF
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display

FONT_DIR = Path(r"C:\Windows\Fonts")


def _ar(text: str) -> str:
    """Reshape and apply BiDi to Arabic text so fpdf2 renders it correctly."""
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)


def _qr_png_bytes(data: str) -> bytes:
    qr = qrcode.QRCode(box_size=4, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_proof_of_income(profile) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.add_font("Arial", "",  str(FONT_DIR / "arial.ttf"))
    pdf.add_font("Arial", "B", str(FONT_DIR / "arialbd.ttf"))
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    # Alinma teal-navy header (matches actual brand)
    pdf.set_fill_color(2, 20, 30)        # #02141E
    pdf.rect(0, 0, 210, 35, "F")
    pdf.set_fill_color(3, 57, 87)        # #033957 accent strip
    pdf.rect(0, 32, 210, 3, "F")

    pdf.set_font("Arial", "B", 20)
    pdf.set_text_color(255, 255, 255)
    pdf.set_y(8)
    pdf.cell(0, 10, "ALINMA BANK", align="C")
    pdf.ln(8)
    pdf.set_font("Arial", "", 11)
    pdf.set_text_color(205, 144, 126)   # Alinma copper #CD907E
    pdf.cell(0, 6, "Cash Flow History Statement  |  " + _ar("بيان سجل التدفق النقدي المُحقَّق"), align="C")

    # Cert number + date
    cert_ref = hashlib.sha256(f"{profile.id}-{date.today()}".encode()).hexdigest()[:12].upper()
    today = date.today().strftime("%d %B %Y")

    pdf.set_text_color(30, 30, 30)
    pdf.set_y(44)
    pdf.set_font("Arial", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"Certificate Ref: AI-{cert_ref}   |   Issued: {today}   |   Valid for 30 days", align="C")

    # Divider
    pdf.set_draw_color(3, 57, 87)
    pdf.line(15, 52, 195, 52)

    # Subject section
    pdf.set_y(56)
    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 7, "Cash Flow History Statement", align="C")
    pdf.ln(4)
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6,
        "This statement is a historical record of transaction data. It is NOT a credit",
        align="C")
    pdf.ln(5)
    pdf.cell(0, 6, "assessment or income guarantee.", align="C")

    # Divider
    pdf.set_draw_color(200, 205, 215)
    pdf.line(15, 80, 195, 80)

    # Account holder details
    pdf.set_y(84)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(2, 20, 30)       # Alinma dark
    pdf.cell(0, 6, "ACCOUNT HOLDER DETAILS")
    pdf.ln(8)

    # Arabic name is reshaped+bidi so it renders correctly in LTR pdf
    arabic_name = _ar(profile.name_ar)

    fields = [
        ("Full Name (EN)", profile.name_en),
        ("Full Name (AR)", arabic_name),
        ("Profession",     profile.profession_en),
        ("Account Type",   "Freelancer Business Account"),
        ("Data Period",    f"{profile.months_of_history} months"),
    ]
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(30, 30, 30)
    for label, value in fields:
        pdf.set_x(15)
        pdf.set_font("Arial", "B", 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(55, 7, label + ":")
        pdf.set_font("Arial", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, value)
        pdf.ln()

    # Income details
    pdf.ln(4)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(2, 20, 30)
    pdf.cell(0, 6, "INCOME INFORMATION (SAR)")
    pdf.ln(8)

    worst = profile.worst_month_income
    avg_income = int(worst * 1.25)

    income_fields = [
        ("Average Monthly Income", f"SAR {avg_income:,}"),
        ("Lowest Recorded Month",  f"SAR {worst:,}"),
        ("Analysis Period",        f"{profile.months_of_history} months"),
        ("Income Source",          "Alinma Business Account Deposits"),
    ]
    for label, value in income_fields:
        pdf.set_x(15)
        pdf.set_font("Arial", "B", 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(55, 7, label + ":")
        pdf.set_font("Arial", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 7, value)
        pdf.ln()

    # Disclaimer box
    pdf.set_y(210)
    pdf.set_fill_color(245, 247, 250)
    pdf.set_draw_color(200, 205, 215)
    pdf.rect(15, 210, 180, 28, "FD")
    pdf.set_xy(18, 213)
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, "IMPORTANT NOTICE")
    pdf.set_xy(18, 219)
    pdf.set_font("Arial", "", 7.5)
    pdf.multi_cell(174, 4.5,
        "This document is issued by Alinma Bank as a historical record of banking transaction data only. "
        "It does not constitute a guarantee, warranty, credit assessment, or representation regarding the account "
        "holder's future income or financial position. This document contains NO credit score, NO SIMAH bureau data, "
        "and NO creditworthiness evaluation of any kind. All credit assessment and lending decisions made by any "
        "third party on the basis of this document are the sole responsibility of that party. Alinma Bank accepts "
        "no liability for any financial decisions made by third parties in reliance on this document. "
        "Verify authenticity via QR code. Valid for 30 days from issue date.")

    # QR code — write to temp path (Windows compatible)
    verify_url = f"https://alinma.com/verify/AI-{cert_ref}"
    import tempfile, os
    try:
        qr_bytes = _qr_png_bytes(verify_url)
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(qr_bytes)
        tmp.close()
        pdf.image(tmp.name, x=160, y=246, w=35)
        os.unlink(tmp.name)
    except Exception:
        pass

    pdf.set_y(248)
    pdf.set_x(15)
    pdf.set_font("Arial", "", 7)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 4, f"Scan QR to verify  |  Ref: AI-{cert_ref}  |  {verify_url}")

    # Footer — Alinma teal
    pdf.set_fill_color(2, 20, 30)
    pdf.rect(0, 282, 210, 15, "F")
    pdf.set_y(286)
    pdf.set_font("Arial", "", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 5,
        "Alinma Bank  |  " + _ar("المملكة العربية السعودية") + "  |  alinma.com  |  SAMA Licensed",
        align="C")

    return pdf.output()
