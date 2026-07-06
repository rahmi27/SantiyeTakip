from __future__ import annotations

import json
import re
from collections import deque
from pathlib import Path

import openpyxl
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_XLSX = ROOT / "source" / "teklif.xlsx"
SOURCE_PDF = ROOT / "source" / "TBS-2.pdf"
MAP_IMAGE = ROOT / "public" / "assets" / "site-map.png"
COORDINATE_MAP_IMAGE = ROOT / "public" / "assets" / "site-map-coordinate.png"
OUTPUT_JSON = ROOT / "src" / "data" / "siteData.json"
LABEL_ASSIGN_MAX_DISTANCE = 120


def slugify(value: str) -> str:
    table = str.maketrans(
        "çğıöşüÇĞİÖŞÜı",
        "cgiosuCGIOSUi",
    )
    value = str(value).translate(table).lower()
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value or "is_kalemi"


def as_number(value):
    if value in (None, ""):
        return 0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


WORK_CATEGORY_BY_KEY = {
    "grup_sayisi": "sihhi",
    "dalgic_pompa": "sihhi",
    "yag_tutucu": "sihhi",
    "vrf_drenaj": "sihhi",
    "ara_istasyon": "sihhi",
    "karot_deligi": "sihhi",
    "petek": "isitma",
    "kollektor": "isitma",
    "sprink": "yangin",
    "yangin_dolabi": "yangin",
    "i_b_a": "yangin",
}

CATEGORY_WEIGHTS = {
    "sihhi": 34,
    "isitma": 33,
    "yangin": 33,
}


def work_category(key: str) -> str:
    return WORK_CATEGORY_BY_KEY.get(key, "sihhi")


def building_code_terms(code: str) -> list[str]:
    code = code.strip()
    terms = []
    match = re.fullmatch(r"([A-Z]\d{2})\s+([A-Z](?:-[A-Z])*)", code)
    if match:
        base, letters = match.groups()
        terms.extend(f"{base}{letter}" for letter in letters.split("-"))
    terms.append(code)
    return list(dict.fromkeys(terms))


def read_buildings():
    wb = openpyxl.load_workbook(SOURCE_XLSX, data_only=True, read_only=True)
    ws = wb.worksheets[0]

    header_rows = []
    for row_index in (1, 2):
        row = []
        for column_index in range(1, ws.max_column + 1):
            row.append(ws.cell(row_index, column_index).value)
        header_rows.append(row)

    work_columns = []
    for column_index in range(6, min(ws.max_column, 26) + 1):
        raw_name = header_rows[1][column_index - 1] or header_rows[0][column_index - 1]
        if not raw_name:
            continue
        label = str(raw_name).replace("\n", " ").strip()
        key = slugify(label)
        work_columns.append((column_index, key, label))

    work_items_by_key = {}
    buildings = []

    for row_index in range(3, ws.max_row + 1):
        code = ws.cell(row_index, 2).value
        name = ws.cell(row_index, 4).value
        if not code or not name:
            continue

        code = str(code).strip()
        works = []
        progress = {}
        for column_index, key, label in work_columns:
            quantity = as_number(ws.cell(row_index, column_index).value)
            if quantity <= 0:
                continue
            works.append({"key": key, "label": label, "quantity": quantity, "category": work_category(key)})
            progress[key] = 0
            work_items_by_key[key] = label

        category_counts = {}
        for work in works:
            category_counts[work["category"]] = category_counts.get(work["category"], 0) + 1
        for work in works:
            category_weight = CATEGORY_WEIGHTS.get(work["category"], 0)
            work["weight"] = round(category_weight / max(1, category_counts.get(work["category"], 1)))

        buildings.append(
            {
                "id": code,
                "code": code,
                "name": str(name).strip(),
                "lineColor": str(ws.cell(row_index, 3).value or "BELIRSIZ").strip(),
                "quantity": as_number(ws.cell(row_index, 5).value),
                "works": works,
                "progress": progress,
            }
        )

    work_items = [
        {"key": key, "label": label, "category": work_category(key)}
        for key, label in sorted(work_items_by_key.items())
    ]
    return buildings, work_items


