# Collection boundaries

Admins can define service areas such as Colombo North or Colombo South in **Zones & Routes → Zones → Add/Edit zone**. These are collection boundaries, not automatically inferred official city borders.

1. Name the zone to locate the map, or use its existing center.
   To start with published geography, choose **Browse Sri Lankan administrative areas**, select a district and DS/GN level, then search a name or area code. Select a result to preview it and choose **Use as a starting outline** to apply it to the draft. This does not save a zone or modify existing service coverage.
2. Choose **Draw area**, tap at least three corners, then **Finish outline**. Drag corners to adjust them; **Edit corners** reopens a simple saved outline.
3. Alternatively import/paste a GeoJSON Polygon, MultiPolygon, Feature, or single-feature FeatureCollection. Import one collection area at a time. Holes and separated areas are supported. GeoJSON positions use `[longitude, latitude]`.
4. Choose collection days and collector as before, then save the zone. Finishing the outline alone does not publish it.
   For an administrative outline, confirm that you checked the shape against the council's collection coverage. The API rejects unconfirmed references as well as outside pickup pins. Editing an imported outline clears the confirmation and records that the source was adjusted; removing it clears its lineage.

The landing map, admin overview and web/Flutter collector maps display saved green outlines and can frame the area. Resident pin pickers select a zone automatically only when exactly one saved boundary matches. Overlapping areas require a choice. Outside pins turn red; web submission and Flutter confirmation reject them, and the API validates create/edit pins too. Editing a pickup retains its original zone.

Zones without boundaries remain usable with center pins. Address-only bookings remain supported. A zone center does not imply an area radius. Outer edges are included; hole edges are excluded. Boundary changes do not retroactively relocate existing bookings.

## Storage and rollout

`Zone.BoundaryGeoJson` is nullable, with a 64 KB / 1,000-position limit, up to 20 polygons and 20 rings per polygon. Import validation rejects open, flat, crossing, out-of-range and invalid hole rings. Antimeridian-crossing areas are unsupported. A map anchor is derived when needed; camera fitting uses the complete outline.

Migration `20261005090427_AddZoneBoundaries` adds only the nullable Zones column. It was applied to the database configured for this workspace. Deploy the API with the migration before expecting deployed web/mobile clients to load or enforce boundaries. No official borders or demo polygons were written into existing zones.

Migration `20261005124839_AddZoneBoundaryReferences` adds nullable source-reference and review timestamp columns and was also applied to the configured database. Admin responses retain the dataset ID, area code/name, level and adjustment flag. The review timestamp records the admin's coverage confirmation, not government approval. Anonymous and resident responses expose only collection geometry; Flutter uses the same saved geometry without bundling the nationwide catalogue.

## Administrative reference data

The bundled starting outlines come from the [Survey Department dataset published by UN OCHA / HDX](https://data.humdata.org/dataset/cod-ab-lka), COD-AB v03, CC BY-IGO. Boundaries were created 2022-08-02 and the dataset reviewed 2025-10-30. Downloaded 2026-10-05. These are administrative divisions, not verified cleaning districts, council wards, city limits or truck rounds.

The picker includes 332 compatible DS outlines and 14,036 GN outlines across all 25 districts. Fourteen source areas were excluded rather than repaired or substituted; their codes are listed in `frontend/public/data/sri-lanka-boundaries/manifest.json`. Shapely performs topology-preserving simplification starting at 0.0002 degrees (about 22 metres of latitude), increasing where needed; coordinates are rounded to six decimals. This modified planning copy is unsuitable for legal or cadastral decisions. Search includes English/Sinhala/Tamil names where the source supplies them, DS names and area codes.

The outline files are about 20 MB, so they are not in the repository. They are served from the public `boundary-data` bucket in Supabase Storage (`sri-lanka-boundaries/`); `VITE_BOUNDARY_DATA_URL` can point the web app somewhere else. After regenerating them, run `python scripts/upload_boundaries.py` to replace the hosted copies. Only `manifest.json` and the README are kept in `frontend/public/data/sri-lanka-boundaries/`, and a few areas are kept in `test-data/sri-lanka-areas-sample.json` for the tests.

District GN files load on demand; the national DS file loads only when requested. Successful requests are cached in memory and failed requests can be retried. No resident coordinates are sent to a third-party boundary lookup service. The manifest records provenance, dates, license, original file checksums and exclusions. Regenerate with `scripts/prepare_sri_lanka_boundaries.py`, validate every outline with `node frontend/scripts/checkBoundaryData.mjs`, and retain source attribution when distributing the modified files.

[Colombo Municipal Council's collection information](https://www.colombo.mc.gov.lk/garbage-collection.php) lists collection districts, wards and roads. It is linked as a review aid; its website does not provide a verified nationwide collection polygon feed. Admins must check current council coverage before making an imported outline operational. Existing zones were not automatically assigned administrative borders.

## Checks and previews

- Web: `http://127.0.0.1:5173/?preview=map` — draft editor, illustrative area, sample collector stops and resident pin picker; no API writes.
- Flutter: `http://127.0.0.1:5187/?preview=ui-audit&page=location` and `page=collector-map` — debug sample API that rejects writes.
- Sidebar: `http://127.0.0.1:5173/?preview=sidebar` — real sidebar component with local navigation and logout disabled. These web preview entry points are excluded from production.
- Shared geometry cases live in `test-data/zone-boundaries.json`, checked by .NET, JavaScript and Dart. They cover holes, edge/vertex policy and multiple polygons. Service tests verify storage, anonymous/selectable DTOs and rejection before saving outside pins. Flutter flow tests cover a real map tap, automatic zone selection and confirmation.
- Frontend tests/build, backend validation/service/in-memory API tests, Flutter analysis/tests and desktop/phone previews were checked. Existing ESLint errors remain in the unchanged effect/purity code in `RoutesPage.jsx` and `PickupsPage.jsx`; new map modules lint cleanly.

Real admin save/refresh verification requires signing in. The initial debug outline is illustrative; the administrative picker can replace the draft with published reference geography. The read-only preview never persists it. `test-data/sri-lanka-boundary-sample.json` checks a real Malabe North outline against the API, JavaScript and Dart containment rules.

2026-10-05 reference-picker checks: all 14,368 catalogue outlines passed JS import validation; 33 frontend tests, production build and new-module lint passed; 114 backend validation/service tests and 12 targeted Flutter geometry/pin-flow tests passed. Desktop and 390 px previews verified Malabe, Nittambuwa and Dehiwala searches, cancel/apply, geometry fitting and confirmation reset. The final live API read was blocked by Supabase's `EMAXCONNSESSION` session limit (pool size 15); signed-in admin save/refresh was not verified. No existing zone coverage was changed.
