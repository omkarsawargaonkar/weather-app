# Skyline Weather

A responsive weather app built with plain HTML, CSS and JavaScript (no build step) using the OpenWeather API.

## Features

- Live sky background that changes with the weather and time of day (sun, moon and stars, clouds, rain, snow, thunder flashes, mist)
- Search with city suggestions (arrow keys and Enter work), plus "My location"
- Current temperature, condition, high/low and a short plain-language tip
- Next 24 hours (3-hour steps) and a 5-day forecast with temperature range bars
- Sun arc with sunrise, sunset and daylight length
- Humidity, wind with direction compass, air quality, pressure, visibility, cloud cover
- °C / °F toggle (also switches km/h and mph, km and mi), remembered between visits
- Recent searches and last city remembered
- Local time for the searched city
- Copy a one-line weather summary
- Keyboard shortcut: press `/` to search
- Respects reduced-motion settings; works from phones to wide desktops

## Run

Open `index.html` in a browser, or serve the folder with any static server.

## Setup

The API key is set at the top of `script.js` (`API_KEY`). Replace it with your own free key from https://openweathermap.org/api.
Since this is a front-end app, the key is visible to anyone who views the source.
