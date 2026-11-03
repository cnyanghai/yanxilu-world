"""本地模拟 Baba 服务器：/api/yxl/* 按 Baba 新接口的语义实现，首页给研习录 server/index.html（本仓库没有时给一页目录，/world 与 /room 照常）。
用法：python3 tools/baba_mock.py 8790   （在仓库根目录跑；先 python3 build.py 生成 server/index.html）"""
import json, sys, os, time, uuid, urllib.parse, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from email.parser import BytesParser
from email.policy import default as email_default
S = os.path.dirname(os.path.abspath(__file__))
YXL = os.environ.get("YXL") or os.path.dirname(S)  # 仓库根目录；也可以用环境变量 YXL 指定
EMBED = open(os.path.join(S, "embed.js")).read() if os.path.isfile(os.path.join(S, "embed.js")) else ""   # 书架仓库的嵌入脚本，游戏仓库没有
COLLS = ["progress","notes","journal","cards","study","film","ebooks","mybooks","hidden","reading","marks","domains","lessons"]
USERS = {"u1": {"id": "u1", "name": "测试用户", "phone": "13800000000", "paid": False}}
DOCS = {}   # (uid, coll, id) -> data
FILES = {}  # id -> (uid, type, name, bytes)
LOG = []
FLAGS = {"old": False}
RANGES = []
lock = threading.Lock()
def now(): return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
DRAMAS = [
  {"slug":"friends","type":"DRAMA","titleEn":"Friends","titleZh":"老友记","posterUrl":None,"year":1994,
   "episodes":[{"code":"S01E01","title":"Pilot","season":1,"episode":1,"durationMs":1300000,"sentences":471},
               {"code":"S01E02","title":"Sonogram","season":1,"episode":2,"durationMs":1300000,"sentences":300}]},
  {"slug":"hp1-sorcerers-stone","type":"MOVIE","titleEn":"Harry Potter and the Sorcerer's Stone","titleZh":"哈利·波特与魔法石","posterUrl":None,"year":2001,
   "episodes":[{"code":"M01","title":"加长版","season":1,"episode":1,"durationMs":9000000,"sentences":1500}]},
  {"slug":"hp8-deathly-hallows-2","type":"MOVIE","titleEn":"Deathly Hallows 2","titleZh":"哈利波特与死亡圣器（下）","posterUrl":None,"year":2011,
   "episodes":[{"code":"M01","title":"","season":1,"episode":1,"durationMs":1,"sentences":928}]},
  {"slug":"hp3-prisoner-of-azkaban","type":"MOVIE","titleEn":"Prisoner of Azkaban","titleZh":"哈利波特与阿兹卡班的囚徒","posterUrl":None,"year":2004,
   "episodes":[{"code":"M01","title":"","season":1,"episode":1,"durationMs":1,"sentences":1405}]},
  {"slug":"ted-grit","type":"TED","titleEn":"Grit","titleZh":"坚毅","posterUrl":None,"year":2013,
   "episodes":[{"code":"T01","title":"Grit","season":1,"episode":1,"durationMs":360000,"sentences":80}]},
]
PROGRESS = {"u1": {("friends","S01E01"): {"lastIdx": 56, "totalWatchedMs": 1520000, "updatedAt": "2026-10-18T12:00:00.000Z"}}}
def english(uid):
    pr = PROGRESS.get(uid, {}) if uid else {}
    out = []
    for d in DRAMAS:
        sent=reached=watched=0; last=None; eps=[]
        for e in d["episodes"]:
            p = pr.get((d["slug"], e["code"])); n=e["sentences"]; sent+=n
            if p:
                reached += min(n, p["lastIdx"]+1); watched += p["totalWatchedMs"]
                if not last or p["updatedAt"] > last["at"]: last={"code":e["code"],"idx":p["lastIdx"],"at":p["updatedAt"]}
            eps.append(dict(e, lastIdx=p["lastIdx"] if p else None, watchedMs=p["totalWatchedMs"] if p else 0, at=p["updatedAt"] if p else None))
        out.append({k:d[k] for k in ("slug","type","titleEn","titleZh","posterUrl","year")} | {"sentences":sent,"reached":reached,"watchedMs":watched,"last":last,"episodes":eps})
    vocab = {"total":23,"new":12,"learning":4,"known":7,"lastAddedAt":"2026-10-18T12:00:00.000Z"} if uid else {"total":0,"new":0,"learning":0,"known":0,"lastAddedAt":None}
    return {"user": {"name": USERS[uid]["name"]} if uid else None, "paid": bool(uid and USERS[uid]["paid"]), "dramas": out, "vocab": vocab, "at": now()}
