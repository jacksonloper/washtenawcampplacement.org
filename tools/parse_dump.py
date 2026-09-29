"""Parse our gzipped SQL dump into JSON rows per table (no MySQL needed)."""
import gzip, json, re, sys

ESC = {'0': '\0', 'n': '\n', 'r': '\r', 'Z': '\x1a', '\\': '\\', "'": "'", '"': '"'}

def parse_tuple(s, i):
    # s[i] == '('
    assert s[i] == '('
    i += 1
    vals = []
    while True:
        c = s[i]
        if c == "'":
            i += 1
            buf = []
            while True:
                c = s[i]
                if c == '\\':
                    buf.append(ESC.get(s[i + 1], s[i + 1])); i += 2
                elif c == "'":
                    i += 1; break
                else:
                    buf.append(c); i += 1
            vals.append(''.join(buf))
        elif s.startswith('NULL', i):
            vals.append(None); i += 4
        else:
            raise ValueError(f'unexpected {s[i:i+20]!r}')
        if s[i] == ',':
            i += 1; continue
        if s[i] == ')':
            return vals, i + 1

def main(path, out):
    sql = gzip.open(path, 'rt', encoding='utf-8', errors='surrogateescape').read()
    cols, tables = {}, {}
    for m in re.finditer(r'CREATE TABLE `(\w+)` \((.*?)\n\) ENGINE', sql, re.S):
        cols[m.group(1)] = re.findall(r'^\s+`(\w+)`', m.group(2), re.M)
    for m in re.finditer(r'INSERT INTO `(\w+)` VALUES\n', sql):
        t, i = m.group(1), m.end()
        rows = tables.setdefault(t, [])
        while True:
            vals, i = parse_tuple(sql, i)
            rows.append(dict(zip(cols[t], vals)))
            if sql[i] == ';': break
            assert sql[i:i + 2] == ',\n'; i += 2
    json.dump(tables, open(out, 'w'), ensure_ascii=False)
    for t, r in tables.items(): print(f'{t:32} {len(r)}')

main(sys.argv[1], sys.argv[2])
