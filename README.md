# sheet2ccip-announcement

A Cloudflare Worker that turns a Google Sheet into a scheduled announcement API. Rows become visible only once their `publishTime` has passed, so you can stage announcements ahead of time directly from a spreadsheet.

## How it works

1. The Worker fetches your sheet via Google's `gviz` CSV export endpoint.
2. Each row's `publishTime` (Taipei time, AM/PM Chinese format) is parsed into a Unix timestamp.
3. Rows whose timestamp is `<=` the current time are returned; future rows are hidden.
4. Results are cached in-memory for `CACHE_TTL_MS` to avoid hammering the sheet.

## Spreadsheet format

The sheet **must** have these columns as the header row:

| Column        | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `msgEn`       | Announcement message in English.                                            |
| `msgZh`       | Announcement message in Chinese.                                            |
| `uri`         | Link associated with the announcement (optional).                           |
| `publishTime` | When the row becomes visible. Format: `YYYY/M/D 上午/下午 H:MM:SS` (Asia/Taipei). |

Example `publishTime` values:

```
2026/5/16 上午 9:30:00
2026/5/16 下午 11:05:00
```

This is the default format produced by Google Sheets when a cell is formatted as date-time with the locale set to Traditional Chinese (Taiwan).

The sheet must be published / shared so that "anyone with the link can view" — the Worker fetches it anonymously.

## Endpoints

### `GET /announcement`

Returns a JSON array of currently-visible rows. Each row includes the original sheet columns plus a `datetime` field (Unix seconds parsed from `publishTime`).

```json
[
  {
    "msgEn": "Maintenance window tonight",
    "msgZh": "今晚系統維護",
    "uri": "https://example.com/status",
    "publishTime": "2026/5/16 上午 9:00:00",
    "datetime": 1763254800
  }
]
```

### `GET /healthz`

Returns `{ "ok": true }`.

## Configuration

Set these in [wrangler.toml](wrangler.toml) under `[vars]`, or in `.dev.vars` for local dev:

| Variable        | Required | Default | Description                                              |
| --------------- | -------- | ------- | -------------------------------------------------------- |
| `SHEET_ID`      | yes      | —       | The Google Sheet ID (the long string in the sheet URL).  |
| `SHEET_GID`     | no       | `0`     | The `gid` of the specific tab to read.                   |
| `CACHE_TTL_MS`  | no       | `10000` | How long to cache the sheet in memory, in milliseconds.  |

## Development

```bash
npm install
npm run dev      # wrangler dev — local Worker at http://localhost:8787
```

Hit `http://localhost:8787/announcement` to see the current visible rows.

## Deploy

```bash
npm run deploy   # wrangler deploy
```

## License

MIT
