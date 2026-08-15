# Makro Seller Portal API — Feasibility Report

**Date:** 2026-08-15
**Source:** Live inspection of `https://seller.makro.co.za` (authenticated session, Flipkart-powered seller platform)
**Seller:** Bonolo Online (sellerId `c81decf9734a482a`)

## Summary

| Capability | Feasible? | Effort | Notes |
|---|---|---|---|
| Pull orders (list/search/export) | ✅ Yes | Low | Direct JSON API + CSV export endpoints |
| List products to Makro catalog | ✅ Yes | Medium | `create-update-listings` API; single + bulk flows |
| Update price/stock on existing listings | ✅ Yes | Low–Medium | Via `create-update-listings` or bulk file upload |
| Read current listings (480 active) | ✅ Yes | Low | `listingsDataForStates` returns full listing data |

## Auth requirements (all API calls)

The portal is a Flipkart seller platform. Every `/napi/...` call needs:

1. **Session cookie** — set automatically after login (browser session).
2. **`FK-CSRF-TOKEN` header** — per-session CSRF token (e.g. `34JhM9cB-Us17lN9frHoxMESRDsmudQjR0c0`). Rotates per session. **Verified: directly readable from `localStorage.__appData.sellerConfig.csrfToken`** — no network capture or fetch-patching needed.
3. **`X-LOCATION-ID` header** — warehouse location id (e.g. `LOC19bc721f48b64671b01861b14799dbf3`). Also in `localStorage.__appData['X-LOCATION-ID']`.
4. **`x-seller-id` header** — `c81decf9734a482a` (some endpoints). In `localStorage.__appData.sellerConfig.sellerId`.
5. **`X-Requested-With: XMLHttpRequest`** — some endpoints.

