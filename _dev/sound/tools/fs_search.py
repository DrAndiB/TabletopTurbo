"""Search Freesound for CC0 sounds (public search page, no API key) and optionally download HQ previews.

usage: python -I fs_search.py "query" [--max-dur S] [--min-dur S] [--pages N] [--get ID,ID,... --to DIR]
Downloads land in DIR as <id>.mp3 plus <id>.json (title, user, url, license) for the credits file.
"""
import json, re, sys, time, urllib.error, urllib.parse, urllib.request, html as H, os, argparse
sys.stdout.reconfigure(encoding='utf-8')

UA = {'User-Agent': 'Mozilla/5.0 (sound-lab research script)'}

def fetch(url):
    # Freesound answers 429 to quick bursts: be polite, back off and retry
    for k in range(6):
        time.sleep(1.5)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode('utf8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(8 * (k + 1))
    raise RuntimeError('rate limited: ' + url)

def search(q, pages=1):
    out = []
    for p in range(1, pages + 1):
        url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': 'license:"Creative Commons 0"', 'page': p})
        h = fetch(url)
        for m in re.finditer(r'<div\s+class="bw-player"(.*?)tabindex', h, re.S):
            a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
            out.append({
                'id': a['sound-id'], 'user': a['username'], 'title': H.unescape(a.get('title', '')),
                'dur': float(a.get('duration', 0)), 'dl': int(a.get('num-downloads', 0) or 0),
                'mp3': a['mp3'].replace('-lq.mp3', '-hq.mp3'),
            })
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('q', nargs='?')
    ap.add_argument('--pages', type=int, default=1)
    ap.add_argument('--min-dur', type=float, default=0)
    ap.add_argument('--max-dur', type=float, default=1e9)
    ap.add_argument('--get')
    ap.add_argument('--to')
    o = ap.parse_args()
    if o.get:
        os.makedirs(o.to, exist_ok=True)
        for sid in o.get.split(','):
            # the sound page confirms the license (search filter aside) and gives the preview url
            h = fetch(f'https://freesound.org/s/{sid}/')
            lic = re.search(r'creativecommons\.org/(publicdomain/zero|licenses/[\w-]+)/[\d.]+', h)
            lic = lic.group(0) if lic else '?'
            mp3 = re.search(r'https://cdn\.freesound\.org/previews/\d+/' + sid + r'_\d+-hq\.mp3', h)
            title = re.search(r'<title>([^<]*)</title>', h)
            user = re.search(r'/people/([^/"]+)/sounds/' + sid, h)
            meta = {'id': sid, 'title': H.unescape(title.group(1).strip()) if title else '', 'user': user.group(1) if user else '',
                    'url': f'https://freesound.org/s/{sid}/', 'license': lic}
            if 'publicdomain/zero' not in lic:
                print('SKIP (not CC0):', sid, lic); continue
            urllib.request.urlretrieve(mp3.group(0), os.path.join(o.to, sid + '.mp3'))
            json.dump(meta, open(os.path.join(o.to, sid + '.json'), 'w'), indent=1)
            print('ok', sid, meta['title'])
    else:
        rs = [r for r in search(o.q, o.pages) if o.min_dur <= r['dur'] <= o.max_dur]
        for r in sorted(rs, key=lambda r: -r['dl']):
            print(f"{r['id']:>7} {r['dur']:7.1f}s {r['dl']:6}dl  {r['user'][:18]:18} {r['title'][:70]}")
