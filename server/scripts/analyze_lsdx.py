import re
import os

base = r'C:\Users\liyan\Downloads'
for f in ['test.lsdx', '新标签模板1.lsdx']:
    p = os.path.join(base, f)
    s = open(p, encoding='utf-8').read()
    print('=====', f, 'len', len(s))
    print(' drawobj types:', re.findall(r'<drawobj type="([^"]+)"', s))
    print(' label size:', re.search(r'<label width="(\d+)" height="(\d+)"', s).groups())
    print(' page:', re.search(r'<page[^>]*>', s).group())
    print(' btypes:', re.findall(r'<barcode btype="(\d+)"', s))
    print(' objvarlink:', re.findall(r'<objvarlink[^>]*>', s))
    print(' variable count:', len(re.findall(r'<variable ', s)))
    # 各 drawobj 的完整属性
    for m in re.finditer(r'<drawobj type="([^"]+)"[^>]*>', s):
        print('  drawobj attrs:', m.group(0)[:220])
    # 非 drawobj 的其他标签（区分对象子元素）
    print(' top-level tags:', re.findall(r'<(\w+)', s)[:40])
