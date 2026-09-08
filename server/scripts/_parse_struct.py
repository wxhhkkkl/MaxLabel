import xml.etree.ElementTree as ET
tree = ET.parse(r'C:\Users\liyan\Downloads\test123.lsdx')
root = tree.getroot()

# 搜索所有 label 元素
print('=== ALL <label> elements ===')
for el in root.iter('label'):
    print('  tag:', el.tag, 'attrib:', el.attrib)

print()
print('=== ALL <page> elements ===')
for el in root.iter('page'):
    print('  attrib:', el.attrib)

print()
print('=== labelform direct children ===')
lf = root.find('.//labelform')
for child in lf:
    print(' ', child.tag, child.attrib if child.attrib else '(no attrib)')

print()
print('=== paper direct children ===')
for p in lf.findall('paper'):
    print('paper attrib:', p.attrib)
    for child in p:
        print('   ', child.tag, child.attrib if child.attrib else '(no attrib)')
