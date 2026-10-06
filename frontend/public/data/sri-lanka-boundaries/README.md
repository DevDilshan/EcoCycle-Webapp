# Sri Lankan administrative outlines

Source: Survey Department of Sri Lanka, published by UN OCHA / HDX.

Dataset: [Sri Lanka COD-AB v03](https://data.humdata.org/dataset/cod-ab-lka).
License: [Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)](https://data.humdata.org/faqs/licenses).
Attribution, source checksums, dates and excluded area codes are recorded in `manifest.json`.

Source boundaries were created 2022-08-02; the dataset was reviewed 2025-10-30 and downloaded 2026-10-05. These administrative areas are not municipal waste-collection zones. Their dates do not certify that each boundary or collection schedule is current.

Modified for EcoCycle: topology-preserving simplification starting at 0.0002 degrees (about 22 metres of latitude), increasing only when needed for the editor's 1,000-position limit; coordinates rounded to six decimal places. Do not use these outlines for legal or cadastral decisions. Fourteen incompatible areas were omitted rather than repaired or replaced with invented borders.

The picker loads only the chosen district's GN divisions, or the national DS file when requested. No third-party map service credentials are required. To reproduce, extract the HDX GeoJSON ZIP and run `scripts/prepare_sri_lanka_boundaries.py` with Shapely 2.1.2, then run `node frontend/scripts/checkBoundaryData.mjs`.
