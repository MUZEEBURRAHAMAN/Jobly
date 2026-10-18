"""Where jobs are: turns a job's free-text location ("San Mateo, CA United States", "Remote - US", "Zürich") into a
country and, for the big hiring cities, a hub. Used by /api/geo for the website's map.

Locations are written by employers, so this is a best effort: a location it can't place is counted as
"not stated" rather than guessed. Remote jobs that name a country (e.g. "Remote - US") count for that country.
"""
from __future__ import annotations

import re
from functools import lru_cache

# country -> (latitude, longitude of a point inside it, keywords). Keywords are matched as whole words, lowercase.
COUNTRIES: dict[str, tuple[float, float, tuple[str, ...]]] = {
    "United States": (39.8, -98.6, ("united states", "usa", "u.s.", "us - remote", "us (remote", "us-remote", "remote - us", "remote us", "remote, us", "remote (us", "us remote", "namer",
        "washington d.c", "washington dc", "washington, d.c", "san francisco", "new york", "nyc", "seattle", "austin", "boston", "los angeles", "chicago", "denver", "atlanta", "san jose",
        "san mateo", "palo alto", "mountain view", "menlo park", "sunnyvale", "santa clara", "redwood city", "costa mesa", "santa ana", "newark, ca", "miami", "dallas", "houston", "portland",
        "san diego", "philadelphia", "pittsburgh", "raleigh", "salt lake", "minneapolis", "boulder", "brooklyn", "cambridge, ma", "waltham", "irvine", "el segundo", "culver city", "oakland",
        "bellevue", "scottsdale", "phoenix", "nashville", "detroit", "columbus", "ashville", "kirkland", "redmond", "woodinville")),
    "Canada": (56.1, -106.3, ("canada", "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo", "ontario", "british columbia", "quebec", "alberta")),
    "United Kingdom": (54.0, -2.5, ("united kingdom", "uk", "london", "manchester", "edinburgh", "england", "scotland", "bristol", "leeds", "belfast", "wales", "glasgow", "oxford", "cambridge, uk")),
    "Ireland": (53.3, -8.0, ("ireland", "dublin", "cork", "galway")),
    "Germany": (51.0, 10.3, ("germany", "deutschland", "berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "stuttgart", "düsseldorf", "dusseldorf", "leipzig", "dresden", "nuremberg", "hannover", "bremen")),
    "France": (46.6, 2.5, ("france", "paris", "lyon", "toulouse", "marseille", "nantes", "bordeaux", "lille")),
    "Netherlands": (52.2, 5.5, ("netherlands", "nederland", "amsterdam", "rotterdam", "utrecht", "eindhoven", "the hague", "den haag", "groningen")),
    "Belgium": (50.6, 4.6, ("belgium", "belgië", "belgique", "brussels", "antwerp", "ghent")),
    "Spain": (40.2, -3.7, ("spain", "españa", "madrid", "barcelona", "valencia", "seville", "málaga", "malaga")),
    "Portugal": (39.6, -8.0, ("portugal", "lisbon", "porto")),
    "Italy": (42.8, 12.6, ("italy", "milan", "rome", "turin", "bologna")),
    "Switzerland": (46.8, 8.2, ("switzerland", "schweiz", "zurich", "zürich", "geneva", "basel", "bern", "lausanne", "nyon", "zug")),
    "Austria": (47.5, 14.5, ("austria", "vienna", "wien", "graz")),
    "Sweden": (62.0, 15.0, ("sweden", "stockholm", "gothenburg", "malmö", "malmo")),
    "Norway": (61.0, 9.0, ("norway", "oslo")),
    "Denmark": (56.0, 9.5, ("denmark", "copenhagen", "aarhus")),
    "Finland": (62.5, 26.0, ("finland", "helsinki")),
    "Poland": (52.0, 19.4, ("poland", "warsaw", "krakow", "kraków", "wroclaw", "gdansk", "poznan")),
    "Czechia": (49.8, 15.5, ("czech", "prague", "brno")),
    "Romania": (45.9, 25.0, ("romania", "bucharest", "cluj")),
    "Hungary": (47.2, 19.5, ("hungary", "budapest")),
    "Greece": (39.0, 22.0, ("greece", "athens")),
    "Estonia": (58.7, 25.5, ("estonia", "tallinn")),
    "Lithuania": (55.3, 23.9, ("lithuania", "vilnius")),
    "Latvia": (56.9, 24.6, ("latvia", "riga")),
    "Bulgaria": (42.7, 25.4, ("bulgaria", "sofia")),
    "Serbia": (44.0, 20.9, ("serbia", "belgrade")),
    "Croatia": (45.1, 15.2, ("croatia", "zagreb")),
    "Ukraine": (49.0, 31.5, ("ukraine", "kyiv", "kiev")),
    "Luxembourg": (49.8, 6.1, ("luxembourg",)),
    "Turkey": (39.0, 35.2, ("turkey", "türkiye", "istanbul", "ankara")),
    "Cyprus": (35.1, 33.3, ("cyprus",)),
    "India": (21.0, 78.0, ("india", "bengaluru", "bangalore", "gurgaon", "gurugram", "hyderabad", "mumbai", "pune", "noida", "delhi", "chennai", "kolkata", "ahmedabad", "lucknow")),
    "Singapore": (1.35, 103.8, ("singapore",)),
    "Japan": (36.2, 138.3, ("japan", "tokyo", "osaka")),
    "South Korea": (36.5, 127.9, ("south korea", "korea", "seoul")),
    "China": (35.0, 103.0, ("china", "beijing", "shanghai", "shenzhen", "guangzhou", "hangzhou")),
    "Hong Kong": (22.3, 114.2, ("hong kong",)),
    "Taiwan": (23.7, 121.0, ("taiwan", "taipei")),
    "Australia": (-25.7, 134.5, ("australia", "sydney", "melbourne", "brisbane", "perth", "canberra")),
    "New Zealand": (-41.0, 172.5, ("new zealand", "auckland", "wellington")),
    "Vietnam": (15.9, 106.3, ("vietnam", "ho chi minh", "hanoi")),
    "Philippines": (12.9, 122.8, ("philippines", "manila")),
    "Indonesia": (-2.5, 118.0, ("indonesia", "jakarta")),
    "Malaysia": (4.2, 102.0, ("malaysia", "kuala lumpur")),
    "Thailand": (15.0, 101.0, ("thailand", "bangkok")),
    "Pakistan": (30.0, 69.5, ("pakistan", "karachi", "lahore")),
    "Bangladesh": (23.7, 90.3, ("bangladesh", "dhaka")),
    "Sri Lanka": (7.8, 80.7, ("sri lanka", "colombo")),
    "United Arab Emirates": (24.3, 54.3, ("united arab emirates", "uae", "dubai", "abu dhabi")),
    "Saudi Arabia": (24.0, 45.0, ("saudi", "riyadh", "jeddah", "king abdullah economic city")),
    "Israel": (31.4, 35.0, ("israel", "tel aviv", "jerusalem", "herzliya")),
    "Qatar": (25.3, 51.2, ("qatar", "doha")),
    "Egypt": (26.8, 30.0, ("egypt", "cairo")),
    "Brazil": (-10.8, -52.9, ("brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro")),
    "Mexico": (23.6, -102.5, ("mexico", "méxico", "mexico city", "guadalajara", "monterrey")),
    "Argentina": (-35.0, -64.0, ("argentina", "buenos aires")),
    "Colombia": (4.6, -74.1, ("colombia", "bogotá", "bogota", "medellin")),
    "Chile": (-33.5, -70.7, ("chile", "santiago")),
    "Peru": (-9.2, -75.0, ("peru", "lima")),
    "Costa Rica": (9.9, -84.1, ("costa rica", "cri - remote")),
    "Uruguay": (-32.5, -55.8, ("uruguay",)),
    "Nigeria": (9.1, 8.7, ("nigeria", "lagos")),
    "Kenya": (0.0, 37.9, ("kenya", "nairobi")),
    "South Africa": (-30.6, 22.9, ("south africa", "cape town", "johannesburg")),
    "Ghana": (7.9, -1.0, ("ghana", "accra")),
    "Morocco": (31.8, -7.1, ("morocco", "casablanca")),
}

# Hiring hubs: where several jobs sit in one city or metro. name, country, latitude, longitude, keywords.
HUBS: tuple[tuple[str, str, float, float, tuple[str, ...]], ...] = (
    ("San Francisco Bay Area", "United States", 37.6, -122.2, ("san francisco", "sf bay", "south san francisco", "san mateo", "palo alto", "mountain view", "menlo park", "sunnyvale", "santa clara", "redwood city", "oakland", "san jose", "newark, ca", "fremont", "foster city")),
    ("New York", "United States", 40.7, -74.0, ("new york", "nyc", "brooklyn")),
    ("Los Angeles area", "United States", 33.9, -118.1, ("los angeles", "costa mesa", "santa ana", "irvine", "el segundo", "culver city", "santa monica", "orange county")),
    ("Seattle area", "United States", 47.6, -122.2, ("seattle", "bellevue", "redmond", "kirkland", "woodinville")),
    ("Boston area", "United States", 42.4, -71.1, ("boston", "cambridge, ma", "cambridge, massachusetts", "waltham")),
    ("Austin", "United States", 30.3, -97.7, ("austin",)),
    ("Chicago", "United States", 41.9, -87.7, ("chicago",)),
    ("Washington, DC", "United States", 38.9, -77.0, ("washington, district of columbia", "washington d.c", "washington dc", "washington, d.c", "washington, dc")),
    ("Denver and Boulder", "United States", 39.9, -105.1, ("denver", "boulder")),
    ("Atlanta", "United States", 33.7, -84.4, ("atlanta",)),
    ("Miami", "United States", 25.8, -80.2, ("miami",)),
    ("San Diego", "United States", 32.7, -117.2, ("san diego",)),
    ("Toronto", "Canada", 43.7, -79.4, ("toronto",)),
    ("Vancouver", "Canada", 49.3, -123.1, ("vancouver",)),
    ("Montreal", "Canada", 45.5, -73.6, ("montreal", "montréal")),
    ("London", "United Kingdom", 51.5, -0.1, ("london",)),
    ("Dublin", "Ireland", 53.3, -6.3, ("dublin",)),
    ("Paris", "France", 48.9, 2.35, ("paris",)),
    ("Berlin", "Germany", 52.5, 13.4, ("berlin",)),
    ("Munich", "Germany", 48.1, 11.6, ("munich", "münchen")),
    ("Amsterdam", "Netherlands", 52.4, 4.9, ("amsterdam",)),
    ("Zurich", "Switzerland", 47.4, 8.5, ("zurich", "zürich")),
    ("Madrid", "Spain", 40.4, -3.7, ("madrid",)),
    ("Barcelona", "Spain", 41.4, 2.2, ("barcelona",)),
    ("Warsaw", "Poland", 52.2, 21.0, ("warsaw",)),
    ("Stockholm", "Sweden", 59.3, 18.1, ("stockholm",)),
    ("Bengaluru", "India", 12.97, 77.6, ("bengaluru", "bangalore")),
    ("Hyderabad", "India", 17.4, 78.5, ("hyderabad",)),
    ("Mumbai and Pune", "India", 19.0, 73.3, ("mumbai", "pune")),
    ("Delhi NCR", "India", 28.5, 77.2, ("delhi", "gurgaon", "gurugram", "noida")),
    ("Singapore", "Singapore", 1.35, 103.8, ("singapore",)),
    ("Tokyo", "Japan", 35.7, 139.7, ("tokyo",)),
    ("Sydney", "Australia", -33.9, 151.2, ("sydney",)),
    ("Melbourne", "Australia", -37.8, 145.0, ("melbourne",)),
    ("Tel Aviv", "Israel", 32.1, 34.8, ("tel aviv", "herzliya")),
    ("Dubai", "United Arab Emirates", 25.2, 55.3, ("dubai",)),
    ("São Paulo", "Brazil", -23.55, -46.6, ("são paulo", "sao paulo")),
    ("Mexico City", "Mexico", 19.4, -99.1, ("mexico city",)),
)

US_STATES = ("alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
    "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
    "virginia", "washington", "west virginia", "wisconsin", "wyoming", "district of columbia")
STATE_CODES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split()


def _words(keywords) -> re.Pattern[str]:
    return re.compile(r"(?<![a-z])(?:" + "|".join(re.escape(k) for k in sorted(keywords, key=len, reverse=True)) + r")(?![a-z])")


_COUNTRY_RX = [(name, _words(kw)) for name, (_, _, kw) in COUNTRIES.items()]
_HUB_RX = [(hub, _words(hub[4])) for hub in HUBS]
_STATE_RX = _words(US_STATES)
_CODE_RX = re.compile(r",\s*(?:" + "|".join(STATE_CODES) + r")\b")


@lru_cache(maxsize=4096)
def place_of(location: str | None) -> tuple[str | None, str | None]:
    """(country, hub name) for a location, or (None, None) when it can't be placed."""
    raw = location or ""
    text = raw.lower().strip()
    if not text:
        return None, None
    for hub, rx in _HUB_RX:
        if rx.search(text):
            return hub[1], hub[0]
    for name, rx in _COUNTRY_RX:
        if rx.search(text):
            return name, None
    if _CODE_RX.search(raw) or _STATE_RX.search(text):
        return "United States", None
    return None, None
