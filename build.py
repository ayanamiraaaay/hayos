#!/usr/bin/env python3
"""Сборка сайта «Чистый путь».

Запуск:  python3 build.py
Берёт страницы из src/pages, добавляет к ним шапку, подвал, форму заявки и данные из src/config.json
и кладёт готовые HTML-файлы в корень репозитория (их раздаёт GitHub Pages).

python3 build.py --artifact  — дополнительно собирает версию со встроенными стилями и скриптами
в папку .artifact/ (для предпросмотра в Claude).
"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
CFG = json.loads((SRC / "config.json").read_text(encoding="utf-8"))
RUNTIME_KEYS = ["leadEndpoint", "trackEndpoint", "metrikaId", "showSampleBadges", "phone", "priceValidDays"]

NAV = [
    ("services", "Услуги", "services.html"),
    ("prices", "Цены", "prices.html"),
    ("cases", "Кейсы", "cases.html"),
    ("about", "О компании", "about.html"),
    ("knowledge", "Статьи", "knowledge.html"),
    ("contacts", "Контакты", "contacts.html"),
]

LOGO_SYMBOL = """<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="mark" viewBox="0 0 60 36">
<path class="l-blue" d="M2 33 L13.5 15 Q16 11.5 20 11.5 L47.5 11.5 L42 6 L48 6 L59 16.5 L21 16.5 Q19 16.5 17.8 18.2 L8 33 Z"/>
<path class="l-ink" d="M14 33 L19.8 24.5 Q21.6 22 25 22 L59 22 L48 33 L42 33 L47.5 27 L26 27 Q24 27 23 28.3 L19.8 33 Z"/>
</symbol></defs></svg>"""

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#FFFFFF"/>
<g transform="translate(3 14)"><path fill="#2D74E0" d="M2 33 L13.5 15 Q16 11.5 20 11.5 L47.5 11.5 L42 6 L48 6 L59 16.5 L21 16.5 Q19 16.5 17.8 18.2 L8 33 Z"/>
<path fill="#0E1A30" d="M14 33 L19.8 24.5 Q21.6 22 25 22 L59 22 L48 33 L42 33 L47.5 27 L26 27 Q24 27 23 28.3 L19.8 33 Z"/></g></svg>"""

ICONS = {
    "phone": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    "tg": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z"/><path d="M9 13l8-6"/></svg>',
    "box": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
}


def header(active):
    cur = ' aria-current="page"'
    links = "".join(f'<a href="{href}"{cur if key == active else ""}>{label}</a>' for key, label, href in NAV)
    mlinks = "".join(f'<a class="mi" href="{href}"{cur if key == active else ""}>{label}</a>' for key, label, href in NAV)
    track_cur = cur if active == "tracking" else ""
    home_cur = cur if active == "home" else ""
    return f"""{LOGO_SYMBOL}
<header class="top">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="{{{{company}}}} — на главную"><svg aria-hidden="true"><use href="#mark"/></svg>{{{{company}}}}</a>
    <nav class="nav" aria-label="Страницы">{links}</nav>
    <div class="top-right">
      <a class="top-track" href="tracking.html"{track_cur}>{ICONS["box"]}Отследить груз</a>
      <a class="top-phone" href="tel:{{{{phoneHref}}}}"><b>{{{{phone}}}}</b><span>{{{{hours}}}}</span></a>
      <button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Открыть меню">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path id="burger-ico" d="M4 7h16M4 12h16M4 17h10"/></svg>
      </button>
    </div>
  </div>
</header>
<nav class="menu" id="menu" aria-label="Меню" hidden>
  <a class="mi" href="index.html"{home_cur}>Главная</a>
  {mlinks}
  <a class="mi" href="tracking.html"{track_cur}>Отследить груз</a>
  <div class="menu-foot">
    <a class="btn btn-primary btn-block" href="#lead" data-to-lead="">Оставить заявку</a>
    <a class="btn btn-ghost btn-block" href="tel:{{{{phoneHref}}}}">{{{{phone}}}}</a>
    <p>{{{{hours}}}}. Ответим за {{{{responseMinutes}}}} минут.</p>
  </div>
</nav>"""


