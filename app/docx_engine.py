"""Conservative OOXML inspection and comment-only copy editing.

All untouched package entries remain byte-identical; document XML is never
rebuilt from extracted text. Unsupported packages fail closed.
"""
import hashlib
import io
import posixpath
import zipfile
from copy import deepcopy
from lxml import etree as E

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
NS = {'w': W}
MAX_BYTES = 10 * 1024 * 1024
MAX_COMMENTS = 300


class DocumentError(ValueError):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def xml(data):
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise DocumentError('不支持含 DTD 或实体声明的 XML。')
    try:
        return E.fromstring(data, E.XMLParser(resolve_entities=False, no_network=True))
    except E.XMLSyntaxError as exc:
        raise DocumentError('文档 XML 已损坏，无法安全解析。') from exc


def serialize(root):
    return E.tostring(root, encoding='UTF-8', xml_declaration=True, standalone=True)


def package(data, filename='合同.docx'):
    if not filename.lower().endswith('.docx'):
        raise DocumentError('仅支持 .docx 审阅版，PDF、图片和 .doc 暂不支持。')
    if len(data) > MAX_BYTES:
        raise DocumentError('文件超过 10MB，请缩小文件后重试。')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            entries = z.infolist()
            names = [i.filename for i in entries]
            if len(entries) > 3000 or sum(i.file_size for i in entries) > 80 * 1024 * 1024:
                raise DocumentError('压缩包展开超过安全限制。')
            if len(names) != len(set(names)):
                raise DocumentError('文档包含重复 ZIP 部件。')
            if any(i.flag_bits & 1 for i in entries):
                raise DocumentError('不支持加密或密码保护的文档。')
            if any(n.startswith('/') or '..' in n.split('/') for n in names):
                raise DocumentError('文档包含非法部件路径。')
            parts = {n: z.read(n) for n in names if not n.endswith('/')}
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise DocumentError('文件不是有效的 Word .docx，可能已损坏或加密。') from exc
    for required in ('[Content_Types].xml', '_rels/.rels', 'word/document.xml'):
        if required not in parts:
            raise DocumentError('文件缺少必要的 Word 部件。')
    for name, body in parts.items():
        if name.endswith(('.xml', '.rels')):
            xml(body)
    return parts


