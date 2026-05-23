"""PDF and document generation for Mind Matters v3."""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm

GOLD = colors.HexColor("#C9A961")
BLACK = colors.HexColor("#0A0A0A")
LIGHT_GOLD = colors.HexColor("#F5E6C8")

BUILTIN_TEMPLATES: dict = {}

def _base_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GOLD]),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

def render_tasks_pdf(tasks: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"],
                                  textColor=GOLD, fontSize=16, spaceAfter=8)
    elements = [Paragraph("Mind Matters — Tasks", title_style),
                Paragraph(f"Exported {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC",
                          styles["Normal"]), Spacer(1, 6*mm)]
    headers = ["SR", "Date", "Task", "Person", "Group", "Status", "Priority"]
    rows = [headers]
    for t in tasks:
        rows.append([
            str(t.get("sr_no","")), t.get("date","") or "",
            t.get("task","")[:40], t.get("name","")[:20],
            t.get("group","")[:15], t.get("status",""), "★" if t.get("flagged") else ""
        ])
    col_widths = [20*mm, 22*mm, 80*mm, 35*mm, 30*mm, 25*mm, 15*mm]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(_base_style())
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()

def render_cashflow_pdf(transactions: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"],
                                  textColor=GOLD, fontSize=16, spaceAfter=8)
    elements = [Paragraph("Mind Matters — Cash Flow", title_style),
                Paragraph(f"Exported {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC",
                          styles["Normal"]), Spacer(1, 6*mm)]
    headers = ["SR", "Date", "Vendor", "Details", "Category", "Amount (₹)", "Mode"]
    rows = [headers]
    for t in transactions:
        rows.append([
            str(t.get("sr_no","")), t.get("date","") or "",
            t.get("vendor","")[:25], t.get("details","")[:35],
            t.get("category",""), f"{float(t.get('amount',0)):,.2f}", t.get("mode","")[:15]
        ])
    col_widths = [15*mm, 22*mm, 45*mm, 65*mm, 25*mm, 30*mm, 30*mm]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(_base_style())
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()

def render_simple_statement(title: str, rows: list, headers: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"],
                                  textColor=GOLD, fontSize=14, spaceAfter=6)
    elements = [Paragraph(title, title_style), Spacer(1, 4*mm)]
    table_data = [headers] + rows
    table = Table(table_data, repeatRows=1)
    table.setStyle(_base_style())
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()

def render_by_template_id(template_id: str, data: dict) -> bytes:
    return render_simple_statement(
        title=data.get("title", "Document"),
        rows=[[str(v) for v in row] for row in data.get("rows", [])],
        headers=data.get("headers", ["Field", "Value"])
    )
