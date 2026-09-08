import xml.etree.ElementTree as ET
tree = ET.parse(r'C:\Users\liyan\Downloads\test123.lsdx')
root = tree.getroot()
lf = root.find('.//labelform')

print('=== group id=9 children ===')
for g in lf.findall('.//drawobj[@type="drawgroup"]'):
    print('group attrib:', g.attrib)
    for child in g.findall('.//drawobj'):
        a = child.attrib
        print(f"  child id={a.get('id')} type={a.get('type')} L={a.get('left')} T={a.get('top')} R={a.get('right')} B={a.get('bottom')}")
        # 文本内容
        text_el = child.find('text')
        if text_el is not None:
            print('    text str:', text_el.get('str'), 'textcontent:', text_el.text)
        font_el = child.find('font')
        if font_el is not None:
            print('    font:', font_el.attrib)

print()
print('=== ALL text objects ===')
for t in lf.findall('.//drawobj[@type="drawtext"]'):
    a = t.attrib
    text_el = t.find('text')
    val = text_el.get('str') if text_el is not None else t.get('text')
    print(f"  id={a.get('id')} L={a.get('left')} T={a.get('top')} R={a.get('right')} B={a.get('bottom')} text={val}")

print()
print('=== variables ===')
for v in lf.findall('.//variable'):
    print(' ', v.attrib)

print()
print('=== objvarlink ===')
ovl = lf.find('.//objvarlink')
if ovl is not None:
    print(' ', ovl.attrib)