def convex_hull(points):
    points = sorted(set(points))
    if len(points) <= 1:
        return points

    def cross(origin, a, b):
        return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])

    lower = []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)

    upper = []
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)

    return lower[:-1] + upper[:-1]


def distance_to_box(x, y, box):
    min_x, min_y, max_x, max_y = box
    dx = max(min_x - x, 0, x - max_x)
    dy = max(min_y - y, 0, y - max_y)
    return (dx * dx + dy * dy) ** 0.5


def nearest_component(x, y, components):
    best_index = 0
    best_distance = float("inf")
    for index, component in enumerate(components):
        distance = distance_to_box(x, y, component["pixelBox"])
        if distance < best_distance:
            best_distance = distance
            best_index = index
    return best_index, best_distance


def near_components(x, y, components, max_distance=LABEL_ASSIGN_MAX_DISTANCE, limit=10):
    matches = []
    for index, component in enumerate(components):
        distance = distance_to_box(x, y, component["pixelBox"])
        if distance <= max_distance:
            matches.append((distance, -component["area"], index))
    matches.sort()
    return [(index, distance) for distance, _, index in matches[:limit]]


def add_pdfium_candidates(candidates, buildings, components, width, height):
    try:
        import pypdfium2 as pdfium
    except ImportError:
        return

    if not SOURCE_PDF.exists():
        return

    pdf = pdfium.PdfDocument(str(SOURCE_PDF))
    page = pdf[0]
    page_width, page_height = page.get_size()
    text_page = page.get_textpage()

    for building in buildings:
        for term in building_code_terms(building["id"]):
            search = text_page.search(term, match_case=True, match_whole_word=False)
            while True:
                hit = search.get_next()
                if hit is None:
                    break
                start, count = hit
                xs = []
                ys = []
                for char_index in range(start, start + count):
                    box = text_page.get_charbox(char_index)
                    xs.extend([box[0], box[2]])
                    ys.extend([box[1], box[3]])
                x = ((min(xs) + max(xs)) / 2) * width / page_width
                y = (page_height - ((min(ys) + max(ys)) / 2)) * height / page_height
                if -50 <= x <= width + 50 and -50 <= y <= height + 50:
                    for component_index, distance in near_components(x, y, components):
                        candidates.setdefault(building["id"], []).append(
                            {
                                "engine": "pdfium",
                                "term": term,
                                "x": x,
                                "y": y,
                                "componentIndex": component_index,
                                "distance": distance,
                            }
                        )


def add_pymupdf_candidates(candidates, buildings, components, width, height):
    try:
        import fitz
    except ImportError:
        return

    if not SOURCE_PDF.exists():
        return

    document = fitz.open(str(SOURCE_PDF))
    page = document[0]
    words_by_text = {}
    for word in page.get_text("words"):
        words_by_text.setdefault(word[4], []).append(word)

    for building in buildings:
        for term in building_code_terms(building["id"]):
            for word in words_by_text.get(term, []):
                x0, y0, x1, y1 = word[:4]
                x = ((x0 + x1) / 2) * width / page.rect.width
                y = ((y0 + y1) / 2) * height / page.rect.height
                if -50 <= x <= width + 50 and -50 <= y <= height + 50:
                    for component_index, distance in near_components(x, y, components):
                        candidates.setdefault(building["id"], []).append(
                            {
                                "engine": "pymupdf",
                                "term": term,
                                "x": x,
                                "y": y,
                                "componentIndex": component_index,
                                "distance": distance,
                            }
                        )


def make_region(component, index, building_id, assignment):
    region = {
        "id": f"PDF-MOR-{index:03d}",
        "shape": component["shape"],
        "points": component["points"],
        "pixelBox": component["pixelBox"],
        "source": assignment,
        "buildingId": building_id,
    }
    return region


