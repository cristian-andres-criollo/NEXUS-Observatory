import zipfile
import xml.etree.ElementTree as ET

try:
    doc = zipfile.ZipFile(r'C:\Users\cristian andres\OneDrive\Documentos\investigacion\Investigacion-1-Nexus-Observatory\Documentos Tecnicos\Especificacion_Tecnica_Nexus_Observatory.docx')
    content = doc.read('word/document.xml')
    root = ET.fromstring(content)
    text = '\n'.join(''.join(node.itertext()) for node in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'))
    with open('read_docx.txt', 'w', encoding='utf-8') as f:
        f.write(text)
except Exception as e:
    print(e)
