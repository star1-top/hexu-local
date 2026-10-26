"""Synthetic fixtures only; no actual client information."""
import io
import zipfile
from lxml import etree as E
from .docx_engine import W, R, CT, serialize


SAMPLES = [
    {'title': '品牌视觉设计服务合同', 'party': '青屿设计 × 星野科技', 'kind': '服务合同', 'clauses': [
        ('第一条  服务内容', '乙方为甲方提供品牌视觉识别系统设计服务，包括品牌标识、基础规范及应用物料。', '请业务确认应用物料的数量与交付范围，避免后续额外工作。'),
        ('第二条  项目交付', '乙方应于项目启动后 30 个工作日内完成设计，并向甲方交付最终成果及源文件。', '请业务确认我们是否能够交付全部源文件，并补充第三方字体授权情况。'),
        ('第三条  费用与支付', '合同总价为人民币 80,000 元。甲方在签署后支付 50%，验收后支付剩余 50%。', '请向对方确认尾款支付期限，建议明确为验收后十个工作日。'),
        ('第四条  知识产权', '甲方付清全部款项后，最终设计成果的著作权归甲方所有。', '请业务确认素材权利来源；对外请补充既有素材及第三方素材的权利保留说明。'),
        ('第五条  验收与修改', '甲方应在收到成果后及时组织验收，乙方根据反馈完成合理修改。', '请评估是否合适。'),
        ('第六条  保密义务', '双方对合作中获悉的商业信息承担保密义务，未经对方书面同意不得向第三方披露。', '请对方确认保密义务在合同终止后继续有效两年。'),
    ]},
    {'title': '软件技术支持服务协议', 'party': '云帆软件 × 远山工作室', 'kind': '技术服务', 'clauses': [
        ('第一条  支持范围', '乙方提供工作日 9:00—18:00 的线上技术支持。', '请业务确认是否具备节假日响应能力。'),
        ('第二条  服务费用', '本期服务费用为人民币 36,000 元，按季度支付。', '请对方确认开票后十五个工作日付款。'),
        ('第三条  数据处理', '乙方仅为提供约定服务访问甲方授权的测试数据。', '请业务补充测试数据脱敏的事实说明。'),
    ]},
    {'title': '市场推广合作协议', 'party': '松间文化 × 拾光品牌', 'kind': '市场合作', 'clauses': [
        ('第一条  合作安排', '双方拟于 2026 年 11 月共同开展品牌展示活动。', '请业务确认场地及举办日期是否已落实。'),
        ('第二条  物料交付', '乙方应于活动前五个工作日提供全部展示物料。', '请对方补充交付物料的尺寸及验收标准。'),
        ('第三条  费用结算', '双方根据实际发生且经确认的费用完成结算。', '请评估结算安排。'),
    ]},
]


