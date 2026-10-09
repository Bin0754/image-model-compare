#!/usr/bin/env python3
"""把 src/ 下的 head.html + style.css + app1/2/3.js 合并为仓库根目录的单文件 index.html。

站点网址（用于分享卡片 og:image 的绝对地址）按以下优先级确定：
  1. 环境变量 SITE_URL
  2. 仓库根目录 site.config.json 的 "siteUrl"
Fork 后请把它改成你自己的 Pages 网址，再运行本脚本。

用法：
  python3 src/build.py          # 重新生成 index.html
  python3 src/build.py --check  # 只检查 index.html 是否与 src 同步（CI 用），不同步则退出码 1
"""
import json, os, pathlib, sys
SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent / 'index.html'

def site_url() -> str:
    url = os.environ.get('SITE_URL')
    if not url:
        cfg = SRC.parent / 'site.config.json'
        url = json.loads(cfg.read_text(encoding='utf-8')).get('siteUrl', '') if cfg.exists() else ''
    url = (url or '').strip()
    if url and not url.endswith('/'):
        url += '/'
    return url

def build() -> str:
    head = (SRC / 'head.html').read_text(encoding='utf-8').replace('%SITE_URL%', site_url())
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    js = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in ('app1.js', 'app2.js', 'app3.js'))
    return head.replace('/*CSS*/', css).replace('/*JS*/', js)

if __name__ == '__main__':
    html = build()
    if '--check' in sys.argv:
        cur = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if cur != html:
            print('index.html 与 src/ 不同步，请运行: python3 src/build.py', file=sys.stderr)
            sys.exit(1)
        print('index.html 已与 src/ 同步')
    else:
        OUT.write_text(html, encoding='utf-8')
        print(f'已生成 {OUT.name}（{len(html.encode("utf-8")):,} 字节）')
