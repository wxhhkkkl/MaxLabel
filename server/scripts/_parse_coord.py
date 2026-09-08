import xml.etree.ElementTree as ET
tree = ET.parse(r'C:\Users\liyan\Downloads\test123.lsdx')
root = tree.getroot()
lf = root.find('.//labelform')
print('=== paper (name) ===')
for p in lf.findall('paper'):
    print(p.attrib)
print('=== labelformat ===')
lfmt = lf.find('labelformat')
if lfmt is not None: print(lfmt.attrib)
print('=== page ===')
page = lf.find('page')
if page is not None: print(page.attrib)
print('=== label ===')
label = lf.find('label')
if label is not None: print(label.attrib)
print('=== form ===')
form = lf.find('form')
if form is not None: print(form.attrib)
print()
print('=== drawobj (id, type, left, top, right, bottom) ===')
for o in lf.findall('.//labelobjects/drawobj'):
    a = o.attrib
    print(f"  id={a.get('id')} type={a.get('type')} L={a.get('left')} T={a.get('top')} R={a.get('right')} B={a.get('bottom')} rot={a.get('rotation')}")
