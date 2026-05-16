import { parse } from 'csv-parse/sync';

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function parsePublishTime(s) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, ampm, h, mi, se] = m;
  let hour = Number(h) % 12;
  if (ampm === '下午') hour += 12;
  return (Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(mi), Number(se)) - TZ_OFFSET_MS)/1000;
}

let cache = { at: 0, data: null };

async function loadSheet(env) {
  const ttl = Number(env.CACHE_TTL_MS ?? 10000);
  const now = Date.now();
  if (cache.data && now - cache.at < ttl) return cache.data;

  const url = `https://docs.google.com/spreadsheets/d/${env.SHEET_ID}/gviz/tq?tqx=out:csv&gid=${env.SHEET_GID ?? '0'}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);

  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const data = rows.map(row => {
    if (row.publishTime) {
      const ts = parsePublishTime(row.publishTime);
      if (ts !== null) row.datetime = ts;
    }
    return row;
  });

  cache = { at: now, data };
  return data;
}

export default {
  async fetch(request, env) {
    if (!env.SHEET_ID) {
      return Response.json({ error: 'Missing SHEET_ID' }, { status: 500 });
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/healthz') {
      return Response.json({ ok: true });
    }

    if (pathname === '/announcement') {
      try {
        const data = await loadSheet(env);
        const now = Date.now();
        const visible = data.filter(
          row => row.datetime <= now/1000,
        );
        return Response.json(visible);
      } catch (err) {
        console.error(err);
        return Response.json({ error: 'Failed to load sheet' }, { status: 502 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