def inspect(data, filename='合同.docx'):
    parts = package(data, filename)
    errors = []
    if any('comments' in n.lower() and n != 'word/comments.xml' for n in parts):
        errors.append('存在现代线程批注或批注附属部件，首版仅支持传统批注。')
    if any('vbaproject' in n.lower() or n.startswith(('word/embeddings/', 'customXml/')) for n in parts):
        errors.append('存在宏、嵌入对象或自定义 XML，无法确认清理完整性。')
    if any(n.startswith(('_xmlsignatures/', 'word/glossary/')) for n in parts):
        errors.append('不支持数字签名或文档构建基块。')
    content_types = parts['[Content_Types].xml'].decode('utf-8', 'replace').lower()
    if 'macroenabled' in content_types:
        errors.append('不支持启用宏的文档。')
    for name, body in parts.items():
        if name.endswith('.xml') and name.startswith('word/'):
            root = xml(body)
            if root.xpath('//w:ins|//w:del|//w:moveFrom|//w:moveTo|//*[contains(local-name(), "PrChange")]|//w:cellIns|//w:cellDel|//w:cellMerge|//w:numberingChange|//w:moveFromRangeStart|//w:moveToRangeStart|//w:customXmlInsRangeStart|//w:customXmlDelRangeStart', namespaces=NS):
                errors.append('存在未处理的修订，请先在 Word 中逐条处理后重新上传。')
            if root.xpath('//w:documentProtection|//w:writeProtection', namespaces=NS):
                errors.append('不支持受保护文档。')
            if root.xpath('//w:object|//w:altChunk|//w:subDoc', namespaces=NS):
                errors.append('存在不支持的嵌入对象或外部正文。')
            if root.xpath('//w:txbxContent//w:commentRangeStart|//w:pict//w:commentRangeStart|//w:drawing//w:commentRangeStart', namespaces=NS):
                errors.append('文本框或形状中的批注暂不支持。')
            if name != 'word/document.xml' and name != 'word/comments.xml' and root.xpath('//w:commentRangeStart|//w:commentReference', namespaces=NS):
                errors.append('页眉、页脚或其他部件中的批注暂不支持。')
        if name.endswith('.rels'):
            for rel in xml(body):
                kind = rel.get('Type', '').rsplit('/', 1)[-1]
                if rel.get('TargetMode') == 'External' and kind != 'hyperlink':
                    errors.append('包含外部链接资源，无法保证离线文件完整性。')
                if kind == 'comments' and (name != 'word/_rels/document.xml.rels' or posixpath.normpath(posixpath.join('word', rel.get('Target', ''))) != 'word/comments.xml'):
                    errors.append('非标准批注部件位置暂不支持。')
    doc = xml(parts['word/document.xml'])
    if doc.tag != f'{{{W}}}document':
        raise DocumentError('不支持此 Word XML 命名空间（仅支持基础 OOXML 文档）。')
    paragraphs = []
    for i, p in enumerate(doc.xpath('//w:body//w:p[not(ancestor::w:txbxContent)]', namespaces=NS)):
        text = ''.join(p.xpath('.//w:t/text()', namespaces=NS))
        ids = p.xpath('.//w:commentRangeStart/@w:id', namespaces=NS)
        if text.strip():
            style = p.xpath('./w:pPr/w:pStyle/@w:val', namespaces=NS)
            paragraphs.append({'index': i, 'text': text, 'comment_ids': ids, 'table': bool(p.xpath('ancestor::w:tbl', namespaces=NS)), 'heading': bool(style and ('heading' in style[0].lower() or style[0] == 'Title'))})
    comments = []
    seen = set()
    if 'word/comments.xml' in parts:
        croot = xml(parts['word/comments.xml'])
        raw = croot.findall(f'{{{W}}}comment')
        if len(raw) > MAX_COMMENTS:
            errors.append('批注超过 300 条，请拆分文档。')
        for c in raw:
            cid = c.get(f'{{{W}}}id', '')
            starts = doc.xpath('//w:commentRangeStart[@w:id=$id]', namespaces=NS, id=cid)
            ends = doc.xpath('//w:commentRangeEnd[@w:id=$id]', namespaces=NS, id=cid)
            refs = doc.xpath('//w:commentReference[@w:id=$id]', namespaces=NS, id=cid)
            if not cid.isdigit() or cid in seen or len(starts) != 1 or len(ends) != 1 or len(refs) != 1:
                errors.append(f'批注 {cid or "未知"} 的 ID 或锚点无效，无法可靠定位。')
            seen.add(cid)
            active = False
            excerpt = []
            complete = False
            for el in doc.iter():
                if el.tag == f'{{{W}}}commentRangeStart' and el.get(f'{{{W}}}id') == cid:
                    active = True
                elif el.tag == f'{{{W}}}commentRangeEnd' and el.get(f'{{{W}}}id') == cid:
                    complete = active
                    active = False
                    break
                elif active and el.tag == f'{{{W}}}t':
                    excerpt.append(el.text or '')
            if not complete:
                errors.append(f'批注 {cid} 的起止位置无法匹配。')
            if c.xpath('.//w:drawing|.//w:pict|.//w:object|.//w:altChunk|.//w:tbl|.//*[@*[local-name()="id" and namespace-uri()="http://schemas.openxmlformats.org/officeDocument/2006/relationships"]]', namespaces=NS):
                errors.append(f'批注 {cid} 含非纯文本内容，首版暂不支持。')
            p = next((p for p in paragraphs if cid in p['comment_ids']), None)
            comments.append({'id': cid, 'text': '\n'.join(''.join(p.xpath('.//w:t/text()', namespaces=NS)) for p in c.findall(f'{{{W}}}p')), 'quote': ''.join(excerpt), 'paragraph': p['index'] if p else -1, 'location': ('表格 · ' if p and p['table'] else '正文 · ') + f'第 {(p["index"] + 1) if p else "?"} 段', 'author': c.get(f'{{{W}}}author', '原批注作者')})
    anchors = doc.xpath('//w:commentRangeStart/@w:id|//w:commentRangeEnd/@w:id|//w:commentReference/@w:id', namespaces=NS)
    if set(anchors) - seen:
        errors.append('存在没有对应批注正文的孤立锚点。')
    return {'comments': comments, 'paragraphs': paragraphs, 'errors': list(dict.fromkeys(errors)), 'fingerprint': digest(data), 'size': len(data)}


