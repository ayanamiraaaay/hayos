/**
 * Cloudflare Worker: принимает заявки с сайта и пересылает их в Telegram менеджеру.
 *
 * Зачем отдельный сервер: токен Telegram-бота нельзя класть в код сайта —
 * его увидит любой посетитель и сможет писать от имени бота. Токен хранится
 * здесь, в секретах Cloudflare, а сайт отправляет заявку на адрес этого воркера.
 *
 * Настройка (бесплатный тариф Cloudflare Workers):
 *   1. Создайте бота у @BotFather, получите токен.
 *   2. Напишите боту, затем узнайте chat_id через https://api.telegram.org/bot<TOKEN>/getUpdates
 *   3. В Cloudflare: Workers → Create → вставьте этот файл.
 *   4. Settings → Variables: секреты TELEGRAM_TOKEN и TELEGRAM_CHAT_ID,
 *      переменная ALLOWED_ORIGIN = https://ayanamiraaaay.github.io
 *   5. Адрес воркера впишите в src/config.json → leadEndpoint и пересоберите сайт.
 */
const MAX_BODY = 4000;
const TYPES = { lead: 'Заявка на расчёт', checklist: 'Запрос чек-листа' };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403, headers: cors });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response('Too large', { status: 413, headers: cors });
    let data;
    try { data = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

    const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
    const contact = clean(data.contact, 60);
    if (contact.replace(/\D/g, '').length < 10 && !/^@?[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(contact)) {
      return new Response('Bad contact', { status: 422, headers: cors });
    }
    const utm = data.utm && typeof data.utm === 'object'
      ? Object.entries(data.utm).map(([k, v]) => `${clean(k, 20)}=${clean(v, 60)}`).join(', ')
      : '';
    // Обычный текст без parse_mode: так пользователь не сможет подсунуть разметку в сообщение
    const text = [
      TYPES[data.type] || 'Заявка',
      `Имя: ${clean(data.name, 80) || '—'}`,
      `Контакт: ${contact}`,
      `Комментарий: ${clean(data.comment, 1000) || '—'}`,
      `Страница: ${clean(data.page, 120)}`,
      utm ? `UTM: ${utm}` : '',
    ].filter(Boolean).join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
    return new Response(tg.ok ? 'ok' : 'telegram error', { status: tg.ok ? 200 : 502, headers: cors });
  },
};
