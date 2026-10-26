"""Loopback-only demo HTTP server; no external services or credentials required."""
import argparse
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
from .domain import Store, RuleError, decode_file, CURRENT_ACTOR
from .docx_engine import DocumentError
from .fixtures import make_docx, SAMPLES

ROOT = Path(__file__).resolve().parent.parent


def handler(store, access=None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            # Never log document content, user text, query strings or file names.
            pass

        def send(self, status, body, mime='application/json; charset=utf-8', filename=None, cookie=None):
            if not isinstance(body, bytes):
                body = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            if cookie:
                self.send_header('Set-Cookie', cookie)
            if filename:
                self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(filename))
            self.end_headers()
            self.wfile.write(body)

        def run_request(self, method):
            active_store = store
            actor_token = None
            try:
                host = self.headers.get('Host', '')
                allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
                if access:
                    allowed = {access.host}
                if host not in allowed:
                    raise RuleError('仅接受本机访问。', 403)
                if method != 'GET':
                    origin = self.headers.get('Origin')
                    if (access and origin != access.origin) or (not access and origin and origin not in {f'http://{h}' for h in allowed}):
                        raise RuleError('请求来源无效。', 403)
                    if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                        raise RuleError('请使用 JSON 请求。', 415)
                    size = int(self.headers.get('Content-Length', '0'))
                    if size < 0 or size > 15 * 1024 * 1024:
                        raise RuleError('请求超过大小限制。', 413)
                    p = json.loads(self.rfile.read(size))
                    if not isinstance(p, dict):
                        raise RuleError('请求格式无效。', 400)
                else:
                    p = {}
                path = urlsplit(self.path).path
                bits = [unquote(x) for x in path.strip('/').split('/')]
                if access:
                    if access.auth_route(self, path, method, p):
                        return
                    if path.startswith('/api/'):
                        user = access.user(self.headers)
                        access.authorize(user, method, bits, p)
                        active_store = access.store(user['team'])
                        actor_token = CURRENT_ACTOR.set(user['name'] + ' (' + user['login'] + ')')
                if method == 'GET' and path == '/api/contracts':
                    rows = access.visible_contracts(user) if access else active_store.listing()
                    return self.send(200, {'contracts': rows, 'mode': 'team' if access else 'local_demo', 'user': user if access else None, 'ai_enabled': bool(access and access.classifier)})
                if method == 'POST' and path == '/api/contracts':
                    if p.get('acknowledged') is not True:
                        raise RuleError('请确认拥有上传与团队共享资料的授权。' if access else '演示仅限虚构或已脱敏文件，请确认资料性质。')
                    if access:
                        access.validate_upload(p)
                    created = active_store.create(p.get('filename', ''), decode_file(p))
                    if access:
                        access.register_contract(user, created['id'])
                    return self.send(201, created)
                if method == 'POST' and path == '/api/demo':
                    idx = int(p.get('sample', 0)) % len(SAMPLES)
                    created = active_store.create(SAMPLES[idx]['title'] + '.docx', make_docx(idx), idx)
                    if access:
                        access.register_contract(user, created['id'])
                    return self.send(201, created)
                if method == 'GET' and path == '/api/sample':
                    return self.send(200, make_docx(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '合序-虚构演示合同.docx')
                if len(bits) >= 3 and bits[:2] == ['api', 'contracts']:
                    cid = bits[2]
                    if method == 'GET' and len(bits) == 3:
                        with active_store.lock:
                            return self.send(200, active_store.view(active_store.load(cid)))
                    if method == 'DELETE' and len(bits) == 3:
                        active_store.delete(cid, p)
                        if access:
                            with access.db() as db:
                                db.execute('DELETE FROM contract_access WHERE team=? AND contract=?', (user['team'], cid))
                        return self.send(200, {'deleted': True})
                    if access and method == 'POST' and len(bits) == 4 and bits[3] == 'ai':
                        return self.send(200, access.ai_suggestion(active_store, cid, p))
                    if method == 'POST' and len(bits) == 4:
                        if access and bits[3] in ('version', 'evidence'):
                            access.validate_upload(p)
                        result = active_store.export(cid, p) if bits[3] == 'export' else active_store.mutate(cid, bits[3], p)
                        if access and bits[3] == 'comment' and p.get('assignee_id'):
                            access.register_contract({**user, 'id': p['assignee_id']}, cid)
                        return self.send(200, result)
                    if method == 'GET' and len(bits) >= 5 and bits[3] == 'download':
                        data, name, mime = active_store.download(cid, bits[4], bits[5] if len(bits) == 6 else '')
                        return self.send(200, data, mime, name)
                if method == 'GET' and not path.startswith('/api/'):
                    rel = 'index.html' if path == '/' else unquote(path.lstrip('/'))
                    if access and rel == 'index.html':
                        try:
                            access.user(self.headers)
                        except RuleError:
                            rel = 'login.html'
                    public = (ROOT / 'web').resolve()
                    file = (public / rel).resolve()
                    if file.is_relative_to(public) and file.is_file():
                        return self.send(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
                raise RuleError('页面或接口不存在。', 404)
            except RuleError as exc:
                self.send(exc.status, {'error': str(exc)})
            except DocumentError as exc:
                self.send(422, {'error': str(exc)})
            except (ValueError, TypeError, KeyError) as exc:
                self.send(400, {'error': '请求格式有误，请检查输入后重试。'})
            except Exception:
                self.send(500, {'error': '操作未完成，已保存的工作仍保留。请重试或检查本地存储空间。'})

            finally:
                if actor_token is not None:
                    CURRENT_ACTOR.reset(actor_token)

        def do_GET(self):
            self.run_request('GET')

        def do_POST(self):
            self.run_request('POST')

        def do_DELETE(self):
            self.run_request('DELETE')
    return Handler


def main():
    parser = argparse.ArgumentParser(description='合序本地演示')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--data-dir', default=str(ROOT / '.data'))
    parser.add_argument('--empty', action='store_true', help='不初始化虚构演示合同')
    args = parser.parse_args()
    store = Store(args.data_dir, seed=not args.empty)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler(store))
    print(f'合序已启动：http://127.0.0.1:{args.port}（本机单人演示）', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == '__main__':
    main()
