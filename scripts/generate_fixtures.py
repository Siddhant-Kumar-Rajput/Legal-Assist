from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#101D2C")
MUTED = colors.HexColor("#566575")
LIME = colors.HexColor("#C9F66F")
PAPER = colors.HexColor("#F8F5EC")
LINE = colors.HexColor("#D4D0C6")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="FixtureTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=INK, spaceAfter=10))
styles.add(ParagraphStyle(name="FixtureSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED, spaceAfter=22))
styles.add(ParagraphStyle(name="ClauseTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=INK, spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle(name="Clause", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=14, textColor=INK, spaceAfter=10))
styles.add(ParagraphStyle(name="Notice", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=12, textColor=INK, backColor=LIME, borderPadding=9, spaceAfter=18))
styles.add(ParagraphStyle(name="Centered", parent=styles["Normal"], alignment=TA_CENTER, fontSize=8, textColor=MUTED))


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(INK)
    canvas.rect(18 * mm, PAGE_H - 17 * mm, 8 * mm, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(29 * mm, PAGE_H - 16.5 * mm, "NEGOBRIEF SYNTHETIC TEST FIXTURE")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 17 * mm, PAGE_W - 18 * mm, 17 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 11 * mm, "Fictional agreement - for demonstration and testing only")
    canvas.drawRightString(PAGE_W - 18 * mm, 11 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build(name, title, parties, pages):
    path = OUTPUT / name
    frame = Frame(18 * mm, 22 * mm, PAGE_W - 36 * mm, PAGE_H - 45 * mm, leftPadding=0, rightPadding=0, topPadding=6 * mm, bottomPadding=0)
    doc = BaseDocTemplate(str(path), pagesize=A4, title=title, author="NegoBrief", subject="Synthetic contract fixture")
    doc.addPageTemplates([PageTemplate(id="contract", frames=[frame], onPage=page)])
    story = [
        Paragraph(title, styles["FixtureTitle"]),
        Paragraph(parties, styles["FixtureSubtitle"]),
        Paragraph("This fictional agreement exists only to test contract analysis. Names, companies and terms are synthetic.", styles["Notice"]),
    ]
    for page_index, clauses in enumerate(pages):
        if page_index > 0:
            story.append(PageBreak())
        for heading, body in clauses:
            story.append(Paragraph(heading, styles["ClauseTitle"]))
            story.append(Paragraph(body, styles["Clause"]))
            story.append(Spacer(1, 2 * mm))
    doc.build(story)
    return path


agreement_one = build(
    "software-freelancer-agreement.pdf",
    "Freelance Software Services Agreement",
    "Arjun Mehta (Freelancer) and Northstar Retail Private Limited (Client) - Effective 1 October 2026",
    [
        [
            ("1. Engagement", "Client engages Freelancer to design and implement a retail analytics dashboard over a twelve-week term. Freelancer will act as an independent contractor."),
            ("2. Deliverables", "Deliverables include a responsive web dashboard, an application programming interface integration, deployment notes and reasonable knowledge-transfer material."),
            ("3. Fees", "The fixed professional fee is INR 4,80,000 plus applicable taxes, invoiced against the milestones described in Schedule A."),
        ],
        [
            ("4. Payment and acceptance", "Payment shall be due within sixty (60) days after Client's written acceptance of the applicable Deliverable. Client may withhold an invoice while any Deliverable remains disputed."),
            ("5. Revisions", "Freelancer shall make all revisions requested by Client until Client is fully satisfied, at no additional charge."),
            ("6. Expenses", "Pre-approved travel and third-party service expenses will be reimbursed against valid supporting documents."),
        ],
        [
            ("7. Work Product", "All right, title and interest in the Work Product shall vest in Client immediately upon creation, whether or not payment has been made."),
            ("8. Portfolio restriction", "Freelancer shall not display, describe or refer to the Services or Work Product in any portfolio or marketing material."),
            ("9. Confidentiality", "Each party will protect the other party's confidential information using reasonable care and use it only to perform this Agreement."),
        ],
        [
            ("10. Termination", "Client may terminate for convenience on five (5) days' notice; Freelancer may terminate only on thirty (30) days' notice."),
            ("11. Liability", "Freelancer's liability under this Agreement shall be unlimited and shall include all indirect, special and consequential losses."),
            ("12. Governing law", "This Agreement is governed by the laws of India. The courts at Bengaluru, Karnataka shall have exclusive jurisdiction."),
        ],
    ],
)

agreement_two = build(
    "creative-ip-agreement.pdf",
    "Independent Creative Services Agreement",
    "Maya Rao Studio (Creator) and Everline Foods Private Limited (Client) - Draft dated 12 September 2026",
    [
        [
            ("1. Campaign", "Creator will develop a brand identity, packaging concepts and a campaign toolkit for a fixed fee of INR 2,40,000."),
            ("2. Payment", "Client will pay 40 percent on signing, 30 percent after concept approval and 30 percent on delivery."),
            ("3. Approval", "Two consolidated revision rounds are included. Additional revisions require a written change request and will be billed separately."),
        ],
        [
            ("4. Intellectual property", "Creator irrevocably assigns to Client all works, drafts, concepts, methods, source files, templates and materials created or used during the engagement, including materials created before the Effective Date."),
            ("5. Publicity", "Creator shall not identify Client, display any output or describe the engagement publicly or privately without Client's prior written consent, which may be withheld in Client's sole discretion."),
            ("6. AI use", "Client may use all submitted materials, including rejected concepts, to train, test or improve machine-learning systems without further payment or attribution."),
        ],
    ],
)

agreement_three = build(
    "consulting-liability-agreement.pdf",
    "International Consulting Agreement",
    "Rhea Sen (Consultant) and Oakline Systems LLC (Company) - Proposed term beginning 15 October 2026",
    [
        [
            ("1. Services", "Consultant will provide product strategy workshops and written recommendations for a fee of USD 7,500."),
            ("2. Termination", "Company may terminate immediately for convenience. Consultant may terminate only for Company's uncured material breach after sixty days' written notice."),
            ("3. Payment on termination", "Upon termination, Company will owe only fees for deliverables it has accepted in writing before the termination date."),
        ],
        [
            ("4. Indemnity", "Consultant shall defend, indemnify and hold Company harmless from every claim, loss, penalty, cost and expense arising directly or indirectly from the Services, without limitation."),
            ("5. Consequential loss", "Consultant is liable for loss of profit, loss of data, loss of opportunity and all consequential or special damages. Company's aggregate liability will not exceed USD 100."),
            ("6. Disputes", "Any dispute shall be resolved exclusively by confidential arbitration seated in New York, New York, under New York law. Consultant shall bear all filing and tribunal fees."),
        ],
    ],
)

for result in (agreement_one, agreement_two, agreement_three):
    print(result)
