from contextvars import ContextVar

CURRENT_ACTOR = ContextVar("hexu_actor", default="演示法务")

import base64
import json
import os
import shutil
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from . import docx_engine as word
from .fixtures import make_docx, SAMPLES

LABELS = {'internal', 'external', 'uncertain'}
OUTPUTS = {'internal', 'external', 'rewrite', 'pending'}


class RuleError(ValueError):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def uid():
    return uuid.uuid4().hex


def fingerprint(value):
    return word.digest(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def text(value, limit=20000):
    if not isinstance(value, str) or len(value) > limit:
        raise RuleError('文本格式错误或长度超出限制。')
    return value.strip()


def decode_file(payload, limit=word.MAX_BYTES):
    try:
        raw = payload.get('data', '')
        if not isinstance(raw, str) or len(raw) > ((limit + 2) // 3) * 4:
            raise RuleError('文件超过大小限制。')
        data = base64.b64decode(raw, validate=True)
    except (ValueError, TypeError) as exc:
        raise RuleError('文件编码无效，请重新选择文件。') from exc
    if len(data) > limit:
        raise RuleError('文件超过大小限制。')
    return data


def suggestion(c, mode='simulation', raw=None):
    fallback = {'labels': ['uncertain'], 'needs_fact': False, 'owner': '', 'reason': '建议不可用，请逐条人工分类。', 'mode': 'manual', 'source_id': c['id']}
    if mode in ('manual', 'timeout', 'error'):
        return fallback
    if raw is not None:
        if (not isinstance(raw, dict) or set(raw) != {'source_id', 'quote', 'labels', 'needs_fact', 'owner', 'reason'}
                or raw.get('source_id') != c['id'] or raw.get('quote') != c['quote']
                or not isinstance(raw.get('labels'), list) or not raw['labels']
                or any(not isinstance(v, str) or v not in LABELS for v in raw['labels'])
                or len(raw['labels']) != len(set(raw['labels']))
                or ('uncertain' in raw['labels'] and len(raw['labels']) != 1)
                or not isinstance(raw.get('needs_fact'), bool)
                or not isinstance(raw.get('reason'), str) or not isinstance(raw.get('owner'), str)):
            return fallback
        return {**fallback, **{k: raw[k] for k in ('labels', 'needs_fact', 'reason', 'owner')}, 'mode': 'validated_stub'}
    content = c['text']
    internal = any(w in content for w in ('业务', '内部', '我们', '成本', '底价'))
    external = any(w in content for w in ('对方', '对外', '客户确认'))
    ambiguous = any(w in content for w in ('忽略', 'ignore', 'system', '请评估是否', '请评估结算'))
    labels = ['uncertain'] if ambiguous or not (internal or external) else (['internal'] if internal else []) + (['external'] if external else [])
    return {'source_id': c['id'], 'labels': labels, 'needs_fact': internal, 'owner': '业务负责人' if internal else '', 'reason': '同时涉及内部确认与对外表达，请拆分处理。' if len(labels) > 1 else '检测到内部事实确认表述，建议先形成内部待办。' if labels == ['internal'] else '检测到面向对方的沟通表述，仍需人工确认。' if labels == ['external'] else '受众或处理动作不明确，交由法务判断。', 'mode': 'simulation'}


class Store:
    def __init__(self, root, seed=False, default_mode='simulation'):
        self.default_mode = default_mode
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        if seed and not (self.root / '.initialized').exists():
            for i in range(3):
                self.create(SAMPLES[i]['title'] + '.docx', make_docx(i), demo=i)
            (self.root / '.initialized').write_text('Synthetic demo initialized; deleted data is not re-seeded.')

    def path(self, cid):
        if not isinstance(cid, str) or len(cid) != 32 or any(c not in '0123456789abcdef' for c in cid):
            raise RuleError('合同不存在。', 404)
        return self.root / cid

    def load(self, cid):
        try:
            return json.loads((self.path(cid) / 'state.json').read_text())
        except FileNotFoundError:
            raise RuleError('合同不存在或已删除。', 404)

    def save(self, c):
        target = self.path(c['id']) / 'state.json'
        tmp = target.with_suffix('.tmp')
        try:
            tmp.write_text(json.dumps(c, ensure_ascii=False, indent=2))
            os.replace(tmp, target)
        finally:
            tmp.unlink(missing_ok=True)

    def log(self, c, action, actor='legal', target='', before=None, after=None):
        v = c['versions'][-1]
        if action == '业务回复代录' and CURRENT_ACTOR.get() != '演示法务':
            action = '提交业务回复'
        c['logs'].append({'id': uid(), 'at': now(), 'actor': CURRENT_ACTOR.get() if actor == 'legal' else '系统（模拟）', 'action': action, 'target': target, 'version': v['number'], 'snapshot': self.snapshot(v), 'before': before, 'after': after})

    def version(self, filename, data, number):
        filename = text(filename, 200).replace('/', '_').replace('\\', '_')
        parsed = word.inspect(data, filename)
        comments = [{**c, 'suggestion': suggestion(c, mode=self.default_mode), 'labels': [], 'confirmed': False, 'needs_fact': False, 'output': 'pending', 'external_text': '', 'split': None, 'task': None} for c in parsed['comments']]
        return {'id': uid(), 'number': number, 'filename': filename, 'source_hash': parsed['fingerprint'], 'size': len(data), 'imported_at': now(), 'errors': parsed['errors'], 'paragraphs': parsed['paragraphs'], 'comments': comments, 'review': None, 'review_invalid_reason': '', 'settings': {'purpose': '合同条款沟通', 'recipient': '交易对方经办人'}, 'handoff': {'purpose': '', 'recipient': '', 'source_version': '', 'unresolved': '', 'review_note': ''}, 'exports': [], 'model_attempts': 1, 'model_mode': self.default_mode}

    def create(self, filename, data, demo=None):
        with self.lock:
            v = self.version(filename, data, 1)
            cid = uid()
            c = {'id': cid, 'title': filename.rsplit('.', 1)[0][:200], 'party': SAMPLES[demo]['party'] if demo is not None else '待补充合作方', 'kind': SAMPLES[demo]['kind'] if demo is not None else '审阅合同', 'demo': demo is not None, 'created_at': now(), 'updated_at': now(), 'revision': 1, 'versions': [v], 'logs': []}
            folder = self.path(cid)
            folder.mkdir(mode=0o700)
            try:
                (folder / (v['id'] + '.docx')).write_bytes(data)
                self.log(c, '导入虚构示例' if demo is not None else '导入审阅版')
                self.save(c)
            except Exception:
                shutil.rmtree(folder)
                raise
            return self.view(c)

    def snapshot(self, v):
        return fingerprint({k: v[k] for k in ('id', 'source_hash', 'comments', 'settings', 'handoff', 'errors')})

    def blockers(self, v, include_review=True):
        reasons = [{'kind': 'format', 'text': e} for e in v['errors']]
        for c in v['comments']:
            prefix = f'批注 {int(c["id"])+1}' if c['id'].isdigit() else '批注'
            def add(kind, msg):
                reasons.append({'kind': kind, 'comment_id': c['id'], 'text': f'{prefix}：{msg}'})
            if not c['confirmed'] or not c['labels']:
                add('classification', '尚未完成人工分类。')
            elif 'uncertain' in c['labels']:
                add('classification', '仍为待判断。')
            if c['output'] == 'pending' or (c['output'] == 'rewrite' and not c['external_text'].strip()):
                add('decision', '尚未决定候选中的处理方式。')
            if len(c['labels']) > 1 and not c.get('split'):
                add('classification', '多受众批注需要拆分。')
            if (c['needs_fact'] or 'internal' in c['labels']) and not c['task']:
                add('task', '缺少内部确认事项。')
            if c['task'] and c['task']['status'] != 'done':
                add('task', '内部事项尚未完成法务复核。')
        if not v['comments']:
            h = v['handoff']
            if any(not h.get(k, '').strip() for k in ('purpose', 'recipient', 'source_version', 'unresolved', 'review_note')):
                reasons.append({'kind': 'handoff', 'text': '无批注文件仍须填写完整的人工交接检查清单。'})
            if h['source_version'] and h['source_version'] != f'V{v["number"]}':
                reasons.append({'kind': 'handoff', 'text': '交接清单源版本与当前文件不一致。'})
            if h['unresolved'].strip() != '无':
                reasons.append({'kind': 'handoff', 'text': '交接清单中仍有未决项；处理完毕后明确填写“无”。'})
        if not v['settings']['purpose'] or not v['settings']['recipient']:
            reasons.append({'kind': 'settings', 'text': '请填写候选文件用途与拟接收方角色。'})
        if include_review and (not v['review'] or v['review']['snapshot'] != self.snapshot(v)):
            reasons.append({'kind': 'review', 'text': '尚未复核当前候选快照。'})
        return reasons

    def phase(self, v):
        b = self.blockers(v, False)
        if v['errors']:
            return '解析失败'
        if any(x['kind'] in ('classification', 'decision') for x in b):
            return '待法务分类'
        if any(x['kind'] == 'task' for x in b):
            return '待事项处理'
        if any(e['snapshot'] == self.snapshot(v) for e in v['exports']) and not self.blockers(v):
            return '已生成候选'
        return '待候选复核'

    def view(self, c):
        c = deepcopy(c)
        v = c['versions'][-1]
        current = self.snapshot(v)
        integrity = True
        integrity_error = ''
        try:
            self.assert_source(c)
        except RuleError as exc:
            integrity = False
            integrity_error = str(exc)
        c['current'] = v
        c['snapshot'] = current
        c['phase'] = self.phase(v) if integrity else '解析失败'
        c['blockers'] = self.blockers(v)
        if not integrity:
            c['blockers'].insert(0, {'kind': 'format', 'text': integrity_error})
            v['review'] = None
        c['can_review'] = integrity and not self.blockers(v, False)
        c['can_export'] = integrity and not c['blockers']
        for old in c['versions']:
            for e in old['exports']:
                e['historical'] = not integrity or old['id'] != v['id'] or e['snapshot'] != current
        c['summary'] = {'comments': len(v['comments']), 'confirmed': sum(x['confirmed'] and 'uncertain' not in x['labels'] for x in v['comments']), 'tasks': sum(x['task'] is not None for x in v['comments']), 'pending_tasks': sum(x['task'] is not None and x['task']['status'] != 'done' for x in v['comments']), 'blockers': len(c['blockers'])}
        return c

    def listing(self):
        with self.lock:
            rows = []
            for path in self.root.glob('*/state.json'):
                c = self.view(self.load(path.parent.name))
                rows.append({k: c[k] for k in ('id', 'title', 'party', 'kind', 'demo', 'created_at', 'updated_at', 'revision', 'phase', 'summary')} | {'version': c['current']['number'], 'filename': c['current']['filename']})
            return sorted(rows, key=lambda c: c['updated_at'], reverse=True)

    def require_current(self, c, payload):
        if payload.get('revision') != c['revision']:
            raise RuleError('内容已更新。请刷新后重新确认，旧页面不能继续操作。', 409)

    def assert_source(self, c):
        v = c['versions'][-1]
        source = self.path(c['id']) / (v['id'] + '.docx')
        if not source.exists() or word.digest(source.read_bytes()) != v['source_hash']:
            raise RuleError('源文件指纹发生变化，请重新上传为新版本。', 409)
        for comment in v['comments']:
            for evidence in (comment.get('task') or {}).get('attachments', []):
                path = self.path(c['id']) / evidence['storage']
                if not path.exists() or word.digest(path.read_bytes()) != evidence['hash']:
                    raise RuleError('事项附件指纹变化，请重新上传证据后复核。', 409)
        return source.read_bytes()

    def mutate(self, cid, action, p):
        with self.lock:
            c = self.load(cid)
            self.require_current(c, p)
            actor = p.get('actor', 'legal')
            if actor != 'legal':
                raise RuleError('此动作须由演示法务执行；AI 与模拟业务角色不能确认。', 403)
            v = c['versions'][-1]
            old_snapshot = self.snapshot(v)
            target = p.get('comment_id', '')
            comment = next((x for x in v['comments'] if x['id'] == target), None)
            before = {'phase': self.phase(v), 'task_status': (comment.get('task') or {}).get('status') if comment else None}
            if action in ('comment', 'reply', 'task', 'evidence') and comment is None:
                raise RuleError('批注不存在。', 404)
            pending_file = None
            if action == 'comment':
                labels = p.get('labels', [])
                if not isinstance(labels, list) or not labels or any(x not in LABELS for x in labels) or len(labels) != len(set(labels)) or ('uncertain' in labels and len(labels) > 1):
                    raise RuleError('请选择有效的受众分类；待判断不能与其他分类同时选择。')
                output = p.get('output', 'pending')
                if output not in OUTPUTS:
                    raise RuleError('候选处理方式无效。')
                external_text = text(p.get('external_text', ''))
                if 'internal' in labels and output == 'external':
                    raise RuleError('含内部意见的批注不能原文对外保留，请仅内部保留或填写独立对外表述。')
                split = None
                if len(labels) > 1:
                    inside = text(p.get('split_internal', ''))
                    outside = text(p.get('split_external', ''))
                    if inside and outside:
                        split = [{'audience': 'internal', 'text': inside, 'source_id': target}, {'audience': 'external', 'text': outside, 'source_id': target}]
                        if output == 'rewrite':
                            external_text = outside
                if output == 'rewrite' and not external_text:
                    raise RuleError('请填写人工确认的对外表述。')
                needs_fact = p.get('needs_fact') is True
                comment.update(labels=labels, output=output, external_text=external_text, confirmed=True, needs_fact=needs_fact, split=split, confirmed_by=CURRENT_ACTOR.get(), confirmed_at=now())
                if needs_fact or 'internal' in labels or comment['task']:
                    owner = text(p.get('owner', ''), 100)
                    task_title = text(p.get('task_title', ''), 1000)
                    if not owner or not task_title:
                        raise RuleError('内部事项需要填写责任角色与待办内容。')
                    if not comment['task']:
                        comment['task'] = {'id': uid(), 'source_id': target, 'status': 'waiting', 'reply': '', 'evidence': '', 'attachments': [], 'recorded_on_behalf': CURRENT_ACTOR.get() == '演示法务', 'review': None, 'na_reason': ''}
                    t = comment['task']
                    if t.get('title') != task_title or t.get('owner') != owner:
                        if t['status'] == 'done':
                            t['status'] = 'review' if t['reply'] else 'waiting'
                            t['review'] = None
                    t.update(title=task_title, owner=owner)
                    if 'assignee_id' in p:
                        t['assignee_id'] = p['assignee_id']
            elif action in ('reply', 'task', 'evidence'):
                t = comment['task']
                if not t:
                    raise RuleError('请先通过人工分类建立内部事项。')
                if action == 'reply':
                    reply = text(p.get('reply', ''))
                    if not reply:
                        raise RuleError('请填写业务回复。')
                    t.update(reply=reply, evidence=text(p.get('evidence', '')), status='review', review=None, na_reason='', replied_at=now(), recorded_on_behalf=CURRENT_ACTOR.get() == '演示法务', replied_by=CURRENT_ACTOR.get())
                elif action == 'evidence':
                    filename = text(p.get('filename', ''), 200)
                    if Path(filename).suffix.lower() not in ('.pdf', '.png', '.jpg', '.jpeg', '.txt', '.docx'):
                        raise RuleError('证据支持 PDF、图片、TXT 或 DOCX，最大 5MB。')
                    if len(t['attachments']) >= 10:
                        raise RuleError('每个事项最多 10 个证据附件。')
                    data = decode_file(p, 5 * 1024 * 1024)
                    aid = uid()
                    storage = 'evidence-' + aid
                    pending_file = (self.path(cid) / storage, data)
                    t['attachments'].append({'id': aid, 'filename': filename, 'hash': word.digest(data), 'size': len(data), 'storage': storage})
                    t.update(status='review' if t['reply'] else 'waiting', review=None, na_reason='')
                else:
                    decision = p.get('decision')
                    reason = text(p.get('reason', ''))
                    if decision == 'return':
                        if not reason:
                            raise RuleError('请填写退回补充原因。')
                        t.update(status='waiting', review=None, return_reason=reason, na_reason='')
                    elif decision == 'na':
                        if not reason:
                            raise RuleError('选择不适用需要填写法务理由。')
                        t.update(status='done', na_reason=reason, review={'actor': CURRENT_ACTOR.get(), 'at': now(), 'evidence_snapshot': fingerprint(t)})
                    elif decision == 'confirm':
                        if t['status'] != 'review' or not t['reply'] or not (t['evidence'] or t['attachments']):
                            raise RuleError('关闭事项前需要业务回复，以及证据或可核实的事实说明，并处于待法务复核。')
                        t.update(status='done', na_reason='', review={'actor': CURRENT_ACTOR.get(), 'at': now(), 'evidence_snapshot': fingerprint(t)})
                    else:
                        raise RuleError('无效事项动作。')
            elif action == 'settings':
                v['settings'] = {'purpose': text(p.get('purpose', ''), 1000), 'recipient': text(p.get('recipient', ''), 1000)}
            elif action == 'handoff':
                v['handoff'] = {k: text(p.get(k, ''), 4000) for k in v['handoff']}
            elif action == 'model':
                mode = p.get('mode', 'manual')
                if mode not in ('manual', 'simulation'):
                    raise RuleError('尚未配置真实模型，仅支持模拟建议或人工模式。')
                if mode == 'simulation':
                    if v['model_attempts'] >= 2:
                        raise RuleError('模拟建议最多手动重试一次，请继续人工处理。')
                    v['model_attempts'] += 1
                v['model_mode'] = mode
                for x in v['comments']:
                    x['suggestion'] = suggestion(x, mode)
            elif action == 'version':
                data = decode_file(p)
                new = self.version(p.get('filename', ''), data, v['number'] + 1)
                pending_file = (self.path(cid) / (new['id'] + '.docx'), data)
                v['review'] = None
                v['review_invalid_reason'] = '已导入新源版本；旧候选为历史文件，已下载文件无法撤回。'
                c['versions'].append(new)
                v = new
                v['review_invalid_reason'] = '新版本需要重新处理，不继承上一版本确认。'
            elif action == 'review':
                self.assert_source(c)
                if p.get('snapshot') != old_snapshot:
                    raise RuleError('候选内容快照已变化，请重新检查预览。', 409)
                if self.blockers(v, False):
                    raise RuleError('仍有未完成事项，不能复核当前候选。')
                if p.get('acknowledged') is not True:
                    raise RuleError('请确认已核对候选预览与文件用途。')
                word.candidate(self.assert_source(c), v['comments'])
                v['review'] = {'actor': CURRENT_ACTOR.get(), 'at': now(), 'snapshot': old_snapshot, 'note': text(p.get('note', '已核对候选预览，仍需在 Word 中核对，不代表可签署。'))}
                v['review_invalid_reason'] = ''
            else:
                raise RuleError('动作不存在。', 404)
            if action != 'review' and self.snapshot(v) != old_snapshot:
                if v['review']:
                    v['review_invalid_reason'] = '内容或证据发生变化，原复核已失效，请重新复核当前候选。'
                v['review'] = None
            c['revision'] += 1
            c['updated_at'] = now()
            self.log(c, {'comment': '确认批注分类与处理', 'reply': '业务回复代录', 'task': '法务处理事项', 'evidence': '补充证据附件', 'settings': '更新候选用途', 'handoff': '填写人工交接检查', 'model': '切换分类建议模式', 'version': '导入新源版本', 'review': '复核当前候选'}[action], target=target, before=before, after={'phase': self.phase(v), 'task_status': (comment.get('task') or {}).get('status') if comment else None})
            try:
                if pending_file:
                    pending_file[0].write_bytes(pending_file[1])
                self.save(c)
            except Exception:
                if pending_file:
                    pending_file[0].unlink(missing_ok=True)
                raise
            return self.view(c)

    def export(self, cid, p):
        with self.lock:
            c = self.load(cid)
            if p.get('actor', 'legal') != 'legal':
                raise RuleError('仅演示法务可生成候选。', 403)
            v = c['versions'][-1]
            snap = self.snapshot(v)
            if p.get('snapshot') != snap:
                raise RuleError('候选快照已变化，请重新复核。', 409)
            source = self.assert_source(c)
            if self.blockers(v):
                raise RuleError('候选导出被阻断：' + '；'.join(x['text'] for x in self.blockers(v)))
            old = next((e for e in v['exports'] if e['snapshot'] == snap), None)
            if old:
                file = self.path(cid) / (old['id'] + '.docx')
                if not file.exists() or word.digest(file.read_bytes()) != old['hash']:
                    raise RuleError('已有候选文件完整性检查失败。', 409)
                return {'contract': self.view(c), 'artifact': old}
            self.require_current(c, p)
            data = word.candidate(source, v['comments'])
            # Lock covers the complete final check, build, validation and publication.
            self.assert_source(c)
            if self.blockers(v) or self.snapshot(v) != snap:
                raise RuleError('写出前内容已变更，导出终止。', 409)
            aid = uid()
            artifact = {'id': aid, 'number': f'HX-{v["number"]:02}-{len(v["exports"])+1:03}', 'version': v['number'], 'snapshot': snap, 'hash': word.digest(data), 'at': now(), 'actor': CURRENT_ACTOR.get(), 'filename': c['title'] + f'-V{v["number"]}-对外候选.docx'}
            target = self.path(cid) / (aid + '.docx')
            tmp = target.with_suffix('.tmp')
            try:
                tmp.write_bytes(data)
                os.replace(tmp, target)
                v['exports'].append(artifact)
                c['revision'] += 1
                self.log(c, '生成对外候选版', target=aid, after={'artifact_id': aid, 'hash': artifact['hash']})
                self.save(c)
            except Exception:
                tmp.unlink(missing_ok=True)
                target.unlink(missing_ok=True)
                raise
            return {'contract': self.view(c), 'artifact': artifact}

    def delete(self, cid, p):
        with self.lock:
            c = self.load(cid)
            self.require_current(c, p)
            if p.get('actor', 'legal') != 'legal':
                raise RuleError('仅演示法务可删除。', 403)
            shutil.rmtree(self.path(cid))

    def download(self, cid, kind, aid=''):
        with self.lock:
            c = self.load(cid)
            v = c['versions'][-1]
            if kind == 'source':
                return (self.path(cid) / (v['id'] + '.docx')).read_bytes(), v['filename'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            if kind == 'record':
                return json.dumps({'internal_only': True, 'notice': '内部处理记录，仅向本团队授权成员共享。' if self.default_mode == 'manual' else '内部处理记录；单人演示中的角色不构成真实身份认证。', **self.view(c)}, ensure_ascii=False, indent=2).encode(), c['title'] + '-内部处理记录.json', 'application/json'
            if kind == 'checklist':
                lines = ['# ' + c['title'] + '｜内部确认清单', '', '**仅内部使用，含未决项；本清单不代表法务批准或可签署。**', '', f'源版本：V{v["number"]}；源指纹：{v["source_hash"]}', '']
                for x in v['comments']:
                    lines += [f'## 批注 {int(x["id"])+1} · {x["location"]}', f'原文：{x["quote"]}', f'原批注：{x["text"]}', f'人工分类：{x["labels"] or "未确认"}；输出决定：{x["output"]}', f'对外表述：{x["external_text"]}']
                    if x['task']:
                        t = x['task']
                        lines += [f'事项：{t["title"]}；责任角色：{t["owner"]}', f'状态：{"已处理" if t["status"] == "done" else "【未决】" + t["status"]}', f'{"业务回复" if self.default_mode == "manual" else "业务回复代录"}：{t["reply"]}', f'证据/事实说明：{t["evidence"]}', f'附件：{", ".join(a["filename"] for a in t["attachments"])}', f'不适用理由：{t["na_reason"]}', f'法务复核：{t["review"]}']
                    lines.append('')
                lines += ['## 当前阻断项'] + [f'- {x["text"]}' for x in self.blockers(v)]
                if not v['comments']:
                    lines += ['', '## 无批注文件交接检查', json.dumps(v['handoff'], ensure_ascii=False, indent=2)]
                return '\n\n'.join(lines).encode(), c['title'] + '-内部确认清单.md', 'text/markdown; charset=utf-8'
            if kind == 'candidate':
                artifact = next((e for ver in c['versions'] for e in ver['exports'] if e['id'] == aid), None)
                if artifact:
                    file = self.path(cid) / (aid + '.docx')
                    if not file.exists() or word.digest(file.read_bytes()) != artifact['hash']:
                        raise RuleError('候选文件完整性校验失败。', 409)
                    return file.read_bytes(), artifact['filename'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            if kind == 'evidence':
                attachment = next((a for ver in c['versions'] for x in ver['comments'] if x['task'] for a in x['task']['attachments'] if a['id'] == aid), None)
                if attachment:
                    return (self.path(cid) / attachment['storage']).read_bytes(), attachment['filename'], 'application/octet-stream'
            raise RuleError('文件不存在。', 404)
