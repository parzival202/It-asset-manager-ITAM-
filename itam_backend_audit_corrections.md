# IT Asset Manager — Backend Corrections

## Files to patch

### pages/api/users/index.js
- Import `initDb, seedDb`
- Run before `getDb()`
- Wrap logic in try/catch
- Return clear JSON errors

```js
import { getDb, initDb, seedDb } from '../../../lib/db';
...
await initDb();
await seedDb();
const db = getDb();
```

### pages/api/users/[id].js
- Same initialization pattern
- Validate numeric id
- Catch duplicate email errors

### pages/api/assets/index.js
- Add try/catch around POST
- Detect duplicate `asset_tag`
- Normalize empty strings to null

### pages/api/assets/[id].js
- Same validation + robust update/delete responses

### pages/api/maintenances/*
- Ensure `initDb()` and `seedDb()` always called.

### pages/api/alerts/*
- Ensure DB init before queries.

## Global hardening

1. Add helper `apiError(res, code, message)`.
2. Log server errors with `console.error(err)`.
3. Always return JSON.
4. Validate required fields.
5. Handle expired token with 401.

## Test checklist

- Login admin works
- Create user works
- Create asset works
- Duplicate asset_tag returns 409
- Duplicate email returns 409
- Technician cannot create users
- GET lists return data