def assign_regions_to_buildings(components, buildings, target_count, width, height):
    fallback_components = sorted(components, key=lambda item: item["area"], reverse=True)[:target_count]
    fallback_components.sort(key=lambda item: (item["pixelBox"][1], item["pixelBox"][0]))

    candidates = {}
    add_pdfium_candidates(candidates, buildings, components, width, height)
    add_pymupdf_candidates(candidates, buildings, components, width, height)

    pairs = []
    engine_priority = {"pdfium": 0, "pymupdf": 1}
    for building_index, building in enumerate(buildings):
        for candidate in candidates.get(building["id"], []):
            if candidate["distance"] > LABEL_ASSIGN_MAX_DISTANCE:
                continue
            component = components[candidate["componentIndex"]]
            pairs.append(
                (
                    candidate["distance"],
                    engine_priority.get(candidate["engine"], 9),
                    -component["area"],
                    building_index,
                    candidate["componentIndex"],
                    candidate,
                )
            )

    assigned = {}
    used_components = set()
    for _, _, _, building_index, component_index, candidate in sorted(pairs):
        if building_index in assigned or component_index in used_components:
            continue
        assigned[building_index] = (component_index, candidate)
        used_components.add(component_index)

    regions = []
    report = {
        "assignedByLabel": [],
        "fallback": [],
        "componentCount": len(components),
    }
    for index, building in enumerate(buildings, start=1):
        assigned_item = assigned.get(index - 1)
        if assigned_item:
            component_index, candidate = assigned_item
            component = components[component_index]
            assignment = f"pdf-label:{candidate['engine']}:{candidate['term']}:{candidate['distance']:.1f}px"
            report["assignedByLabel"].append(
                {
                    "buildingId": building["id"],
                    "regionId": f"PDF-MOR-{index:03d}",
                    "engine": candidate["engine"],
                    "term": candidate["term"],
                    "distance": round(candidate["distance"], 2),
                    "pixelBox": component["pixelBox"],
                }
            )
        else:
            fallback_index = min(index - 1, len(fallback_components) - 1)
            component = fallback_components[fallback_index]
            assignment = "pdf-magenta-fallback"
            report["fallback"].append(
                {
                    "buildingId": building["id"],
                    "regionId": f"PDF-MOR-{index:03d}",
                    "pixelBox": component["pixelBox"],
                }
            )
        regions.append(make_region(component, index, building["id"], assignment))

    report_path = ROOT / "tmp" / "map-region-assignment-report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Map assignment: {len(report['assignedByLabel'])} label-based, "
        f"{len(report['fallback'])} fallback -> {report_path}"
    )
    return regions

