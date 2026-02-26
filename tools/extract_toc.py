from pypdf import PdfReader
import re

# PDF is one level above tools/
pdf_path = "../All_Subjects_MCQ_Bank-1.PDF"

reader = PdfReader(pdf_path)

lines = []
# TOC is usually in early pages; adjust if needed
for i in range(min(25, len(reader.pages))):
    text = reader.pages[i].extract_text() or ""
    for ln in text.splitlines():
        ln = ln.strip()
        # Typical TOC lines like "1. Ectopic Pregnancy .... 23"
        if re.match(r"^\d+\.\s+\S+", ln):
            lines.append(ln)

# Deduplicate while preserving order
seen = set()
out = []
for x in lines:
    if x not in seen:
        out.append(x)
        seen.add(x)

print("\n".join(out))
