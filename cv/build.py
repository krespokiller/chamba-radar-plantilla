"""Builds one-page CVs from cv/perfil.json (facts + variants). Usage: python3 build.py [font_pt] [outdir] [perfil.json]

perfil.json is the single source of truth for the person's experience:
  name, short_name, lang ("en" | "es", per variant too), contact, jobs[{key, title, dates, intro?, bullets{id: html}}], earlier (html),
  skills{id: {label, text}}, education_title, education,
  variants{Key: {role, profile, highlight{title, items[html]}|null, jobs{jobkey: [bullet ids] | "all"}, skills[ids]}}
Bullets and highlight items may contain <b>; everything else is escaped.
"""
import html, json, os, sys

FS = sys.argv[1] if len(sys.argv) > 1 else "8.9"
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
SRC = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "perfil.json")

CSS = """
  @page { size: Letter; margin: 0.42in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: %spt; line-height: 1.33; color: #1d2330; margin: 0; }
  h1 { font-size: 21pt; margin: 0; letter-spacing: -0.3px; color: #0f1b33; }
  .role { font-size: 11pt; color: #2a5bd7; font-weight: 600; margin-top: 2px; }
  .contact { font-size: 8.8pt; color: #4a5368; margin-top: 3px; }
  h2 { font-size: 9.2pt; text-transform: uppercase; letter-spacing: 1.2px; color: #0f1b33; border-bottom: 1px solid #c9d1e3; padding-bottom: 2px; margin: 10px 0 5px; }
  p { margin: 0 0 5px; }
  ul { margin: 2px 0 6px; padding-left: 16px; }
  li { margin-bottom: 2px; }
  .job { margin-top: 7px; }
  .job-head { display: flex; justify-content: space-between; gap: 12px; }
  .job-head b { color: #0f1b33; }
  .job-head span { color: #4a5368; white-space: nowrap; }
  b { color: #0f1b33; }
""" % FS

E = html.escape


def li(items):
    return "<ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


LABELS = {"en": {"profile": "Profile", "experience": "Experience", "skills": "Skills", "education": "Education and Languages"},
          "es": {"profile": "Perfil", "experience": "Experiencia", "skills": "Habilidades", "education": "Educación e idiomas"}}


def build(d, key, v):
    lang = v.get("lang", d.get("lang", "en"))
    lb = {**LABELS.get(lang, LABELS["en"]), **d.get("labels", {})}
    parts = [f"<!doctype html><html lang='{lang}'><head><meta charset='utf-8'><title>{E(d.get('short_name', d['name']))} - CV {E(v['role'])}</title><style>{CSS}</style></head><body>"]
    parts.append(f"<h1>{E(d['name'])}</h1>")
    parts.append(f"<div class='role'>{E(v['role'])}</div>")
    parts.append(f"<div class='contact'>{E(d['contact'])}</div>")
    parts.append(f"<h2>{E(lb['profile'])}</h2><p>{E(v['profile'])}</p>")
    if v.get("highlight"):
        parts.append(f"<h2>{E(v['highlight']['title'])}</h2>{li(v['highlight']['items'])}")
    parts.append(f"<h2>{E(lb['experience'])}</h2>")
    for job in d["jobs"]:
        pick = v.get("jobs", {}).get(job["key"], "all")
        if pick is None or pick == []:
            continue
        bullets = list(job["bullets"].values()) if pick == "all" else [job["bullets"][k] for k in pick]
        intro = f"<p>{E(job['intro'])}</p>" if job.get("intro") else ""
        parts.append(f"<div class='job'><div class='job-head'><b>{E(job['title'])}</b><span>{E(job['dates'])}</span></div>{intro}{li(bullets)}</div>")
    if d.get("earlier"):
        parts.append(f"<div class='job'><p>{d['earlier']}</p></div>")
    parts.append(f"<h2>{E(lb['skills'])}</h2>")
    for k in v["skills"]:
        s = d["skills"][k]
        parts.append(f"<p><b>{E(s['label'])}:</b> {E(s['text'])}</p>")
    parts.append(f"<h2>{E(d.get('education_title', lb['education']))}</h2><p>{E(d['education'])}</p></body></html>")
    with open(f"{OUT}/{key}.html", "w", encoding="utf8") as f:
        f.write("".join(parts))


if __name__ == "__main__":
    data = json.load(open(SRC, encoding="utf8"))
    os.makedirs(OUT, exist_ok=True)
    for k, v in data["variants"].items():
        build(data, k, v)
    print("built", list(data["variants"]))
