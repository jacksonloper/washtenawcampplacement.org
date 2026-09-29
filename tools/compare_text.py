"""Compare page text on the live WordPress site with the static build."""
import html, re, sys, urllib.request
from html.parser import HTMLParser
from difflib import SequenceMatcher

class Text(HTMLParser):
    def __init__(self, start_id=None, start_tag=None):
        super().__init__(); self.depth = 0; self.words = []; self.skip = 0
        self.start_id, self.start_tag = start_id, start_tag
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.depth: self.depth += tag not in ('img','br','hr','meta','link','input','source')
        elif (self.start_id and a.get('id') == self.start_id) or (self.start_tag and tag == self.start_tag): self.depth = 1
        if tag in ('script','style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip -= 1
        if self.depth and tag not in ('img','br','hr'): self.depth -= 1
    def handle_data(self, d):
        if self.depth and not self.skip: self.words += re.findall(r"[\w$’'%.,:;!?\"“”()-]+", d)

def words(src, **kw):
    p = Text(**kw); p.feed(src); 
    return [w.strip('.,:;!?"“”()').lower() for w in p.words if w.strip('.,:;!?"“”()')]

pages = sys.argv[1:]
for u in pages:
    live = urllib.request.urlopen(urllib.request.Request('https://washtenawcampplacement.org' + u, headers={'User-Agent': 'Mozilla/5.0'})).read().decode()
    stat = open('site/dist' + u + 'index.html').read()
    a, b = words(live, start_id='main-content'), words(stat, start_tag='main')
    sm = SequenceMatcher(None, a, b, autojunk=False)
    missing = [' '.join(a[i1:i2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ('delete', 'replace')]
    extra = [' '.join(b[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ('insert', 'replace')]
    print(f'{u:44} live={len(a):5} static={len(b):5} match={sm.ratio():.3f}')
    for m in missing[:6]: print('     - only on live:  ', m[:110])
    for m in extra[:6]: print('     + only static:   ', m[:110])
