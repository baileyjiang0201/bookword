#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
missing_by_page = {}
for page in sorted((ROOT / 'books').glob('*/chapters/*.html')):
    soup = BeautifulSoup(page.read_text(encoding='utf-8', errors='ignore'), 'html.parser')
    vocab = {node.get('data-en', '').strip() for node in soup.select('.vocab[data-en]') if node.get('data-en', '').strip()}
    lexicon = {node.get_text(strip=True) for node in soup.select('.lexicon-en')}
    missing = sorted(vocab - lexicon)
    if missing:
        missing_by_page[str(page.relative_to(ROOT))] = missing

assert missing_by_page == {}, missing_by_page
print('Lexicon consistency QA passed')