**Implication:** These APIs are only callable from inside an authenticated browser session (the extension's content script on `seller.makro.co.za`). They are NOT usable from the dashboard's origin (github.io) directly — CORS + CSRF + session cookies block that. The extension (`portal.js`/`content.js`) is the right integration point, exactly like the existing price-upload automation.

## Orders API

Base: `https://seller.makro.co.za/napi/...`

### Pull orders (JSON)
- **`POST /napi/my-orders/fetch?sellerId=<id>`** — paginated order list.
  Body:
  ```json
  {
    "status": "shipments_to_pack",
    "payload": {
      "pagination": {"page_num": 1, "page_size": 10},
      "params": {"seller_id": "c81decf9734a482a", "dispatch_after_date": {"to": "2026-08-15T05:07:35.000+05:30"}},
      "sort": [{"field": "dispatch_by_date", "order": "asc"}, {"field": "dispatch_service_tier", "order": "asc"}, {"field": "product.id", "order": "asc"}]
    },
    "sellerId": "c81decf9734a482a"
  }
  ```
  Response: `{has_more, items: [{id, service_profile, payment_type, dispatch_after_date, dispatch_by_date, dispatch_service_tier, order_items: [{order_item_id, order_id, listing_id, fsn, sku, order_date, status, quantity, pricing: {total_price, list_price, ...}, product_details: {title, vertical, product_image, ...}}], buyer: {shipping_address: {...}}, shipment_history: {created, approved, packed, rtd, picked, delivered}, sub_shipments: [...]}]}`
  - **FSN + SKU + order_id + quantity + price + buyer address + shipment status** all present. Perfect for dashboard order tracking.
  - **Note:** the top-level `id` is an internal UUID; the real order ID is `order_items[0].order_id` (e.g. `OD438358462535473100`; older orders use `MAK...`).
  - **Per-status `params` (verified against the portal's own fetch builders in `orders.814ec4c734db2cd7e876.js`):**
    | status | params |
    |---|---|
    | `shipments_to_pack` / `shipments_processing_orders` | `{dispatch_after_date: {to: <now>}}` |
    | `shipments_in_transit` | `{status: {picked_up: "true", dispatched: "true", shipped: "true"}}` — **without this it returns 0 items** |
    | `shipments_delivered` | no default date |
    | `shipments_upcoming` | `{on_hold: true, upcoming: true, dispatch_after_date: {from: <now>}}` — uses `from`, NOT `to` (a `to` date 400s) |
- **`GET /napi/my-orders/state-counts?state=seller_easyship&serviceProfile=seller-fulfilled&sellerId=<id>`** — counts per state (Order Processing, Pending Labels, Dispatched, In Transit, Completed, Upcoming).
- **`POST /napi/my-orders/search`** — search orders.
- **`GET /napi/my-orders/getSortedShipments`** — sorted shipments.
- **`POST /napi/orders/search`**, **`GET /napi/orders/histories`** — order search/history.
- **`POST /napi/cancelled_orders/fetchV2`** — cancelled orders.

### Export orders (CSV)
- **`GET /napi/my-orders/download-bulk-orders`** — bulk orders download.
- **`GET /napi/orders/download_csv_v3`** — CSV export.
- **`GET /napi/cancelled_orders/downloadCSV`** — cancelled orders CSV.
- **`GET /napi/fulfilment-rest/historical_orders/download?flowType=FORWARD`** — historical orders (this is what "View orders from old portal" triggers).
- **`GET /napi/orders/download_upcoming_report`** — upcoming orders report.

## Listings API

### Read listings
- **`POST /napi/listing/listingsDataForStates`** — paginated listing list.
  Body:
  ```json
  {
    "search_text": "",
    "search_filters": {"internal_state": "ACTIVE"},
    "column": {"sort": {"column_name": "demand_weight", "sort_by": "DESC"}, "pagination": {"batch_no": 0, "batch_size": 30}}
  }
  ```
  Response: `{count: 480, listing_data_response: [{sku_id, listing_id, vertical, product_id, service_profile, ssp (selling price), mrp, brand, title, imageUrl, url, packages, hsn, ...}]}`
  - **This is the same data as the S_listing export** — the dashboard could pull it directly instead of requiring the XLS upload.
  - **Only `ACTIVE` is pulled** (seller works with active products only). `INACTIVE` works (1955) but is unused; `BLOCKED` 400s on this endpoint (`"Please specify a valid payload"` — not a valid `internal_state` value).
- **`POST /napi/listing/listingsStockCount`** — stock counts for a batch of listing_ids. **Body is a JSON ARRAY** of `{listing_id, service_profile}` (e.g. `[{listing_id: "LST...", service_profile: "NON_FBF"}]`); response is `{listing_id: {NON_FBF: [{quantity, reserved, locationId}]}}`. No stock field exists on the listing items themselves.
- **`GET /napi/listing/listingsStateViewTemplate?search_filter=&context=ACTIVE`** — column template.
- **`POST /napi/listing/listingsFilterValues`** — filter options (vertical, brand, ssp, service_profile).
- **`GET /napi/listing/stockFileDownloadNUploadHistory`** — upload/download history.
- **`GET /napi/listing/stockFileDownloadRequestStatus`** — status of a requested file export (the "Request Download → Listing File" flow polls this).

### Create / update listings
- **`POST /napi/listing/create-update-listings`** — create or update a listing (price, stock, attributes).
- **`GET /napi/listing/get-listings-info-by-id`** — fetch existing listing attribute values.
- **`GET /napi/listing/entityDefinition?entity_type=LISTING&vertical=<v>&fsn=<fsn>&seller_id=<id>&version=2&context=DEFAULT&client_id=sd`** — schema of required attributes for a vertical+FSN.
- **`GET /napi/createProductV2/verticalDefinitionV2?verticals=<list>&context=VERTICAL_PROP`** — vertical definitions.
- **`GET /napi/listing/top-verticals?marketplace=FLIPKART&sellerId=<id>`**, **`GET /napi/listing/your-verticals?...`** — vertical lists for the Add Listing wizard.
- **`GET /napi/listing/frequently-used-vertical?requestType=SINGLE_LINE_ITEM|FEED&marketplace=FLIPKART`** — frequently used verticals.

### Add Listing flows (UI)
- Single: `#dashboard/addListings/single` — Select Vertical → Select Brand → Add Product Info → submit via `create-update-listings`.
- Bulk: `#dashboard/addListings/bulk` — same wizard, `requestType=FEED`, then file upload.

### ⭐ Latch-on flow (list against existing Makro catalog offer) — CONFIRMED
This is the flow for products **already on the Makro catalog** (you have the FSN):
1. **Listings tab → Add New Listings → "Create listings using products available on Makro"** (`#dashboard/listingsInProgress`).
2. Paste the **FSN** in "Search by Brand, FSN, Product URL" → click search icon.
3. The exact catalog product appears with its attributes (title, brand, model, colour, dimensions) — pulled from the Makro catalog, no attribute entry needed.
4. If you already sell it → **"ALREADY SELLING"** (blocked, cannot re-add).
5. If you don't sell it → **"START SELLING"** button opens the Selling Information form:
   - **SKU ID** (required, your own SKU)
   - Listing Status (Active/Inactive)
   - **Base Price** (required)
   - **Your selling price** (required)
   - Min/Max Order Qty (optional)
   - Fulfilment (FBS/FBM, required)
   - Pick Pack SLA (required)
   - Package dimensions L/B/H/W (required)
   - Selling region preference (optional)
6. Submit → **`POST napi/listing/create-update-listings`** with:
   - Body: `{bulkRequests: [{attributeValues: {sku_id, mrp, flipkart_selling_price, ...}, context: {ignore_warnings: false}, productId: <FSN>, skuId: <SKU>, packages: [...]}]}`
   - Header: `sourceid: "ui.latch-on"`
   - Response: `{result: {status: "success", bulkResponse: [{skuID}]}}`

**Verified live (2026-08-15):** FSN `INTH9MBJ2YZFQJYY` → "Inksaver Compatible HP 951XL Yellow Ink Cartridge" → START SELLING form shown. FSN `PRNH5UGWZEJAZDCA` (already selling) → "ALREADY SELLING" block confirmed.

**Automation implication:** The dashboard can generate the exact payload (FSN + SKU + prices from cost engine) and the extension can submit it via this API — no UI file-upload needed. This is the cleanest "list to catalog" path.

## Integration options for the dashboard

### Option A — Extension pulls orders (recommended first step)
Extend the existing Chrome extension (`portal.js`/`content.js`) to:
1. On `seller.makro.co.za`, capture `FK-CSRF-TOKEN`, `X-LOCATION-ID`, sellerId from the page.
2. Call `napi/my-orders/fetch` (paginated) + `napi/my-orders/state-counts`.
3. Post results to the dashboard via `postMessage` (same pattern as the existing scrape pipeline: `START_QUEUE` → `QUEUE_PROGRESS`).
4. Dashboard renders an "Orders" panel: order id, FSN, SKU, qty, price, status, buyer, dispatch dates.

### Option B — Extension pulls listings (replaces XLS upload)
Same mechanism with `napi/listing/listingsDataForStates` — the dashboard gets live listing data (price, stock, status) without the manual S_listing export/upload cycle. Could auto-sync on load.

### Option C — Push price/stock updates via API
Replace the fragile UI file-upload automation with direct `create-update-listings` calls (or the bulk upload endpoint). More robust, but needs the exact attribute payload shape — requires inspecting one real update request (can be captured during a manual price edit).

### Option D — Create new listings from dashboard
Full "list to catalog" flow: dashboard picks vertical → brand → FSN (search catalog) → fills attributes → `create-update-listings`. Highest effort; needs the entityDefinition schema per vertical.

## Constraints / risks
- **Session-bound:** all calls need a live logged-in session in the extension's browser context. If the session expires, the extension must detect it and prompt re-login.
- **CSRF token rotation:** token must be captured fresh per session — read `localStorage.__appData.sellerConfig.csrfToken` (verified present on every logged-in session).
- **No public API:** there is no documented public API; this is reverse-engineered from the web app. Endpoints may change without notice.
- **Rate limits:** unknown; keep pagination modest (page_size 10–30) and add delays.
- **Read-only first:** Option A/B are read-only and safe. Options C/D mutate the live portal — only build after user confirms.

## Verified live data (2026-08-15)
- 480 Active Listings (only ACTIVE is pulled; INACTIVE 1955 / BLOCKED 16 exist but are unused).
- Orders (state-counts): 1 Upcoming, 0 Processing, 2 Pending Labels, 7 In Transit, 84 Completed.
- Example order: Brother MFC-L3760CDW (FSN `PRNH5UGWZEJAZDCA`, SKU `MFC-L3760CDW-C1`, qty 1, R7,493, buyer in Ladybrand, Free State).
- Example listing: Canon G41 ink (SKU `GI-41 (BK/C/M/Y/)`, listing `LSTINTH4CZ4JYMVGQPEERDB22`, SSP R967, MRP R1,199).
- Latch-on flow confirmed: FSN `INTH9MBJ2YZFQJYY` (Inksaver HP 951XL Yellow) → START SELLING form; FSN `PRNH5UGWZEJAZDCA` → ALREADY SELLING block.