TYPES = {".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".css":"text/css",".csv":"text/csv; charset=utf-8",".wasm":"application/wasm",".woff2":"font/woff2",".png":"image/png",".svg":"image/svg+xml",".jpg":"image/jpeg",".glb":"model/gltf-binary"}
def baba_page(title, body):
    return ("<!doctype html><html><head><meta charset=utf-8><title>Baba 英语 · 看视频学英语</title><script>" + EMBED + "</script>"
      "<style>html[data-embed] [data-site-header]{display:none} html[data-embed] [data-site-main]{padding-top:0} [data-site-header]{position:fixed;top:0;left:0;right:0;height:56px;background:#222;color:#fff} [data-site-main]{padding-top:56px} body{margin:0;font-family:sans-serif;background:#111;color:#eee}</style></head>"
      "<body><header data-site-header>Baba 顶栏 <a href='/'>研习录</a></header><main data-site-main><h1 id=t>" + title + "</h1>" + body + "</main></body></html>")
class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def uid(self):
        c = self.headers.get("cookie") or ""
        for part in c.split(";"):
            k, _, v = part.strip().partition("=")
            if k == "sid" and v in USERS: return v
        return None
    def send(self, code, body, ctype="application/json", headers=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code); self.send_header("content-type", ctype); self.send_header("content-length", str(len(body)))
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def body(self):
        n = int(self.headers.get("content-length") or 0); return self.rfile.read(n) if n else b""
    def do_GET(self): self.route("GET")
    def do_PUT(self): self.route("PUT")
    def do_POST(self): self.route("POST")
    def do_DELETE(self): self.route("DELETE")
    def do_HEAD(self): self.route("HEAD")
    def route(self, m):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query)); p = u.path; uid = self.uid()
        LOG.append((m, p, uid))
        if p == "/__log": return self.send(200, {"ranges": RANGES[-50:], "log": LOG[-200:], "docs": {"|".join(k): v for k, v in DOCS.items()}, "files": {k: [v[0], v[1], v[2], len(v[3])] for k, v in FILES.items()}})
        if p == "/__login": return self.send(302, "", "text/plain", {"set-cookie": "sid=u1; Path=/", "location": q.get("to", "/")})
        if p == "/__oldserver": FLAGS["old"] = q.get("v") == "1"; return self.send(200, {"ok": True})
        if p == "/__paid": USERS["u1"]["paid"] = q.get("v") == "1"; return self.send(200, {"ok": True})
        if p == "/__progress":
            PROGRESS["u1"][(q["slug"], q["code"])] = {"lastIdx": int(q["idx"]), "totalWatchedMs": 60000, "updatedAt": now()}; return self.send(200, {"ok": True})
        if p == "/":
            home = YXL + "/server/index.html"   # 书架仓库有；游戏仓库（yanxilu-world）没有，给一页目录
            if os.path.isfile(home): return self.send(200, open(home, "rb").read(), "text/html; charset=utf-8", {"cache-control": "no-cache"})
            return self.send(200, b'<!doctype html><meta charset="utf-8"><title>yanxilu-world mock</title><p><a href="/world">/world</a> <a href="/room">/room</a>', "text/html; charset=utf-8", {"cache-control": "no-cache"})
        if p == "/sw.js":
            if not os.path.isfile(YXL + "/sw.js"): return self.send(404, "nf", "text/plain")
            return self.send(200, open(YXL + "/sw.js", "rb").read(), "text/javascript; charset=utf-8", {"cache-control": "no-cache"})
        if p in ("/room", "/room/"): p = "/room/index.html"
        if p in ("/world", "/world/"): p = "/world/index.html"
        if p.startswith("/vendor/") or p.startswith("/reports/") or p.startswith("/room/") or p.startswith("/world/"):
            f = os.path.normpath(YXL + p)
            if not f.startswith(YXL + "/") or not os.path.isfile(f): return self.send(404, "nf", "text/plain")
            return self.send(200, open(f, "rb").read(), TYPES.get(os.path.splitext(f)[1], "application/octet-stream"))
        if p.startswith("/api/yxl/"):
            return self.api(m, p[len("/api/yxl/"):], q, uid)
        if p.startswith("/_blob/"):
            return self.api(m, "files/" + p[len("/_blob/"):], q, uid)
        if p == "/login":
            return self.send(200, baba_page("登录", "<a id=go href='/__login?to=" + urllib.parse.quote(q.get("callbackUrl", "/")) + "'>用测试账号登录</a>"), "text/html; charset=utf-8")
        if p.startswith("/dramas/") or p in ("/vocabulary", "/progress", "/english", "/account") or p.startswith("/books/"):
            return self.send(200, baba_page(p, "<p>模拟的 Baba 页面</p><a id=home href='/'>返回首页</a> <a id=next href='/vocabulary'>生词本</a>"), "text/html; charset=utf-8")
        return self.send(404, "nf", "text/plain")
    def api(self, m, p, q, uid):
        if p == "state" and m == "GET":
            if not uid: return self.send(200, {"user": None, "docs": {}, "at": now()})
            docs = {}
            with lock:
                for (u, c, i), v in DOCS.items():
                    if u == uid and c != "lessons" and not c.endswith("body"): docs.setdefault(c, {})[i] = v
            return self.send(200, {"user": {"id": uid, "name": USERS[uid]["name"]}, "docs": docs, "at": now(), **({} if FLAGS["old"] else {"caps": {"put": True, "maxMB": 600, "clips": True}})})
        if p == "english" and m == "GET": return self.send(200, english(uid))
        if not uid: return self.send(401, {"error": "请先登录"})
        if p == "doc":
            if m == "GET":
                v = DOCS.get((uid, q.get("coll"), q.get("id"))); return self.send(200, {"exists": v is not None, "data": v})
            if m == "PUT":
                b = json.loads(self.body() or b"{}")
                import re as _re
                if not _re.match(r"^[a-z][a-z0-9]{1,23}$", str(b.get("coll"))) or not isinstance(b.get("data"), dict): return self.send(400, {"error": "参数不对"})
                with lock: DOCS[(uid, b["coll"], b["id"])] = b["data"]
                return self.send(200, {"ok": True})
            if m == "DELETE":
                with lock: DOCS.pop((uid, q.get("coll"), q.get("id")), None)
                return self.send(200, {"ok": True})
        if p == "docs" and m == "POST":
            b = json.loads(self.body() or b"{}"); w = sk = 0
            for d in b.get("docs", []):
                if d.get("coll") in COLLS and isinstance(d.get("data"), dict) and d.get("id"):
                    with lock: DOCS[(uid, d["coll"], d["id"])] = d["data"]; w += 1
                else: sk += 1
            return self.send(200, {"ok": True, "written": w, "skipped": sk})
        if p == "files" and m == "POST":
            raw = self.body(); ct = self.headers.get("content-type")
            msg = BytesParser(policy=email_default).parsebytes(b"content-type: " + ct.encode() + b"\r\n\r\n" + raw)
            for part in msg.iter_parts():
                if part.get_param("name", header="content-disposition") == "file":
                    data = part.get_payload(decode=True); typ = part.get_content_type(); name = part.get_filename() or "book"
                    if typ not in ("application/pdf", "application/epub+zip", "text/plain"): return self.send(415, {"error": "只能上传 PDF 或 EPUB", "code": "unsupported_type"})
                    fid = "c" + uuid.uuid4().hex[:20]; FILES[fid] = (uid, typ, name, data)
                    return self.send(200, {"id": fid, "url": "/api/yxl/files/" + fid, "sizeBytes": len(data), "contentType": typ})
            return self.send(400, {"error": "没有收到文件"})
        if p == "files" and m == "PUT":
            if FLAGS["old"]: return self.send(405, "", "text/plain")
            n = int(self.headers.get("content-length") or 0); data = self.rfile.read(n)
            typ = (self.headers.get("content-type") or "").split(";")[0]
            if typ not in ("application/pdf", "application/epub+zip", "text/plain"): return self.send(415, {"error": "只能上传 PDF 或 EPUB", "code": "unsupported_type"})
            fid = "c" + uuid.uuid4().hex[:20]; FILES[fid] = (uid, typ, q.get("name", "book"), data)
            return self.send(200, {"id": fid, "url": "/api/yxl/files/" + fid, "sizeBytes": len(data), "contentType": typ})
        if p.startswith("files/"):
            fid = p[6:]; f = FILES.get(fid)
            if m in ("GET", "HEAD"):
                if not f or f[0] != uid: return self.send(404, {"error": "找不到这个文件"})
                data = f[3]; rg = self.headers.get("range")
                if rg and not FLAGS["old"]:
                    a, _, b = rg.replace("bytes=", "").partition("-"); a = int(a); b = int(b) if b else len(data) - 1
                    RANGES.append((a, b))
                    return self.send(206, data[a:b + 1], f[1], {"content-range": f"bytes {a}-{b}/{len(data)}", "accept-ranges": "bytes"})
                return self.send(200, data, f[1], {} if FLAGS["old"] else {"accept-ranges": "bytes"})
            if m == "DELETE":
                if f and f[0] == uid: FILES.pop(fid, None); return self.send(200, {"deleted": True})
                return self.send(200, {"deleted": False})
        return self.send(404, {"error": "nf"})
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8790), H).serve_forever()