def detect_magenta_regions(target_count, buildings):
    image_path = COORDINATE_MAP_IMAGE if COORDINATE_MAP_IMAGE.exists() else MAP_IMAGE
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    mask_pixels = mask.load()
    pixels = image.load()

    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > 170 and b > 140 and g < 115 and r - g > 65 and b - g > 45:
                mask_pixels[x, y] = 255

    data = mask.tobytes()
    seen = bytearray(width * height)
    components = []

    for index, value in enumerate(data):
        if value == 0 or seen[index]:
            continue

        queue = deque([index])
        seen[index] = 1
        min_x = width
        min_y = height
        max_x = 0
        max_y = 0
        count = 0
        component_points = []

        while queue:
            current = queue.pop()
            count += 1
            x = current % width
            y = current // width
            component_points.append((x, y))
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

            for next_y in (y - 1, y, y + 1):
                for next_x in (x - 1, x, x + 1):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        continue
                    if next_x == x and next_y == y:
                        continue
                    neighbor = next_y * width + next_x
                    if not seen[neighbor] and data[neighbor] != 0:
                        seen[neighbor] = 1
                        queue.append(neighbor)

        if count < 8:
            continue

        min_x = max(0, min_x - 2)
        min_y = max(0, min_y - 2)
        max_x = min(width - 1, max_x + 2)
        max_y = min(height - 1, max_y + 2)
        box_width = max_x - min_x + 1
        box_height = max_y - min_y + 1

        boundary = []
        step = max(1, int(count ** 0.5 // 4))
        sample_index = 0
        for x, y in component_points:
            is_edge = False
            for next_y in (y - 1, y, y + 1):
                for next_x in (x - 1, x, x + 1):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        is_edge = True
                        continue
                    if data[next_y * width + next_x] == 0:
                        is_edge = True
            if is_edge:
                sample_index += 1
                if sample_index % step == 0:
                    boundary.append((x, y))

        hull = convex_hull(boundary)
        if len(hull) < 3:
            points = [
                (min_x, min_y),
                (max_x, min_y),
                (max_x, max_y),
                (min_x, max_y),
            ]
        else:
            points = hull

        components.append(
            {
                "shape": "polygon",
                "points": [{"x": round(x / width, 5), "y": round(y / height, 5)} for x, y in points],
                "pixelBox": [min_x, min_y, max_x, max_y],
                "area": count,
                "source": "pdf-magenta",
            }
        )

    regions = assign_regions_to_buildings(components, buildings, target_count, width, height)
    return regions, width, height


def make_users(buildings, work_items):
    all_ids = [building["id"] for building in buildings]
    all_work_keys = [work["key"] for work in work_items]
    red_ids = [building["id"] for building in buildings if building["lineColor"].upper() == "KIRMIZI"]
    turquoise_ids = [building["id"] for building in buildings if building["lineColor"].upper() == "TURKUAZ"]
    purple_ids = [
        building["id"]
        for building in buildings
        if building["lineColor"].upper() in {"MOR", "MAGENTA", "MAVİ"}
    ]

    return [
        {
            "id": "u-admin",
            "name": "Süper Admin",
            "username": "admin",
            "password": "admin123",
            "role": "admin",
            "permissions": all_ids,
            "workPermissions": all_work_keys,
        },
        {
            "id": "u-formen-kirmizi",
            "name": "Kırmızı Hat Formeni",
            "username": "formen1",
            "password": "formen123",
            "role": "foreman",
            "permissions": red_ids[:60],
            "workPermissions": all_work_keys,
        },
        {
            "id": "u-formen-turkuaz",
            "name": "Turkuaz Hat Formeni",
            "username": "formen2",
            "password": "formen123",
            "role": "foreman",
            "permissions": turquoise_ids[:60],
            "workPermissions": all_work_keys,
        },
        {
            "id": "u-formen-mor",
            "name": "Mor/Magenta Hat Formeni",
            "username": "formen3",
            "password": "formen123",
            "role": "foreman",
            "permissions": purple_ids[:60],
            "workPermissions": all_work_keys,
        },
    ]


def main():
    if not SOURCE_XLSX.exists():
        raise FileNotFoundError(f"Excel bulunamadi: {SOURCE_XLSX}")
    if not MAP_IMAGE.exists():
        raise FileNotFoundError(f"Map gorseli bulunamadi: {MAP_IMAGE}")

    buildings, work_items = read_buildings()
    regions, map_width, map_height = detect_magenta_regions(len(buildings), buildings)

    data = {
        "map": {
            "image": "/assets/site-map.png?v=hires-640",
            "width": map_width,
            "height": map_height,
        },
        "buildings": buildings,
        "workItems": work_items,
        "regions": regions,
        "users": make_users(buildings, work_items),
        "requests": [],
        "progressRanges": [
            {"id": "range-0-20", "min": 0, "max": 20, "color": "#ff4040", "label": "0-20"},
            {"id": "range-20-40", "min": 20, "max": 40, "color": "#ffac5a", "label": "20-40"},
            {"id": "range-40-60", "min": 40, "max": 60, "color": "#ffff3b", "label": "40-60"},
            {"id": "range-60-80", "min": 60, "max": 80, "color": "#91ff8f", "label": "60-80"},
            {"id": "range-80-100", "min": 80, "max": 100, "color": "#00f75c", "label": "80-100"},
        ],
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Generated {len(buildings)} buildings, {len(work_items)} work item types, "
        f"{len(regions)} PDF regions -> {OUTPUT_JSON}"
    )


if __name__ == "__main__":
    main()
