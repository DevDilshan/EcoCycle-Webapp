"""Prepare the openly licensed HDX COD-AB v03 GeoJSON download for the admin picker.

Usage: python scripts/prepare_sri_lanka_boundaries.py INPUT_DIRECTORY OUTPUT_DIRECTORY
Requires Shapely 2.1.2. Input files: lka_admin3.geojson and lka_admin4.geojson.
Never repair invalid source geometry or infer collection coverage from these borders.
"""
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def compact_coordinates(value):
    return [round(v, 6) if isinstance(v, (int, float)) else compact_coordinates(v) for v in value]


def prepare(input_dir, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    excluded = []
    hashes = {}
    districts = {}
    counts = {}
    for level in (3, 4):
        source_file = input_dir / f"lka_admin{level}.geojson"
        hashes[source_file.name] = hashlib.sha256(source_file.read_bytes()).hexdigest()
        source = json.loads(source_file.read_text(encoding="utf-8-sig"))
        batches = defaultdict(list)
        for feature in source["features"]:
            p = feature["properties"]
            if p.get("version") != "v03" or p.get("valid_on") != "2022-08-16":
                raise ValueError("Unexpected source version/date. Review the manifest attribution before converting a new dataset.")
            code = p[f"adm{level}_pcode"]
            original = shape(feature["geometry"])
            if not original.is_valid:
                excluded.append({"code": code, "reason": "Invalid source geometry"})
                continue
            # About 22 m in latitude; explicitly marked as simplified planning data.
            tolerance = 0.0002
            while True:
                simplified = original.simplify(tolerance, preserve_topology=True)
                geometry = json.loads(json.dumps(mapping(simplified)))
                geometry["coordinates"] = compact_coordinates(geometry["coordinates"])
                polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
                positions = sum(len(ring) for polygon in polygons for ring in polygon)
                if positions <= 1000 and len(json.dumps(geometry, separators=(",", ":"))) <= 64000:
                    break
                tolerance *= 1.5
                if tolerance > 0.002:
                    break
            if not shape(geometry).is_valid or positions > 1000 or len(json.dumps(geometry, separators=(",", ":"))) > 64000 or len(polygons) > 20 or any(len(polygon) > 20 for polygon in polygons):
                excluded.append({"code": code, "reason": "Exceeds collection editor geometry limits"})
                continue
            district_code = p["adm2_pcode"]
            districts[district_code] = {"code": district_code, "name": p["adm2_name"]}
            batches["ds" if level == 3 else district_code].append({
                "type": "Feature", "geometry": geometry,
                "properties": {"code": code, "name": p[f"adm{level}_name"] or f"Unnamed area ({code})", "level": level,
                    "district": p["adm2_name"], "districtCode": district_code,
                    "division": p["adm3_name"], "divisionCode": p["adm3_pcode"],
                    "nameSi": p.get(f"adm{level}_name1"), "nameTa": p.get(f"adm{level}_name2"),
                    "simplificationToleranceDegrees": tolerance}
            })
        counts[str(level)] = sum(map(len, batches.values()))
        for key, features in batches.items():
            features.sort(key=lambda f: (f["properties"]["name"].lower(), f["properties"]["code"]))
            dump(output_dir / f"{key}.geojson", {"type": "FeatureCollection", "features": features})
    dump(output_dir / "manifest.json", {
        "datasetId": "lka-cod-ab-v03", "title": "Sri Lanka COD-AB v03",
        "source": "Survey Department of Sri Lanka", "publisher": "UN OCHA / HDX",
        "sourceUrl": "https://data.humdata.org/dataset/cod-ab-lka",
        "license": "CC BY-IGO", "licenseUrl": "https://data.humdata.org/faqs/licenses",
        "boundaryDate": "2022-08-02", "reviewDate": "2025-10-30", "retrievedDate": "2026-10-05",
        "sourceSha256": hashes, "counts": counts, "excluded": excluded,
        "districts": sorted(districts.values(), key=lambda d: d["name"]),
        "notice": "Simplified administrative outlines for planning. Collection coverage requires council review."
    })
    print(json.dumps({"counts": counts, "excluded": len(excluded)}))


if __name__ == "__main__":
    prepare(Path(sys.argv[1]), Path(sys.argv[2]))
