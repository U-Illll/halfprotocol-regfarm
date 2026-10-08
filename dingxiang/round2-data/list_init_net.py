import json, os
ART = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "artifacts"))
for fn in ("dx-init-net.json", "dx-home-links.json"):
    p = os.path.join(ART, fn)
    if not os.path.exists(p):
        continue
    d = json.load(open(p, encoding="utf-8"))
    print("=" * 70)
    print(fn, "条目:", len(d))
    for r in d:
        u = (r.get("u") or "")[:160]
        print(" ", r.get("m"), r.get("status"), u)
print("=" * 70)
# fresh / widget geo
for fn in ("dx-widget-geo.json", "fresh-meta.json"):
    p = os.path.join(ART, fn)
    if os.path.exists(p):
        print(fn, "->", open(p, encoding="utf-8").read()[:900])