LEAD = """<section class="leadband" id="lead">
  <div class="wrap lb-grid">
    <div>
      <div class="eyebrow">Заявка</div>
      <h2>Получите точный расчёт за {{responseMinutes}} минут</h2>
      <p class="lead">Оставьте телефон или Telegram. Менеджер уточнит детали и пришлёт цену, которую зафиксируем в договоре.</p>
      <ul class="lb-points"><li>Расчёт бесплатный и ни к чему не обязывает</li><li>Ответим в мессенджере, если неудобно говорить</li><li>Принимаем партии от 30 кг</li></ul>
    </div>
    <form class="form" id="lead-form" data-lead-form="lead" novalidate>
      <div class="field"><label for="f-name">Имя</label><input id="f-name" name="name" autocomplete="name" placeholder="Как к вам обращаться"></div>
      <div class="field"><label for="f-contact">Телефон или Telegram</label><input id="f-contact" name="contact" type="text" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00 или @username"></div>
      <div class="field"><label for="f-comment">Что везём <span class="hint">необязательно</span></label><textarea id="f-comment" name="comment" placeholder="Например: детская одежда, 500 кг, из Гуанчжоу в Казань"></textarea></div>
      <div class="hp" aria-hidden="true"><label for="f-website">Не заполняйте</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
      <p class="err" hidden>Укажите телефон (10 цифр) или ник в Telegram, чтобы мы могли прислать расчёт.</p>
      <div><button class="btn btn-primary btn-block" type="submit">Получить расчёт</button><span class="btn-sub">Ответим за {{responseMinutes}} минут в рабочее время</span></div>
      <small>Нажимая кнопку, вы соглашаетесь с <a href="privacy.html">политикой конфиденциальности</a>.</small>
      <div class="ok-msg" hidden><b>Заявка принята.</b> Менеджер свяжется с вами в течение {{responseMinutes}} минут в рабочее время.<p class="demo-note" hidden>Демо-режим: адрес отправки не настроен в config.json, заявка никуда не ушла.</p></div>
    </form>
  </div>
</section>"""

FOOTER = """<footer>
  <div class="wrap">
    <div class="f-grid">
      <div class="f-col"><a class="logo" href="index.html"><svg aria-hidden="true"><use href="#mark"/></svg>{{company}}</a><p style="margin-top:6px;max-width:34ch">Доставка грузов из Китая в Россию: авто, ж/д, авиа и контейнеры под ключ.</p></div>
      <nav aria-label="Услуги"><h4>Клиентам</h4><a href="prices.html">Цены и калькулятор</a><a href="tracking.html">Отследить груз</a><a href="marketplaces.html">Для селлеров маркетплейсов</a><a href="checklist.html">Чек-лист для маркетплейсов</a><a href="supplier.html" hreflang="en">For suppliers (English)</a></nav>
      <nav aria-label="Компания"><h4>Компания</h4><a href="services.html">Услуги</a><a href="cases.html">Кейсы</a><a href="about.html">О компании</a><a href="knowledge.html">Статьи</a><a href="contacts.html">Контакты</a></nav>
      <div class="f-col"><h4>Связь</h4><a href="tel:{{phoneHref}}" class="num">{{phone}}</a><span>{{email}}</span><span>{{hours}}</span><span>Доставка в <a href="dostavka-kazan.html">Казань</a>, <a href="dostavka-ekaterinburg.html">Екатеринбург</a>, <a href="dostavka-novosibirsk.html">Новосибирск</a></span></div>
    </div>
    <div class="f-bottom"><span>© {{foundedYear}}–<span data-year></span> {{legalName}} · ИНН {{inn}} · ОГРН {{ogrn}}</span><a href="privacy.html">Политика конфиденциальности</a></div>
  </div>
</footer>
<nav class="mbar" aria-label="Быстрые действия">
  <a class="sq" href="tel:{{phoneHref}}" aria-label="Позвонить">""" + ICONS["phone"] + """</a>
  <a class="sq" href="https://t.me/{{telegram}}" target="_blank" rel="noopener" aria-label="Написать в Telegram">""" + ICONS["tg"] + """</a>
  <a class="sq" href="{{max}}" target="_blank" rel="noopener" aria-label="Написать в MAX">MAX</a>
  <a class="btn btn-primary" href="prices.html">Рассчитать доставку</a>
</nav>
<div class="cookie" id="cookie" role="dialog" aria-label="Файлы cookie" hidden>
  <p>Мы используем cookie и Яндекс Метрику, чтобы понимать, как улучшить сайт. Подробнее в <a href="privacy.html">политике конфиденциальности</a>.</p>
  <div class="row-btns"><button class="btn btn-white" type="button" data-cookie="all">Принять</button><button class="btn btn-ghost" type="button" data-cookie="necessary">Только необходимые</button></div>
</div>"""


def subst(text):
    def rep(m):
        key = m.group(1)
        if key not in CFG:
            raise KeyError(f"Нет ключа {key} в config.json")
        return html.escape(str(CFG[key]), quote=True)
    return re.sub(r"\{\{(\w+)\}\}", rep, text)


