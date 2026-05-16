#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
index = (ROOT / 'index.html').read_text(encoding='utf-8')
soup = BeautifulSoup(index, 'html.parser')

# Homepage should help readers find books by free-text search.
assert soup.select_one('#bookSearch'), 'homepage missing book search input'
assert 'wireBookSearch' in index, 'homepage JS missing book search wiring'
assert 'data-search' in index, 'book cards missing normalized search metadata'

# Empty state should be reusable for search results and category empty states.
assert '没有找到匹配作品' in index, 'homepage missing no-search-results empty state copy'

# Reader pages should include a concise interaction hint near vocabulary search.
chapters = sorted((ROOT / 'books').glob('*/chapters/*.html'))
assert chapters, 'no chapter pages found'
missing_hints = []
for chapter in chapters:
    text = chapter.read_text(encoding='utf-8', errors='ignore')
    page = BeautifulSoup(text, 'html.parser')
    if not page.select_one('.vocab-search-hint'):
        missing_hints.append(str(chapter.relative_to(ROOT)))
assert not missing_hints, f'chapters missing vocab search hint: {missing_hints[:5]}'

print('C-level QA passed')
