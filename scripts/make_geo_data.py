"""Builds backend/app/data/world.json: countries (name, a point inside each) and an unambiguous city -> country table.

    .venv/bin/pip install geonamescache      # a development tool only; the server reads the JSON file, not the package
    .venv/bin/python scripts/make_geo_data.py

Data: GeoNames (https://www.geonames.org), licensed CC BY 4.0, through the geonamescache package (MIT). A city name is kept only
when no other country has a city of that name (with 50,000+ people) that is anywhere near as large, so "Cambridge" or "Birmingham"
is never guessed while "Raanana" or "Hsinchu" are placed. Words that are also cities but almost always mean something else
("Mobile", "Nice", "Reading") are left out.
"""
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import geonamescache

OUT = Path(__file__).resolve().parents[1] / "backend" / "app" / "data" / "world.json"
STOP = {"mobile", "nice", "reading", "orange", "normal", "mission", "industry", "remote", "global", "hybrid", "office", "anywhere", "worldwide", "design",
        "product", "data", "central", "south", "north", "east", "west", "city", "center", "centre", "general", "union", "grand", "royal", "victory", "liberty",
        "independence", "progress", "marketing", "sales", "finance", "technology", "engineering", "platform", "support", "success", "growth"}
# Names that differ between GeoNames and the site's existing country list
RENAME = {"United States": "United States", "Czech Republic": "Czechia", "Republic of Korea": "South Korea", "South Korea": "South Korea",
          "Türkiye": "Turkey", "The Netherlands": "Netherlands", "The Bahamas": "Bahamas", "The Gambia": "Gambia", "Russian Federation": "Russia", "Viet Nam": "Vietnam", "Hong Kong": "Hong Kong", "Macao": "Macau"}


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]", " ", text)).strip()


def main() -> None:
    gc = geonamescache.GeonamesCache()
    countries, cities = gc.get_countries(), gc.get_cities()
    by_iso = {iso: c for iso, c in countries.items()}

    capitals: dict[str, tuple[float, float]] = {}
    pop_cities = [c for c in cities.values() if c["population"] >= 50000]
    for iso, c in by_iso.items():
        cap = next((x for x in cities.values() if x["countrycode"] == iso and fold(x["name"]) == fold(c["capital"] or "")), None)
        biggest = max((x for x in cities.values() if x["countrycode"] == iso), key=lambda x: x["population"], default=None)
        pick = cap or biggest
        if pick:
            capitals[iso] = (round(pick["latitude"], 2), round(pick["longitude"], 2))

    countries_out = {}
    for iso, c in by_iso.items():
        if iso in capitals:
            name = RENAME.get(c["name"], c["name"])
            countries_out[iso] = {"name": name, "iso3": c["iso3"], "lat": capitals[iso][0], "lng": capitals[iso][1]}

    # name -> {iso: biggest population}
    seen: dict[str, dict[str, int]] = defaultdict(dict)
    for c in pop_cities:
        names = {c["name"], *[a for a in c["alternatenames"] if len(a) <= 40]}
        for n in names:
            key = fold(n)
            if len(key) < 4 or key in STOP or key.isdigit() or not re.search(r"[a-z]", key):
                continue
            seen[key][c["countrycode"]] = max(c["population"], seen[key].get(c["countrycode"], 0))
    table = {}
    for key, per in seen.items():
        ranked = sorted(per.items(), key=lambda kv: -kv[1])
        if len(ranked) == 1 or ranked[0][1] >= 4 * ranked[1][1]:
            if ranked[0][0] in countries_out:
                table[key] = ranked[0][0]
    # alternative country names people write
    aliases = {"usa": "US", "u.s.": "US", "united states of america": "US", "uk": "GB", "great britain": "GB", "england": "GB", "scotland": "GB",
               "northern ireland": "GB", "korea": "KR", "russia": "RU", "turkiye": "TR", "uae": "AE", "holland": "NL", "czech republic": "CZ", "vietnam": "VN"}
    REGIONS = {
        "CA": ["ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan", "nova scotia", "new brunswick", "newfoundland", "prince edward island"],
        "AU": ["new south wales", "queensland", "western australia", "south australia", "tasmania", "northern territory", "australian capital territory"],
        "IN": ["karnataka", "maharashtra", "telangana", "tamil nadu", "kerala", "gujarat", "uttar pradesh", "haryana", "west bengal", "rajasthan", "andhra pradesh", "madhya pradesh", "odisha"],
        "DE": ["bavaria", "bayern", "baden wurttemberg", "nordrhein westfalen", "north rhine westphalia", "hessen", "niedersachsen"],
        "GB": ["greater london", "west midlands", "west yorkshire", "greater manchester"],
        "ES": ["catalonia", "cataluna", "andalusia"], "BR": ["sao paulo state", "minas gerais", "rio grande do sul"],
        "CN": ["guangdong", "jiangsu", "zhejiang", "sichuan", "hubei", "fujian"],
        "NL": ["noord holland", "zuid holland", "north holland", "south holland", "noord brabant"], "FR": ["ile de france", "auvergne rhone alpes"],
    }
    for iso, names in REGIONS.items():
        for name in names:
            aliases[name] = iso
    OUT.write_text(json.dumps({"countries": countries_out, "cities": table, "aliases": aliases}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(countries_out)} countries, {len(table)} city names -> {OUT.relative_to(OUT.parents[3])} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