def read_page(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"<!--META\s+(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise ValueError(f"{path.name}: нет блока META")
    return json.loads(m.group(1)), raw[m.end():]


# ---------- Страницы городов: один шаблон, данные ниже ----------
CITIES = [
    {"slug": "kazan", "name": "Казань", "in": "в Казань", "auto": "19–26", "rail": "26–36", "air": "8–13", "from": "2,5",
     "local": "Доставляем до склада Wildberries в Казани и до складов Ozon в Казани и Зеленодольске.",
     "note": "Казань — один из главных складских узлов маркетплейсов в Поволжье, поэтому многие наши клиенты отгружают сюда партии сразу из Китая."},
    {"slug": "ekaterinburg", "name": "Екатеринбург", "in": "в Екатеринбург", "auto": "17–24", "rail": "24–34", "air": "8–13", "from": "2,35",
     "local": "Доставляем до складов маркетплейсов в Екатеринбурге и до вашего склада или производства по Свердловской области.",
     "note": "Авто через Казахстан приходит в Екатеринбург раньше, чем в Москву: город ближе к погранпереходу."},
    {"slug": "novosibirsk", "name": "Новосибирск", "in": "в Новосибирск", "auto": "15–22", "rail": "22–32", "air": "7–11", "from": "2,25",
     "local": "Доставляем до складов маркетплейсов в Новосибирске и по Сибири через транспортные компании.",
     "note": "Новосибирск — самый быстрый для нас город после погранперехода, поэтому ставка здесь ниже московской."},
]


def city_page(c):
    meta = {"title": f"Доставка грузов из Китая {c['in']} — от {c['from']} $/кг | {{{{company}}}}",
            "description": f"Карго и белая доставка из Китая {c['in']}: авто {c['auto']} дней, ж/д {c['rail']} дней, авиа {c['air']} дней. Фиксированная цена в договоре, страховка груза.",
            "nav": "", "file": f"dostavka-{c['slug']}.html"}
    body = f"""<div class="wrap phead">
  <div class="crumbs"><a href="index.html">Главная</a> / <a href="services.html">Услуги</a> / {c['name']}</div>
  <h1>Доставка грузов из Китая {c['in']}</h1>
  <p class="lead">{c['note']} {c['local']}</p>
</div>
<section style="padding-top:20px">
  <div class="wrap">
    <div class="stats" style="margin-top:0">
      <div class="stat"><b>{c['auto']} дн</b><span>авто</span></div>
      <div class="stat"><b>{c['rail']} дн</b><span>железная дорога</span></div>
      <div class="stat"><b>{c['air']} дн</b><span>авиа</span></div>
      <div class="stat"><b>от {c['from']} $</b><span>за кг авто под ключ</span></div>
    </div>
    <div class="grid3">
      <div class="card"><h3>Из любого города Китая</h3><p>Забираем у поставщика или принимаем на складах в Гуанчжоу, Иу и Шэньчжэне.</p></div>
      <div class="card"><h3>До двери {c['in'].replace('в ', 'в ')}</h3><p>{c['local']}</p></div>
      <div class="card"><h3>Цена в договоре</h3><p>Фиксируем ставку до отправки. Страхуем груз на 100% стоимости.</p></div>
    </div>
    <div class="row-btns" style="margin-top:24px"><a class="btn btn-primary" href="prices.html">Рассчитать доставку {c['in']}</a><a class="btn btn-ghost" href="#lead" data-to-lead="Доставка {c['in']}: ">Получить расчёт у менеджера</a></div>
  </div>
</section>
<section class="tinted">
  <div class="wrap">
    <div class="eyebrow">Ближайшие отправки</div>
    <h2>Когда уедет ваш груз</h2>
    <p class="lead">Сроки до города {c['name']} считаются от даты отправки со склада в Китае.</p>
    <div class="deps" id="deps" data-limit="4"></div>
  </div>
</section>"""
    return meta, body


def page_html(meta, body, mode):
    active = meta.get("nav", "")
    title = subst(meta["title"])
    desc = subst(meta["description"])
    fname = meta["file"]
    url = CFG["siteUrl"] + ("" if fname == "index.html" else fname)
    lang = meta.get("lang", "ru")
    robots = '<meta name="robots" content="noindex">' if meta.get("noindex") else ""
    if fname == "404.html" and mode == "site":
        # GitHub Pages показывает 404 по любому адресу, поэтому относительные ссылки считаем от корня сайта
        robots += f'\n<base href="{CFG["siteUrl"]}">'
    runtime = json.dumps({k: CFG[k] for k in RUNTIME_KEYS}, ensure_ascii=False)
    jsonld = ""
    if fname == "index.html":
        jsonld = '<script type="application/ld+json">' + json.dumps({
            "@context": "https://schema.org", "@type": "MovingCompany", "name": CFG["legalName"],
            "url": CFG["siteUrl"], "telephone": CFG["phone"], "email": CFG["email"],
            "address": {"@type": "PostalAddress", "addressLocality": "Москва", "streetAddress": CFG["legalAddress"]},
            "areaServed": "RU", "description": desc}, ensure_ascii=False) + "</script>"

    if mode == "site":
        css = '<link rel="stylesheet" href="assets/style.css">'
        js = f'<script>window.SITE={runtime};</script>\n<script src="assets/app.js" defer></script>'
        icons = '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">'
    else:
        css = "<style>" + (SRC / "style.css").read_text(encoding="utf-8") + "</style>"
        js = f"<script>window.SITE={runtime};</script>\n<script>" + (SRC / "app.js").read_text(encoding="utf-8") + "</script>"
        icons = ""

    show_lead = meta.get("lead", True)
    parts = [header(active), "<main>", subst(body), subst(LEAD) if show_lead else "", "</main>", subst(FOOTER), js]
    content = "\n".join(p for p in parts if p)
    content = subst(content) if "{{" in content else content

    head_core = f"""<title>{title}</title>
<meta name="description" content="{desc}">
{robots}
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="ru_RU">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{CFG['siteUrl']}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFFFFF">
{icons}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
{css}
{jsonld}"""

    if mode == "artifact-main":
        # Главная страница артефакта: Claude сам добавляет doctype, head и body
        return f'{head_core}\n<meta name="claude:viewport-fit-sides" content="cover">\n{content}\n'
    reset = "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>"
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{reset}
{head_core}
</head>
<body>
{content}
</body>
</html>
"""


def og_image(out):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("PIL не установлен — og.png пропущен")
        return
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(img)
    def poly(path_pts, color, s, ox, oy):
        d.polygon([(ox + x * s, oy + y * s) for x, y in path_pts], fill=color)
    blue = [(2, 33), (13.5, 15), (16, 12.5), (20, 11.5), (47.5, 11.5), (42, 6), (48, 6), (59, 16.5), (21, 16.5), (18.5, 17.2), (8, 33)]
    ink = [(14, 33), (19.8, 24.5), (22, 22.5), (25, 22), (59, 22), (48, 33), (42, 33), (47.5, 27), (26, 27), (23.5, 27.8), (19.8, 33)]
    poly(blue, "#2D74E0", 5, 90, 150); poly(ink, "#0E1A30", 5, 90, 150)
    fonts = "/usr/share/fonts/opentype/inter/"
    try:
        f1 = ImageFont.truetype(fonts + "Inter-ExtraBold.otf", 96)
        f2 = ImageFont.truetype(fonts + "Inter-Medium.otf", 44)
    except OSError:
        f1 = f2 = ImageFont.load_default()
    d.text((420, 170), CFG["company"], font=f1, fill="#0E1A30")
    d.text((90, 380), "Доставка грузов из Китая в Россию", font=f2, fill="#0E1A30")
    d.text((90, 440), "под ключ за 18–35 дней · цена в договоре", font=f2, fill="#5B6B82")
    d.rectangle([0, H - 18, W, H], fill="#2D74E0")
    img.save(out)


def main():
    artifact = "--artifact" in sys.argv
    pages = []
    for p in sorted((SRC / "pages").glob("*.html")):
        meta, body = read_page(p)
        meta["file"] = p.name
        pages.append((meta, body))
    for c in CITIES:
        pages.append(city_page(c))

    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "style.css").write_text((SRC / "style.css").read_text(encoding="utf-8"), encoding="utf-8")
    (assets / "app.js").write_text((SRC / "app.js").read_text(encoding="utf-8"), encoding="utf-8")
    (assets / "favicon.svg").write_text(FAVICON_SVG, encoding="utf-8")
    og_image(assets / "og.png")

    urls = []
    for meta, body in pages:
        (ROOT / meta["file"]).write_text(page_html(meta, body, "site"), encoding="utf-8")
        if not meta.get("noindex"):
            urls.append(CFG["siteUrl"] + ("" if meta["file"] == "index.html" else meta["file"]))

    today = date.today().isoformat()
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {CFG['siteUrl']}sitemap.xml\n", encoding="utf-8")
    print(f"Собрано страниц: {len(pages)}")

    if artifact:
        out = ROOT / ".artifact"
        out.mkdir(exist_ok=True)
        for meta, body in pages:
            if meta["file"] == "404.html":
                continue
            mode = "artifact-main" if meta["file"] == "index.html" else "artifact"
            (out / meta["file"]).write_text(page_html(meta, body, mode), encoding="utf-8")
        print(f"Версия для артефакта: {out}")


if __name__ == "__main__":
    main()
