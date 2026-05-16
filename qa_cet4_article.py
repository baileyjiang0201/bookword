#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
import json, re

ROOT = Path(__file__).resolve().parent
SLUG = 'cet4-rainy-club'
BOOK = ROOT / 'books' / SLUG
CHAPTER = BOOK / 'chapters' / '001-第一章-雨后通知.html'
assert BOOK.exists(), 'CET4 book folder missing'
assert CHAPTER.exists(), 'CET4 chapter missing'
index = (ROOT / 'index.html').read_text(encoding='utf-8')
soup = BeautifulSoup(index, 'html.parser')
card = soup.select_one(f'a.book-card[href="books/{SLUG}/index.html"]')
assert card is not None, 'homepage card missing'
assert card.get('data-vocabulary-slug') == 'cet4', 'homepage card must be CET4'
assert '四级词汇' in card.get_text(' ', strip=True), 'card should show CET4 label'
match = re.search(r'const library = (.*?);\n\s*const vocabularySelect', index, re.S)
assert match, 'homepage library JSON missing'
library = json.loads(match.group(1))
entry = next((b for b in library if b.get('slug') == SLUG), None)
assert entry, 'library JSON entry missing'
assert entry.get('vocabulary_slug') == 'cet4'
assert entry.get('vocabulary_category') == '四级词汇'
chapter_html = CHAPTER.read_text(encoding='utf-8')
chapter_soup = BeautifulSoup(chapter_html, 'html.parser')
vocab = {n.get('data-en','').strip() for n in chapter_soup.select('.vocab[data-en]') if n.get('data-en','').strip()}
lex = {n.get_text(strip=True) for n in chapter_soup.select('.lexicon-en')}
assert len(vocab) >= 18, f'expected at least 18 CET4 vocab terms, got {len(vocab)}'
assert vocab - lex == set(), f'missing lexicon entries: {sorted(vocab-lex)}'
assert '中文（' not in chapter_html and '（English' not in chapter_html
assert 'TXT' not in chapter_html and 'download' not in chapter_html
print('CET4 article QA passed')
