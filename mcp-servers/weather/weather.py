#!/usr/bin/env python3
"""HERMES Weather Service — Open-Meteo (free, no auth, CC BY 4.0)
Usage:
  python3 weather.py                    # KL current + 3-day forecast
  python3 weather.py --city Penang      # Penang weather
  python3 weather.py --lat 1.55 --lon 103.6  # custom coords
  python3 weather.py --json             # JSON output for agents
"""

import json, sys, argparse, urllib.request, urllib.error, urllib.parse

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Default: KL
DEFAULT_LAT, DEFAULT_LON = 3.139, 101.6869
DEFAULT_CITY = "Kuala Lumpur"


def geocode_city(name: str) -> tuple[float, float, str]:
    """Resolve city name to coordinates via Open-Meteo geocoding."""
    url = f"{GEOCODE_URL}?name={urllib.parse.quote(name)}&count=1&language=en"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
        if data.get("results"):
            r = data["results"][0]
            return r["latitude"], r["longitude"], r.get("name", name)
    except Exception:
        pass
    return DEFAULT_LAT, DEFAULT_LON, name


def get_weather(lat: float, lon: float) -> dict:
    """Fetch current weather + 3-day hourly forecast from Open-Meteo."""
    params = (
        f"latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
        "precipitation,weather_code,wind_speed_10m,wind_direction_10m"
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,"
        "precipitation_sum,precipitation_probability_max,wind_speed_10m_max"
        "&timezone=Asia%2FKuala_Lumpur&forecast_days=3"
    )
    url = f"{WEATHER_URL}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.URLError as e:
        return {"error": str(e)}


WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm w/ slight hail",
    99: "Thunderstorm w/ heavy hail",
}


def format_human(data: dict, city: str) -> str:
    """Format weather data as human-readable text."""
    if "error" in data:
        return f"Error: {data['error']}"
    c = data.get("current", {})
    d = data.get("daily", {})
    code = c.get("weather_code", 0)
    desc = WMO_CODES.get(code, f"Code {code}")
    lines = [
        f"WEATHER: {city}",
        f"Now: {desc} | {c.get('temperature_2m', '?')}C (feels {c.get('apparent_temperature', '?')}C)",
        f"Wind: {c.get('wind_speed_10m', '?')} km/h | Humidity: {c.get('relative_humidity_2m', '?')}%",
        f"Precip: {c.get('precipitation', '?')} mm",
        "",
        "3-DAY FORECAST:",
    ]
    dates = d.get("time", [])
    for i, date in enumerate(dates):
        day_code = (
            d.get("weather_code", [0])[i] if i < len(d.get("weather_code", [])) else 0
        )
        day_desc = WMO_CODES.get(day_code, f"Code {day_code}")
        tmax = (
            d.get("temperature_2m_max", [])[i]
            if i < len(d.get("temperature_2m_max", []))
            else "?"
        )
        tmin = (
            d.get("temperature_2m_min", [])[i]
            if i < len(d.get("temperature_2m_min", []))
            else "?"
        )
        rain = (
            d.get("precipitation_sum", [])[i]
            if i < len(d.get("precipitation_sum", []))
            else "?"
        )
        prob = (
            d.get("precipitation_probability_max", [])[i]
            if i < len(d.get("precipitation_probability_max", []))
            else "?"
        )
        lines.append(
            f"  {date}: {day_desc} | {tmin}-{tmax}C | Rain: {rain}mm ({prob}%)"
        )
    return "\n".join(lines)


def main():
    import urllib.parse

    parser = argparse.ArgumentParser(description="HERMES Weather (Open-Meteo)")
    parser.add_argument("--city", default=DEFAULT_CITY, help="City name")
    parser.add_argument("--lat", type=float, help="Latitude override")
    parser.add_argument("--lon", type=float, help="Longitude override")
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    if args.lat and args.lon:
        lat, lon, city = args.lat, args.lon, args.city
    else:
        lat, lon, city = geocode_city(args.city)

    data = get_weather(lat, lon)
    data["_city"] = city
    data["_lat"] = lat
    data["_lon"] = lon

    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print(format_human(data, city))


if __name__ == "__main__":
    main()
