# Receipt Export API

Admin-only receipt export endpoints:

- `GET /api/admin/receipts/export`
- `GET /api/admin/receipts/summary`

Both endpoints require an authenticated `ADMIN` role.

## Export Endpoint

`GET /api/admin/receipts/export?format=csv|json&start=YYYY-MM-DD&end=YYYY-MM-DD&status=APPROVED,FLAGGED,REJECTED,PENDING&minRisk=0&maxRisk=100&vendor=...&userId=...&deliveryRequestId=...`

### Query Params

- `format`: `csv` or `json` (default `csv`)
- `start`, `end`: UTC day range in `YYYY-MM-DD` (default last 30 days)
- `status`: comma-separated statuses
- `minRisk`, `maxRisk`: integer range `0..100`
- `vendor`: case-insensitive partial match against merchant/expected/request vendors
- `userId`: receipt uploader user id
- `deliveryRequestId`: exact delivery request id
- `limit`: max rows for non-paginated export (default `10000`, max `10000`)
- `includeHash=1`: include `imageHash` column/field

JSON-only:

- `cursor`: pagination cursor (receipt verification id)
- `take`: page size for cursor pagination (default `500`, max `1000`)
- `nested=1`: returns `{ receipt, deliveryRequest }` objects
- `includeRaw=1`: includes `rawResponse` in JSON payload

### Examples

- CSV, last 30 days:  
  `/api/admin/receipts/export`
- CSV, flagged/rejected only with risk floor:  
  `/api/admin/receipts/export?format=csv&status=FLAGGED,REJECTED&minRisk=40`
- JSON, nested shape, cursor paging:  
  `/api/admin/receipts/export?format=json&nested=1&take=250&cursor=ckxyz...`
- JSON including Veryfi raw payload:  
  `/api/admin/receipts/export?format=json&includeRaw=1&deliveryRequestId=...`

## Summary Endpoint

`GET /api/admin/receipts/summary?start=YYYY-MM-DD&end=YYYY-MM-DD`

Returns:

- counts by status
- average `riskScore`
- `topVendorsFlagged`
- `mismatchRate` and `mismatchRatePercent`
- `duplicatesCount`
- `veryfiErrorCount`

### Example

- `/api/admin/receipts/summary?start=2026-01-01&end=2026-01-31`
