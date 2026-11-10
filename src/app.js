/* Чистый путь — общий скрипт всех страниц.
   Настройки (адрес отправки заявок, Метрика и т. д.) приходят из window.SITE,
   который сборка берёт из src/config.json. */
(function () {
  'use strict';
  var SITE = window.SITE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var fmtNum = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var fmtDate = function (d) { return d.getDate() + ' ' + MONTHS_FULL[d.getMonth()]; };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };

  if (SITE.showSampleBadges === false) document.documentElement.classList.add('no-samples');
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Меню на телефоне ---------- */
  var menu = $('#menu'), burger = $('#burger'), bico = $('#burger-ico');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    bico.setAttribute('d', open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h10');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  if (burger) burger.addEventListener('click', function () { setMenu(menu.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  /* ---------- Вкладки «Для кого» ---------- */
  var tabs = $$('[role=tab]');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) {
        x.setAttribute('aria-selected', 'false');
        $('#' + x.getAttribute('aria-controls')).hidden = true;
      });
      t.setAttribute('aria-selected', 'true');
      $('#' + t.getAttribute('aria-controls')).hidden = false;
    });
  });

  /* ---------- Фильтр кейсов ---------- */
  var fbtns = $$('[data-f]');
  fbtns.forEach(function (b) {
    b.addEventListener('click', function () {
      fbtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      $$('.case[data-seg]').forEach(function (c) { c.hidden = !(b.dataset.f === 'all' || c.dataset.seg === b.dataset.f); });
    });
  });

  /* ---------- Копирование ---------- */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var old = b.textContent;
      var done = function () { b.textContent = 'Скопировано'; setTimeout(function () { b.textContent = old; }, 1600); };
      try { navigator.clipboard.writeText(b.dataset.copy).then(done, function () {}); } catch (e) {}
    });
  });

  /* ---------- UTM-метки: запоминаем, откуда пришёл клиент ---------- */
  try {
    var qs = new URLSearchParams(location.search), utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach(function (k) { if (qs.get(k)) utm[k] = qs.get(k); });
    if (Object.keys(utm).length) sessionStorage.setItem('cp-utm', JSON.stringify(utm));
  } catch (e) {}
  function getUtm() { try { return JSON.parse(sessionStorage.getItem('cp-utm') || '{}'); } catch (e) { return {}; } }

  /* ---------- Cookie и Яндекс Метрика ---------- */
  function loadMetrika() {
    var id = SITE.metrikaId;
    if (!id || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(Number(id), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  function goal(name) { if (window.ym && SITE.metrikaId) window.ym(Number(SITE.metrikaId), 'reachGoal', name); }
  var cookie = $('#cookie'), choice = store.get('cp-cookie');
  if (choice === 'all') loadMetrika();
  if (cookie && !choice && SITE.metrikaId) { // баннер нужен, только если подключена аналитика
    cookie.hidden = false;
    $$('[data-cookie]', cookie).forEach(function (b) {
      b.addEventListener('click', function () {
        store.set('cp-cookie', b.dataset.cookie);
        cookie.hidden = true;
        if (b.dataset.cookie === 'all') loadMetrika();
      });
    });
  }

  /* ---------- Заявки ---------- */
  function cleanContact(v) { return v.replace(/[^\d+@_a-zA-Z.]/g, ''); }
  function validContact(v) {
    var digits = v.replace(/\D/g, '');
    return digits.length >= 10 || /^@?[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(v.trim());
  }
  function sendLead(data) {
    if (!SITE.leadEndpoint) return Promise.resolve({ demo: true });
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
    return fetch(SITE.leadEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { demo: false };
    });
  }
  $$('form[data-lead-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var contact = $('[name=contact]', form), err = $('.err', form), ok = $('.ok-msg', form), btn = $('button[type=submit]', form);
      if ($('[name=website]', form).value) return; // ловушка для спам-ботов
      if (!validContact(contact.value)) {
        contact.setAttribute('aria-invalid', 'true'); err.hidden = false; contact.focus(); return;
      }
      contact.removeAttribute('aria-invalid'); err.hidden = true;
      var nameEl = $('[name=name]', form), commentEl = $('[name=comment]', form);
      var data = {
        type: form.dataset.leadForm || 'lead',
        name: nameEl ? nameEl.value.trim().slice(0, 80) : '',
        contact: cleanContact(contact.value).slice(0, 60),
        comment: commentEl ? commentEl.value.trim().slice(0, 1000) : '',
        page: location.pathname, utm: getUtm()
      };
      btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Отправляем…';
      sendLead(data).then(function (res) {
        btn.hidden = true; ok.hidden = false;
        if (res.demo) { var n = $('.demo-note', form); if (n) n.hidden = false; }
        goal(data.type === 'checklist' ? 'checklist' : 'lead');
        var reveal = form.dataset.reveal && $(form.dataset.reveal);
        if (reveal) reveal.hidden = false;
      }).catch(function () {
        btn.disabled = false; btn.textContent = btn.dataset.label;
        err.textContent = 'Не удалось отправить заявку. Позвоните нам: ' + (SITE.phone || '') + ' или напишите в Telegram.';
        err.hidden = false;
      });
    });
  });

  /* Кнопки «отправить менеджеру» подставляют текст в форму и прокручивают к ней */
  $$('[data-to-lead]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      var form = $('#lead-form');
      if (!form) return;
      e.preventDefault(); setMenu(false);
      var text = b.dataset.toLead === 'calc' ? (window.__calcSummary || '') : b.dataset.toLead;
      var c = $('[name=comment]', form);
      if (c && text) c.value = text;
      $('#lead').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { $('[name=contact]', form).focus({ preventScroll: true }); }, 500);
    });
  });

  /* ---------- Ближайшие отправки (считаются от сегодняшней даты) ---------- */
  var depsEl = $('#deps');
  if (depsEl) {
    var SCHEDULE = [
      { mode: 'Авто', from: 'Гуанчжоу', weekdays: [2, 5], transit: '18–25 дней', route: 'через Хоргос' },
      { mode: 'Ж/д', from: 'Иу', weekdays: [4], transit: '25–35 дней', route: 'контейнерный поезд' },
      { mode: 'Авиа', from: 'Шэньчжэнь', weekdays: [1, 3, 5], transit: '7–12 дней', route: 'через Новосибирск' }
    ];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var list = [];
    for (var i = 1; i <= 14; i++) {
      var d = addDays(today, i);
      SCHEDULE.forEach(function (s) { if (s.weekdays.indexOf(d.getDay()) >= 0) list.push({ d: d, s: s }); });
    }
    var limit = Number(depsEl.dataset.limit || 6);
    depsEl.innerHTML = list.slice(0, limit).map(function (x) {
      var cutoff = addDays(x.d, -1), soon = (cutoff - today) / 864e5 <= 1;
      return '<div class="dep"><div class="dep-date"><b>' + x.d.getDate() + '</b><span>' + MONTHS[x.d.getMonth()] + ', ' + WD[x.d.getDay()] + '</span></div>' +
        '<div><h3>' + x.s.mode + ' из города ' + x.s.from + '</h3><p>' + x.s.transit + ', ' + x.s.route + '</p></div>' +
        '<span class="tag' + (soon ? ' hot' : '') + '">приём до ' + fmtDate(cutoff) + '</span></div>';
    }).join('');
  }

  /* ---------- Калькулятор ---------- */
  var calc = $('#calc');
  if (calc) {
    var MODES = { // ставки карго «под ключ», $/кг по плотности груза; m3 — для лёгких грузов до 100 кг/м³
      auto: { name: 'авто', days: [18, 25], tiers: [[400, 2.4, 2.8], [250, 2.7, 3.1], [150, 3.0, 3.4], [100, 3.3, 3.6]], m3: [300, 360] },
      rail: { name: 'ж/д', days: [25, 35], tiers: [[400, 1.9, 2.3], [250, 2.2, 2.5], [150, 2.4, 2.7], [100, 2.6, 2.9]], m3: [250, 300] },
      air: { name: 'авиа', days: [7, 12], tiers: [[167, 6.5, 7.5], [0, 7.5, 8.5]] }
    };
    var ORIGINS = { gz: ['Гуанчжоу', 0, 0], sz: ['Шэньчжэнь', 0, 0], yw: ['Иу', 0.08, 1], ur: ['Урумчи', -0.25, -5] };
    var DESTS = { msk: ['Москва', 0, 0], spb: ['Санкт-Петербург', 0.15, 2], kzn: ['Казань', 0.08, 1], ekb: ['Екатеринбург', -0.05, -1], nsk: ['Новосибирск', -0.15, -3], krd: ['Краснодар', 0.2, 3] };
    // пошлина, НДС, сертификация ($), наценка карго за сложность категории
    var CATS = {
      clothes: ['Одежда, текстиль, обувь', 0.10, 0.22, 250, 1],
      home: ['Товары для дома', 0.08, 0.22, 200, 1],
      kids: ['Детские товары', 0.10, 0.10, 300, 1.05],
      electronics: ['Электроника, гаджеты', 0.03, 0.22, 350, 1.15],
      auto: ['Автозапчасти', 0.05, 0.22, 250, 1.1],
      build: ['Стройматериалы', 0.07, 0.22, 200, 0.95]
    };
    var BROKER = 180, INSURANCE = 0.02, WHITE_LOGISTICS = 0.72;
    var v = function (id) { return parseFloat(($('#' + id).value || '').replace(',', '.')) || 0; };
    var radio = function (name) { return $('input[name=' + name + ']:checked', calc).value; };
    var amt = function (n) { return n < 10 ? n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmtNum(n); };
    var money = function (lo, hi) { return amt(lo) === amt(hi) ? '$ ' + amt(lo) : '$ ' + amt(lo) + ' – ' + amt(hi); };

    function compute() {
      var mode = radio('mode'), clr = radio('clr'), m = MODES[mode];
      var o = ORIGINS[$('#c-from').value], d = DESTS[$('#c-to').value], cat = CATS[$('#c-cat').value];
      var kg = v('c-kg'), m3 = v('c-m3'), units = Math.max(1, Math.round(v('c-units'))), val = v('c-val');
      var out = $('#calc-out');
      if (kg <= 0 || m3 <= 0) { $('#r-sum').textContent = 'Укажите вес и объём'; out.hidden = true; return; }
      out.hidden = false;
      var den = kg / m3, lo, hi, chargeKg = kg;
      if (mode === 'air') { chargeKg = Math.max(kg, m3 * 167); var t = chargeKg === kg ? m.tiers[0] : m.tiers[1]; lo = chargeKg * t[1]; hi = chargeKg * t[2]; }
      else if (den < 100) { lo = m3 * m.m3[0]; hi = m3 * m.m3[1]; }
      else { var tier = m.tiers.find(function (x) { return den >= x[0]; }); lo = kg * tier[1]; hi = kg * tier[2]; }
      var adj = (mode === 'air' ? 0 : (o[1] + d[1])) * chargeKg;
      var days = [m.days[0] + o[2] + d[2], m.days[1] + o[2] + d[2]];
      if (mode === 'air') days = [m.days[0] + (d[0] === 'Москва' ? 0 : 1), m.days[1] + (d[0] === 'Москва' ? 0 : 2)];
      var ins = val * INSURANCE, rows = [], tLo, tHi;
      if (clr === 'cargo') {
        var dLo = lo * cat[4] + adj, dHi = hi * cat[4] + adj;
        rows.push(['Доставка карго с таможней', money(dLo, dHi)]);
        rows.push(['Страховка 2% от стоимости товара', money(ins, ins)]);
        tLo = dLo + ins; tHi = dHi + ins;
      } else {
        var lLo = lo * WHITE_LOGISTICS + adj, lHi = hi * WHITE_LOGISTICS + adj;
        var cvLo = val + lLo * 0.5, cvHi = val + lHi * 0.5; // таможенная стоимость: товар + доставка до границы
        var dutyLo = cvLo * cat[1], dutyHi = cvHi * cat[1];
        var vatLo = (cvLo + dutyLo) * cat[2], vatHi = (cvHi + dutyHi) * cat[2];
        rows.push(['Доставка до склада', money(lLo, lHi)]);
        rows.push(['Пошлина ≈ ' + Math.round(cat[1] * 100) + '%', money(dutyLo, dutyHi)]);
        rows.push(['НДС ' + Math.round(cat[2] * 100) + '% (можно принять к вычету)', money(vatLo, vatHi)]);
        rows.push(['Таможенный брокер', money(BROKER, BROKER)]);
        rows.push(['Сертификат или декларация', money(cat[3], cat[3])]);
        rows.push(['Страховка 2%', money(ins, ins)]);
        tLo = lLo + dutyLo + vatLo + BROKER + cat[3] + ins; tHi = lHi + dutyHi + vatHi + BROKER + cat[3] + ins;
      }
      $('#r-sum').textContent = money(tLo, tHi);
      $('#r-unit').innerHTML = 'Доставка на единицу товара: <b>' + money(tLo / units, tHi / units) + '</b>' +
        (val > 0 ? '<br>Себестоимость единицы с товаром: <b>' + money((tLo + val) / units, (tHi + val) / units) + '</b>' : '');
      $('#r-rows').innerHTML = rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') +
        '<div><span>Срок до города ' + d[0] + '</span><b>' + days[0] + '–' + days[1] + ' дн</b></div>' +
        '<div><span>Плотность груза</span><b>' + fmtNum(den) + ' кг/м³</b></div>';
      var until = addDays(new Date(), Number(SITE.priceValidDays || 7));
      $('#r-valid').textContent = 'Цена действует до ' + fmtDate(until) + ' при оформлении заявки.';
      window.__calcSummary = 'Расчёт с сайта: ' + cat[0] + ', ' + kg + ' кг, ' + m3 + ' м³, ' + units + ' шт., ' + o[0] + ' → ' + d[0] + ', ' + m.name +
        ', ' + (clr === 'cargo' ? 'карго' : 'белое оформление') + ', стоимость товара $' + fmtNum(val) + '. Итого ' + money(tLo, tHi) + '.';
    }
    calc.addEventListener('input', compute);
    calc.addEventListener('change', compute);
    calc.addEventListener('submit', function (e) { e.preventDefault(); });
    compute();
  }

  /* ---------- Отслеживание груза ---------- */
  var tform = $('#track-form');
  if (tform) {
    var DEMO = 'ЧП-48213';
    var norm = function (s) { var d = s.replace(/\D/g, ''); return d ? 'ЧП-' + d : ''; };
    function demoData() {
      var t = new Date(); t.setHours(0, 0, 0, 0);
      return {
        number: DEMO, status: 'Пересекает границу', eta: addDays(t, 8),
        cargo: 'Одежда, 38 мест, 1 240 кг, авто',
        events: [
          ['Принят на складе в Гуанчжоу', 'Пересчёт, фото 38 мест', addDays(t, -11), 'done'],
          ['Проверка и упаковка', 'Брака не найдено, мешок + скотч с логотипом', addDays(t, -10), 'done'],
          ['Отправлен из Гуанчжоу', 'Консолидация в Урумчи', addDays(t, -9), 'done'],
          ['Погранпереход Хоргос', 'Таможенное оформление', addDays(t, -1), 'now'],
          ['Склад в Москве', 'Уведомим в Telegram в день прибытия', addDays(t, 8), '']
        ]
      };
    }
    function render(data) {
      var res = $('#track-res');
      res.hidden = false;
      if (!data) {
        res.innerHTML = '<p class="err">Груз с таким номером не найден. Номер вида ЧП-12345 приходит от менеджера после приёмки на складе в Китае. Проверьте номер или напишите нам.</p>';
        return;
      }
      res.innerHTML = '<div class="track-head"><div><span class="muted">Груз</span><br><b>' + data.number + '</b></div><span class="pill">' + data.status + '</span></div>' +
        '<p class="muted" style="margin-bottom:20px">' + data.cargo + '. Ожидаемая дата прибытия: <b style="color:var(--ink)">' + fmtDate(new Date(data.eta)) + '</b></p>' +
        '<ol class="tline">' + data.events.map(function (e) {
          return '<li class="' + e[3] + '"><span class="pin"></span><div><b>' + e[0] + '</b><span>' + e[1] + '</span></div><span class="d">' + fmtDate(new Date(e[2])) + '</span></li>';
        }).join('') + '</ol>';
    }
    tform.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = norm($('#t-num').value);
      if (!n) { $('#t-num').focus(); return; }
      if (SITE.trackEndpoint) {
        fetch(SITE.trackEndpoint + '?n=' + encodeURIComponent(n)).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { render(d && d.number ? d : null); }).catch(function () { render(null); });
      } else {
        render(n === DEMO ? demoData() : null);
      }
    });
    var qn = new URLSearchParams(location.search).get('n');
    if (qn) { $('#t-num').value = qn; tform.requestSubmit ? tform.requestSubmit() : tform.dispatchEvent(new Event('submit')); }
  }
})();
