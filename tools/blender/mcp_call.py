# 往 Blender 窗口里的 MCP 插件发命令：python3 tools/blender/mcp_call.py exec <a.py> [b.py ...]（多个文件按顺序拼成一段执行）| shot <Windows 路径.png> | info
import socket,json,sys,base64
def call(t,params):
    s=socket.create_connection(("127.0.0.1",9876),timeout=120); s.sendall(json.dumps({"type":t,"params":params}).encode()); buf=b""
    while True:
        c=s.recv(1<<20)
        if not c: break
        buf+=c
        try: return json.loads(buf)
        except json.JSONDecodeError: pass
    return json.loads(buf)
cmd=sys.argv[1]
if cmd=="exec": r=call("execute_code",{"code":"\n".join(open(f).read() for f in sys.argv[2:])}); print(json.dumps(r,ensure_ascii=False)[:1500])
elif cmd=="shot": r=call("get_viewport_screenshot",{"max_size":1400,"filepath":sys.argv[2],"format":"png"}); print(json.dumps(r)[:300])
else: print(json.dumps(call("get_scene_info",{}),ensure_ascii=False)[:1500])
