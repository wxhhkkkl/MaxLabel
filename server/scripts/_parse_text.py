import xml.etree.ElementTree as ET
import base64
tree = ET.parse(r'C:\Users\liyan\Downloads\test123.lsdx')
root = tree.getroot()
lf = root.find('.//labelform')

print('=== text id=4 full ===')
for t in lf.findall('.//drawobj[@id="4"]'):
    print('drawobj attrib:', t.attrib)
    font = t.find('font')
    if font is not None:
        print('font attrib:', font.attrib)
    text = t.find('text')
    if text is not None:
        print('text attrib:', text.attrib)
        print('text content:', text.text)

print()
print('=== barcode id=2 full ===')
for t in lf.findall('.//drawobj[@id="2"]'):
    print('drawobj attrib:', t.attrib)
    bc = t.find('barcode')
    if bc is not None:
        print('barcode attrib:', bc.attrib)

print()
print('=== variable 1 data decoded ===')
v1 = lf.find('.//variable[@id="1"]')
if v1 is not None:
    data = v1.get('data', '')
    print('base64:', data)
    try:
        print('decoded:', base64.b64decode(data).decode('utf-8'))
    except:
        pass

print()
print('=== labellayer structure ===')
ll = lf.find('labellayer')
if ll is not None:
    print('labellayer attrib:', ll.attrib)
    for child in ll:
        print(' ', child.tag, child.attrib if child.attrib else '')
        for sub in child:
            print('    ', sub.tag, sub.attrib if sub.attrib else '')