def make_docx(sample=0, no_comments=False, table=False):
    s = SAMPLES[sample % len(SAMPLES)]
    doc = E.Element(f'{{{W}}}document', nsmap={'w': W})
    body = E.SubElement(doc, f'{{{W}}}body')

    def paragraph(parent, text, heading=False):
        p = E.SubElement(parent, f'{{{W}}}p')
        if heading:
            props = E.SubElement(p, f'{{{W}}}pPr')
            E.SubElement(props, f'{{{W}}}pStyle', {f'{{{W}}}val': 'Heading1'})
        run = E.SubElement(p, f'{{{W}}}r')
        E.SubElement(run, f'{{{W}}}t').text = text
        return p

    paragraph(body, s['title'], True)
    paragraph(body, s['party'])
    paragraph(body, '虚构演示合同，仅用于体验合序工作流程，不构成合同范本。')
    comments = E.Element(f'{{{W}}}comments', nsmap={'w': W})
    for i, (title, clause, comment) in enumerate(s['clauses']):
        paragraph(body, title, True)
        parent = body
        if table and i == 0:
            tbl = E.SubElement(body, f'{{{W}}}tbl')
            tr = E.SubElement(tbl, f'{{{W}}}tr')
            parent = E.SubElement(tr, f'{{{W}}}tc')
        p = paragraph(parent, clause)
        if not no_comments:
            p.insert(0, E.Element(f'{{{W}}}commentRangeStart', {f'{{{W}}}id': str(i)}))
            E.SubElement(p, f'{{{W}}}commentRangeEnd', {f'{{{W}}}id': str(i)})
            r = E.SubElement(p, f'{{{W}}}r')
            E.SubElement(r, f'{{{W}}}commentReference', {f'{{{W}}}id': str(i)})
            c = E.SubElement(comments, f'{{{W}}}comment', {f'{{{W}}}id': str(i), f'{{{W}}}author': '演示法务', f'{{{W}}}date': '2026-10-19T08:00:00Z'})
            paragraph(c, comment)
    sect = E.SubElement(body, f'{{{W}}}sectPr')
    E.SubElement(sect, f'{{{W}}}pgSz', {f'{{{W}}}w': '11906', f'{{{W}}}h': '16838'})
    E.SubElement(sect, f'{{{W}}}pgMar', {f'{{{W}}}top': '1440', f'{{{W}}}right': '1440', f'{{{W}}}bottom': '1440', f'{{{W}}}left': '1440'})
    styles = E.Element(f'{{{W}}}styles', nsmap={'w': W})
    style = E.SubElement(styles, f'{{{W}}}style', {f'{{{W}}}type': 'paragraph', f'{{{W}}}styleId': 'Heading1'})
    E.SubElement(style, f'{{{W}}}name', {f'{{{W}}}val': 'heading 1'})
    rpr = E.SubElement(style, f'{{{W}}}rPr')
    E.SubElement(rpr, f'{{{W}}}b')
    E.SubElement(rpr, f'{{{W}}}sz', {f'{{{W}}}val': '30'})
    types = E.Element(f'{{{CT}}}Types', nsmap={None: CT})
    E.SubElement(types, f'{{{CT}}}Default', Extension='rels', ContentType='application/vnd.openxmlformats-package.relationships+xml')
    E.SubElement(types, f'{{{CT}}}Default', Extension='xml', ContentType='application/xml')
    for part, typ in [('document', 'document.main'), ('styles', 'styles')] + ([] if no_comments else [('comments', 'comments')]):
        E.SubElement(types, f'{{{CT}}}Override', PartName=f'/word/{part}.xml', ContentType=f'application/vnd.openxmlformats-officedocument.wordprocessingml.{typ}+xml')
    E.SubElement(types, f'{{{CT}}}Override', PartName='/docProps/core.xml', ContentType='application/vnd.openxmlformats-package.core-properties+xml')
    rels = E.Element(f'{{{R}}}Relationships', nsmap={None: R})
    base = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    E.SubElement(rels, f'{{{R}}}Relationship', Id='rId1', Type=base+'officeDocument', Target='word/document.xml')
    E.SubElement(rels, f'{{{R}}}Relationship', Id='rId2', Type='http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', Target='docProps/core.xml')
    drel = E.Element(f'{{{R}}}Relationships', nsmap={None: R})
    E.SubElement(drel, f'{{{R}}}Relationship', Id='rId1', Type=base+'styles', Target='styles.xml')
    if not no_comments:
        E.SubElement(drel, f'{{{R}}}Relationship', Id='rId2', Type=base+'comments', Target='comments.xml')
    parts = {'[Content_Types].xml': serialize(types), '_rels/.rels': serialize(rels), 'word/document.xml': serialize(doc), 'word/styles.xml': serialize(styles), 'word/_rels/document.xml.rels': serialize(drel), 'docProps/core.xml': b'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>SYNTHETIC_PRIVATE_AUTHOR</dc:creator></cp:coreProperties>'}
    if not no_comments:
        parts['word/comments.xml'] = serialize(comments)
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, value in parts.items():
            z.writestr(name, value)
    return out.getvalue()