def _strip_markers(root):
    for el in root.xpath('//w:commentRangeStart|//w:commentRangeEnd|//w:commentReference', namespaces=NS):
        parent = el.getparent()
        parent.remove(el)
        if parent.tag == f'{{{W}}}r' and len(parent) == 0:
            parent.getparent().remove(parent)
    return root


def candidate(data, decisions):
    result = inspect(data)
    if result['errors']:
        raise DocumentError('；'.join(result['errors']))
    parts = package(data)
    before = deepcopy(xml(parts['word/document.xml']))
    doc = xml(parts['word/document.xml'])
    by_id = {c['id']: c for c in decisions}
    external = {}
    excluded_text = []
    for original in result['comments']:
        c = by_id.get(original['id'])
        if not c or not c.get('confirmed'):
            raise DocumentError('仍有未经人工确认的批注。')
        output = c['output']
        if output == 'external':
            external[c['id']] = original['text']
        elif output == 'rewrite' and c.get('external_text', '').strip():
            external[c['id']] = c['external_text'].strip()
            if external[c['id']] != original['text']:
                excluded_text.append(original['text'])
        elif output == 'internal':
            excluded_text.append(original['text'])
        else:
            raise DocumentError('批注输出决定不完整。')
    for el in list(doc.xpath('//w:commentRangeStart|//w:commentRangeEnd|//w:commentReference', namespaces=NS)):
        if el.get(f'{{{W}}}id') not in external:
            parent = el.getparent()
            parent.remove(el)
            if parent.tag == f'{{{W}}}r' and len(parent) == 0:
                parent.getparent().remove(parent)
    if E.tostring(_strip_markers(before), method='c14n') != E.tostring(_strip_markers(deepcopy(doc)), method='c14n'):
        raise DocumentError('正文结构完整性校验失败。')
    parts['word/document.xml'] = serialize(doc)
    if external:
        root = E.Element(f'{{{W}}}comments', nsmap={'w': W})
        for cid, text in external.items():
            el = E.SubElement(root, f'{{{W}}}comment', {f'{{{W}}}id': cid, f'{{{W}}}author': '合序协作批注'})
            for line in text.split('\n'):
                p = E.SubElement(el, f'{{{W}}}p')
                r = E.SubElement(p, f'{{{W}}}r')
                E.SubElement(r, f'{{{W}}}t', {'{http://www.w3.org/XML/1998/namespace}space': 'preserve'}).text = line
        parts['word/comments.xml'] = serialize(root)
    else:
        parts.pop('word/comments.xml', None)
    removed = {n for n in parts if n.startswith('docProps/')}
    if not external:
        removed.add('word/comments.xml')
    for n in removed:
        parts.pop(n, None)
    for n in list(parts):
        if not n.endswith('.rels'):
            continue
        root = xml(parts[n])
        changed = False
        base = '' if n == '_rels/.rels' else posixpath.dirname(posixpath.dirname(n))
        for rel in list(root):
            target = rel.get('Target', '')
            resolved = posixpath.normpath(posixpath.join(base, target)).lstrip('/')
            if resolved in removed or (not external and rel.get('Type', '').endswith('/comments')):
                root.remove(rel)
                changed = True
        if changed:
            parts[n] = serialize(root)
    types = xml(parts['[Content_Types].xml'])
    for el in list(types):
        if el.get('PartName', '').lstrip('/') in removed:
            types.remove(el)
    parts['[Content_Types].xml'] = serialize(types)
    # Remove revision-session identifiers and personal author stamps on document XML.
    for el in doc.iter():
        for attr in list(el.attrib):
            if E.QName(attr).localname.startswith('rsid'):
                del el.attrib[attr]
    parts['word/document.xml'] = serialize(doc)
    # Text-level leak check across all XML, including split runs and properties.
    for name, body in parts.items():
        if not name.endswith(('.xml', '.rels')):
            continue
        root = xml(body)
        content = ''.join(root.itertext()) + ' '.join(v for el in root.iter() for v in el.attrib.values())
        if any(t.strip() and t.strip() in content for t in excluded_text):
            raise DocumentError('排除的批注文字仍出现在候选部件中，请人工检查源文件。')
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, body in parts.items():
            z.writestr(n, body)
    final = out.getvalue()
    check = inspect(final)
    if check['errors'] or {c['id']: c['text'] for c in check['comments']} != external:
        raise DocumentError('候选文件回读校验失败。')
    return final
