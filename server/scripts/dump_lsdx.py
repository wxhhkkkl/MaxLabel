import re

p = r'C:\Users\liyan\Downloads\test123.lsdx'
s = open(p, encoding='utf-8').read()

# drawpicture 完整块
for i, m in enumerate(re.finditer(r'<drawobj type="drawpicture".*?</drawobj>', s, re.S)):
    print('----- drawpicture #', i, '-----')
    print(m.group(0)[:1500])
    print()

# pictures 段
m = re.search(r'<pictures>.*?</pictures>|<pictures\s*/>', s, re.S)
if m:
    print('===== pictures 段（前 1200 字符）=====')
    print(m.group(0)[:1200])
