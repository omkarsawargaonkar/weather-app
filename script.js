/* =========================================================
   Skyline Weather
   Plain JavaScript, no build step. Uses the OpenWeather API.
   ========================================================= */

const API_KEY = "84f628bd3e048edbb99fed81c7b3e866";
const API = "https://api.openweathermap.org";

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);

const cityInput = $("cityInput");
const searchBtn = $("searchBtn");
const locationBtn = $("locationBtn");
const suggestionsEl = $("suggestions");
const recentEl = $("recent");
const statusEl = $("status");
const contentEl = $("content");
const unitC = $("unitC");
const unitF = $("unitF");

/* ---------- State ---------- */
const state = {
    unit: load("skyline.unit", "metric"),
    data: null, // { weather, forecast, air }
    suggestions: [],
    activeSuggestion: -1,
    requestId: 0,
};

/* ---------- Storage helpers (safe if storage is blocked) ---------- */
function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
}

/* ---------- Icons ---------- */
function emojiFor(icon) {
    const code = icon.slice(0, 2);
    const night = icon.endsWith("n");
    switch (code) {
        case "01": return night ? "🌙" : "☀️";
        case "02": return night ? "☁️" : "⛅";
        case "03":
        case "04": return "☁️";
        case "09": return "🌧️";
        case "10": return night ? "🌧️" : "🌦️";
        case "11": return "⛈️";
        case "13": return "❄️";
        case "50": return "🌫️";
        default: return "🌡️";
    }
}

/* ---------- Units ---------- */
const isMetric = () => state.unit === "metric";
const temp = (c) => Math.round(isMetric() ? c : c * 9 / 5 + 32);
const speed = (ms) => (isMetric() ? { v: Math.round(ms * 3.6), u: "km/h" } : { v: Math.round(ms * 2.237), u: "mph" });
const dist = (m) => (isMetric() ? { v: +(m / 1000).toFixed(1), u: "km" } : { v: +(m / 1609.34).toFixed(1), u: "mi" });

/* ---------- Time helpers (city local time via timezone offset) ---------- */
function cityDate(unixSeconds, tzOffset) {
    return new Date((unixSeconds + tzOffset) * 1000); // read with getUTC* methods
}

function fmtTime(unixSeconds, tz) {
    const d = cityDate(unixSeconds, tz);
    let h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
}

function fmtHour(unixSeconds, tz) {
    const d = cityDate(unixSeconds, tz);
    const h = d.getUTCHours();
    return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- Networking ---------- */
async function getJSON(url) {
    let res;
    try {
        res = await fetch(url);
    } catch (e) {
        throw new Error("Can't reach the weather service. Check your internet connection and try again.");
    }
    if (res.status === 401) throw new Error("The weather API key was rejected. Check the key in script.js.");
    if (res.status === 404) throw new Error("We couldn't find that place. Check the spelling or try a nearby city.");
    if (res.status === 429) throw new Error("Too many requests. Wait a minute and try again.");
    if (!res.ok) throw new Error("The weather service had a problem. Try again in a moment.");
    return res.json();
}

async function geocode(query, limit = 5) {
    return getJSON(`${API}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=${limit}&appid=${API_KEY}`);
}

async function loadByCoords(lat, lon) {
    const id = ++state.requestId;
    setStatus("Fetching the latest conditions…", "loading");
    contentEl.classList.add("refreshing");

    try {
        const q = `lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
        const [weather, forecast, air] = await Promise.all([
            getJSON(`${API}/data/2.5/weather?${q}`),
            getJSON(`${API}/data/2.5/forecast?${q}`),
            getJSON(`${API}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`).catch(() => null),
        ]);

        if (id !== state.requestId) return; // a newer request replaced this one

        state.data = { weather, forecast, air };
        clearStatus();
        render();
        rememberPlace(weather, lat, lon);
    } catch (err) {
        if (id !== state.requestId) return;
        setStatus(err.message, "error");
    } finally {
        if (id === state.requestId) contentEl.classList.remove("refreshing");
    }
}

/* ---------- Status ---------- */
function setStatus(message, kind) {
    statusEl.className = "status" + (kind === "error" ? " error" : "");
    statusEl.replaceChildren();
    if (kind === "loading") {
        const s = document.createElement("span");
        s.className = "spinner";
        statusEl.appendChild(s);
    }
    const t = document.createElement("span");
    t.textContent = message;
    statusEl.appendChild(t);
}

function clearStatus() {
    statusEl.className = "status hidden";
    statusEl.replaceChildren();
}

/* ---------- Recent places ---------- */
function rememberPlace(weather, lat, lon) {
    const place = { name: weather.name || "Unknown", country: weather.sys.country || "", lat, lon };
    let list = load("skyline.recent", []);
    list = list.filter((p) => !(p.name === place.name && p.country === place.country));
    list.unshift(place);
    list = list.slice(0, 5);
    save("skyline.recent", list);
    save("skyline.last", place);
    renderRecent();
}

function renderRecent() {
    const list = load("skyline.recent", []);
    recentEl.replaceChildren();
    if (list.length < 1) {
        recentEl.classList.add("hidden");
        return;
    }
    recentEl.classList.remove("hidden");
    list.forEach((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = p.name + (p.country ? ", " + p.country : "");
        b.addEventListener("click", () => loadByCoords(p.lat, p.lon));
        recentEl.appendChild(b);
    });
}

/* ---------- Search + suggestions ---------- */
let suggestTimer;

cityInput.addEventListener("input", () => {
    clearTimeout(suggestTimer);
    const q = cityInput.value.trim();
    if (q.length < 2) return hideSuggestions();
    suggestTimer = setTimeout(async () => {
        try {
            const results = await geocode(q, 5);
            if (cityInput.value.trim() !== q) return;
            showSuggestions(results);
        } catch (e) { hideSuggestions(); }
    }, 280);
});

function placeLabel(p) {
    return [p.state, p.country].filter(Boolean).join(", ");
}

function showSuggestions(results) {
    state.suggestions = results;
    state.activeSuggestion = -1;
    suggestionsEl.replaceChildren();
    if (!results.length) return hideSuggestions();

    results.forEach((p, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.id = "sugg-" + i;
        const name = document.createElement("span");
        name.textContent = p.name;
        const sub = document.createElement("small");
        sub.textContent = placeLabel(p);
        li.append(name, sub);
        li.addEventListener("mousedown", (e) => { e.preventDefault(); chooseSuggestion(i); });
        suggestionsEl.appendChild(li);
    });
    suggestionsEl.classList.remove("hidden");
    cityInput.setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
    suggestionsEl.classList.add("hidden");
    cityInput.setAttribute("aria-expanded", "false");
    state.suggestions = [];
    state.activeSuggestion = -1;
}

function highlightSuggestion(i) {
    [...suggestionsEl.children].forEach((li, idx) => li.setAttribute("aria-selected", idx === i ? "true" : "false"));
    state.activeSuggestion = i;
}

function chooseSuggestion(i) {
    const p = state.suggestions[i];
    if (!p) return;
    cityInput.value = p.name;
    hideSuggestions();
    loadByCoords(p.lat, p.lon);
}

async function runSearch() {
    if (state.activeSuggestion >= 0) return chooseSuggestion(state.activeSuggestion);

    const q = cityInput.value.trim();
    if (!q) {
        setStatus("Type a city name to search.", "error");
        cityInput.focus();
        return;
    }
    hideSuggestions();
    setStatus("Searching…", "loading");
    try {
        const results = await geocode(q, 1);
        if (!results.length) throw new Error(`We couldn't find "${q}". Check the spelling or try a nearby city.`);
        loadByCoords(results[0].lat, results[0].lon);
    } catch (err) {
        setStatus(err.message, "error");
    }
}

searchBtn.addEventListener("click", runSearch);

cityInput.addEventListener("keydown", (e) => {
    const n = state.suggestions.length;
    if (e.key === "ArrowDown" && n) {
        e.preventDefault();
        highlightSuggestion((state.activeSuggestion + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
        e.preventDefault();
        highlightSuggestion((state.activeSuggestion - 1 + n) % n);
    } else if (e.key === "Enter") {
        e.preventDefault();
        runSearch();
    } else if (e.key === "Escape") {
        hideSuggestions();
    }
});

cityInput.addEventListener("blur", () => setTimeout(hideSuggestions, 120));

document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== cityInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        cityInput.focus();
        cityInput.select();
    }
});

/* ---------- Geolocation ---------- */
locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        setStatus("Your browser doesn't support location. Search for a city instead.", "error");
        return;
    }
    setStatus("Finding your location…", "loading");
    navigator.geolocation.getCurrentPosition(
        (pos) => loadByCoords(pos.coords.latitude, pos.coords.longitude),
        (err) => {
            const msg = err.code === 1
                ? "Location access is blocked. Allow it in your browser settings, or search for a city."
                : "We couldn't get your location. Search for a city instead.";
            setStatus(msg, "error");
        },
        { timeout: 10000, maximumAge: 300000 }
    );
});

/* ---------- Unit toggle ---------- */
function setUnit(unit) {
    state.unit = unit;
    save("skyline.unit", unit);
    unitC.classList.toggle("active", unit === "metric");
    unitF.classList.toggle("active", unit === "imperial");
    unitC.setAttribute("aria-pressed", unit === "metric");
    unitF.setAttribute("aria-pressed", unit === "imperial");
    if (state.data) render(false);
}

unitC.addEventListener("click", () => setUnit("metric"));
unitF.addEventListener("click", () => setUnit("imperial"));

/* ---------- Rendering ---------- */
let shownTemp = null;

function render(animate = true) {
    const { weather: w, forecast: f, air } = state.data;
    const tz = w.timezone;
    const cond = w.weather[0];
    const night = isNight(w);

    contentEl.classList.remove("hidden");

    // Hero
    $("cityName").textContent = w.name ? `${w.name}, ${w.sys.country || ""}`.replace(/, $/, "") : "Unknown place";
    $("weatherCondition").textContent = cond.description;
    $("weatherIcon").textContent = emojiFor(cond.icon);
    $("tempUnit").textContent = isMetric() ? "°C" : "°F";
    countTo($("temperature"), temp(w.main.temp), animate);
    $("highLow").textContent = `High ${temp(w.main.temp_max)}°  ·  Low ${temp(w.main.temp_min)}°`;
    $("advice").textContent = adviceFor(w);
    updateClock();

    // Page theme
    document.body.dataset.sky = skyFor(w, night);
    document.body.dataset.night = String(night);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.body).getPropertyValue("--sky-a").trim() || "#2b7fd8";
    document.title = `${temp(w.main.temp)}° ${w.name || ""} · Skyline Weather`;
    setSky(document.body.dataset.sky);

    // Tiles
    $("feelsLike").textContent = temp(w.main.feels_like) + "°";
    const diff = temp(w.main.feels_like) - temp(w.main.temp);
    $("feelsNote").textContent = diff === 0 ? "Feels just like the actual temperature." : `Feels ${Math.abs(diff)}° ${diff > 0 ? "warmer" : "cooler"} than the thermometer.`;

    $("humidity").textContent = w.main.humidity + "%";
    $("humidityBar").style.width = w.main.humidity + "%";
    $("humidityNote").textContent = humidityNote(w.main.humidity);

    const ws = speed(w.wind.speed);
    $("windSpeed").innerHTML = `${ws.v}<small>${ws.u}</small>`;
    const deg = w.wind.deg ?? 0;
    $("windArrow").style.transform = `rotate(${(deg + 180) % 360}deg)`;
    $("windNote").textContent = `${windName(w.wind.speed)} from the ${compass(deg)}` + (w.wind.gust ? `, gusts to ${speed(w.wind.gust).v} ${ws.u}` : "");

    renderAir(air);

    $("pressure").innerHTML = `${w.main.pressure}<small>hPa</small>`;
    $("pressureNote").textContent = w.main.pressure < 1009 ? "Low pressure. Unsettled weather is more likely." : w.main.pressure > 1022 ? "High pressure. Usually calm and settled." : "Steady, normal pressure.";

    const vis = dist(w.visibility ?? 10000);
    $("visibility").innerHTML = `${vis.v}<small>${vis.u}</small>`;
    $("visibilityNote").textContent = (w.visibility ?? 10000) >= 10000 ? "Clear view to the horizon." : (w.visibility < 2000 ? "Very limited. Take care on the road." : "Somewhat reduced.");

    $("clouds").textContent = (w.clouds?.all ?? 0) + "%";
    $("cloudBar").style.width = (w.clouds?.all ?? 0) + "%";

    renderSun(w);
    renderHourly(f, tz);
    renderDaily(f, tz);
}

function countTo(el, target, animate) {
    const from = animate && shownTemp !== null ? shownTemp : target;
    shownTemp = target;
    if (from === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.textContent = target;
        return;
    }
    const start = performance.now();
    const dur = 700;
    function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function isNight(w) {
    const now = w.dt;
    return now < w.sys.sunrise || now > w.sys.sunset;
}

function skyFor(w, night) {
    const id = w.weather[0].id;
    if (id >= 200 && id < 300) return "thunder";
    if ((id >= 300 && id < 400) || (id >= 500 && id < 600)) return "rain";
    if (id >= 600 && id < 700) return "snow";
    if (id >= 700 && id < 800) return "mist";
    if (id === 800 || id === 801) return night ? "clear-night" : "clear-day";
    return night ? "clouds-night" : "clouds";
}

function adviceFor(w) {
    const id = w.weather[0].id;
    const t = w.main.feels_like;
    if (id >= 200 && id < 300) return "Thunderstorms nearby. Stay indoors and unplug sensitive electronics if it gets close.";
    if (id >= 500 && id < 600) return "Rain expected. Carry an umbrella and watch for slippery roads.";
    if (id >= 300 && id < 400) return "Light drizzle in the air. A thin rain jacket is enough.";
    if (id >= 600 && id < 700) return "Snowfall. Wear warm, waterproof shoes and allow extra travel time.";
    if (id >= 700 && id < 800) return "Reduced visibility. Drive slowly and use your lights.";
    if (w.wind.speed > 10) return "Strong wind today. Secure loose items outdoors.";
    if (t >= 38) return "Extreme heat. Drink water often and avoid the outdoors in the afternoon.";
    if (t >= 32) return "Hot out there. Wear light clothes, use sunscreen and keep water close.";
    if (t <= 5) return "It's cold. Layer up with a warm jacket, hat and gloves.";
    if (t <= 14) return "A bit chilly. A light jacket or sweater will do.";
    if (id === 800) return isNight(w) ? "A clear night. A good one for stargazing." : "Clear skies. A great time to be outside.";
    return "Comfortable conditions. Enjoy your day.";
}

function humidityNote(h) {
    if (h < 30) return "Dry air. Stay hydrated.";
    if (h < 60) return "Comfortable level.";
    if (h < 80) return "A little muggy.";
    return "Very humid and sticky.";
}

function windName(ms) {
    if (ms < 1.5) return "Calm";
    if (ms < 5.5) return "Light breeze";
    if (ms < 10.8) return "Moderate wind";
    if (ms < 17.2) return "Strong wind";
    return "Gale";
}

function compass(deg) {
    const dirs = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
    return dirs[Math.round(deg / 45) % 8];
}

/* ---------- Air quality ---------- */
const AQI = [
    { label: "Good", note: "Air is clean. Enjoy the outdoors." },
    { label: "Fair", note: "Acceptable for most people." },
    { label: "Moderate", note: "Sensitive groups may feel some effects." },
    { label: "Poor", note: "Limit long outdoor exercise." },
    { label: "Very poor", note: "Avoid outdoor activity if you can." },
];

function renderAir(air) {
    const idx = air?.list?.[0]?.main?.aqi;
    if (!idx) {
        $("aqiValue").textContent = "N/A";
        $("aqiNote").textContent = "No air quality data for this place.";
        $("aqiPin").style.left = "0%";
        return;
    }
    const a = AQI[idx - 1];
    $("aqiValue").textContent = a.label;
    $("aqiNote").textContent = a.note;
    $("aqiPin").style.left = ((idx - 1) / 4) * 92 + 4 + "%";
}

/* ---------- Sun arc ---------- */
function renderSun(w) {
    const tz = w.timezone;
    const { sunrise, sunset } = w.sys;
    $("sunrise").textContent = fmtTime(sunrise, tz);
    $("sunset").textContent = fmtTime(sunset, tz);

    const hrs = (sunset - sunrise) / 3600;
    $("daylight").textContent = `${Math.floor(hrs)} h ${Math.round((hrs % 1) * 60)} min of daylight today.`;

    const now = Math.floor(Date.now() / 1000);
    // Use the API time if the data is older than a few minutes
    const ref = Math.abs(now - w.dt) < 3 * 3600 ? now : w.dt;
    const p = Math.max(0, Math.min(1, (ref - sunrise) / (sunset - sunrise)));

    const cx = 110, cy = 105, r = 90;
    const x = cx - r * Math.cos(Math.PI * p);
    const y = cy - r * Math.sin(Math.PI * p);
    $("sunMarker").style.transform = `translate(${x}px, ${y}px)`;
    $("arcDone").style.strokeDashoffset = String(283 * (1 - p));
}

/* ---------- Hourly ---------- */
function renderHourly(f, tz) {
    const box = $("hourlyContainer");
    box.replaceChildren();
    f.list.slice(0, 9).forEach((item, i) => {
        const el = document.createElement("div");
        el.className = "hour" + (i === 0 ? " now" : "");

        const t = document.createElement("span");
        t.className = "h-time";
        t.textContent = i === 0 ? "Next" : fmtHour(item.dt, tz);

        const ic = document.createElement("span");
        ic.className = "h-icon";
        ic.textContent = emojiFor(item.weather[0].icon);
        ic.title = item.weather[0].description;

        const tp = document.createElement("span");
        tp.className = "h-temp";
        tp.textContent = temp(item.main.temp) + "°";

        const pop = document.createElement("span");
        pop.className = "h-pop";
        pop.textContent = item.pop > 0.05 ? Math.round(item.pop * 100) + "%" : "";

        el.append(t, ic, tp, pop);
        box.appendChild(el);
    });
}

/* ---------- 5-day ---------- */
function renderDaily(f, tz) {
    const days = new Map();

    f.list.forEach((item) => {
        const d = cityDate(item.dt, tz);
        const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
        if (!days.has(key)) days.set(key, { items: [], date: d });
        days.get(key).items.push({ ...item, hour: d.getUTCHours() });
    });

    const list = [...days.values()].slice(0, 5).map((day) => {
        const temps = day.items.map((i) => i.main.temp);
        const noon = day.items.reduce((best, i) => (Math.abs(i.hour - 13) < Math.abs(best.hour - 13) ? i : best));
        return {
            date: day.date,
            min: Math.min(...day.items.map((i) => i.main.temp_min), ...temps),
            max: Math.max(...day.items.map((i) => i.main.temp_max), ...temps),
            icon: noon.weather[0].icon.replace("n", "d"),
            desc: noon.weather[0].description,
            pop: Math.max(...day.items.map((i) => i.pop || 0)),
        };
    });

    const gMin = Math.min(...list.map((d) => d.min));
    const gMax = Math.max(...list.map((d) => d.max));
    const span = Math.max(gMax - gMin, 1);

    const box = $("forecastContainer");
    box.replaceChildren();

    list.forEach((d, i) => {
        const row = document.createElement("div");
        row.className = "day";

        const name = document.createElement("span");
        name.className = "d-name";
        name.textContent = i === 0 ? "Today" : i === 1 ? "Tomorrow" : WEEKDAYS[d.date.getUTCDay()];

        const ic = document.createElement("span");
        ic.className = "d-icon";
        ic.textContent = emojiFor(d.icon);
        ic.title = d.desc;

        const range = document.createElement("div");
        range.className = "d-range";
        const lo = document.createElement("span");
        lo.className = "lo";
        lo.textContent = temp(d.min) + "°";
        const bar = document.createElement("div");
        bar.className = "range-bar";
        const fill = document.createElement("i");
        fill.style.left = ((d.min - gMin) / span) * 100 + "%";
        fill.style.width = Math.max(((d.max - d.min) / span) * 100, 8) + "%";
        bar.appendChild(fill);
        const hi = document.createElement("span");
        hi.className = "hi";
        hi.textContent = temp(d.max) + "°";
        range.append(lo, bar, hi);

        row.append(name, ic, range);

        if (d.pop > 0.1) {
            const p = document.createElement("span");
            p.className = "d-pop";
            p.textContent = `${Math.round(d.pop * 100)}% chance of precipitation`;
            row.appendChild(p);
        }

        box.appendChild(row);
    });
}

/* ---------- Local clock ---------- */
function updateClock() {
    if (!state.data) return;
    const tz = state.data.weather.timezone;
    const now = Math.floor(Date.now() / 1000);
    const d = cityDate(now, tz);
    $("localTime").textContent = `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${fmtTime(now, tz)} local time`;
}
setInterval(updateClock, 15000);

/* ---------- Copy summary ---------- */
$("shareBtn").addEventListener("click", async () => {
    if (!state.data) return;
    const w = state.data.weather;
    const text = `${w.name}: ${temp(w.main.temp)}°${isMetric() ? "C" : "F"}, ${w.weather[0].description}. Feels like ${temp(w.main.feels_like)}°, humidity ${w.main.humidity}%.`;
    const label = $("shareBtn").querySelector("span");
    try {
        await navigator.clipboard.writeText(text);
        label.textContent = "Copied";
    } catch (e) {
        label.textContent = "Copy failed";
    }
    setTimeout(() => (label.textContent = "Copy summary"), 1600);
});

/* =========================================================
   Living sky: canvas particles that follow the weather
   ========================================================= */
const canvas = $("sky");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let W = 0, H = 0, dpr = 1;
let particles = [];
let mode = "clear-day";
let flash = 0;
let rafId = null;

function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
}

function rand(a, b) { return a + Math.random() * (b - a); }

function buildParticles() {
    particles = [];
    const area = W * H;

    if (mode === "rain" || mode === "thunder") {
        const n = Math.min(Math.round(area / 5500), 260);
        for (let i = 0; i < n; i++) particles.push({ x: rand(0, W), y: rand(0, H), l: rand(10, 24), v: rand(11, 19) });
    } else if (mode === "snow") {
        const n = Math.min(Math.round(area / 9000), 170);
        for (let i = 0; i < n; i++) particles.push({ x: rand(0, W), y: rand(0, H), r: rand(1.2, 3.6), v: rand(0.6, 1.6), d: rand(0, Math.PI * 2) });
    } else if (mode === "clear-night" || mode === "clouds-night") {
        const n = mode === "clear-night" ? Math.min(Math.round(area / 6000), 220) : 50;
        for (let i = 0; i < n; i++) particles.push({ star: true, x: rand(0, W), y: rand(0, H * 0.85), r: rand(0.4, 1.7), t: rand(0, Math.PI * 2), s: rand(0.01, 0.04) });
    }

    // Soft drifting clouds for most skies
    if (mode !== "clear-day" && mode !== "clear-night") {
        const count = mode === "mist" ? 7 : 6;
        for (let i = 0; i < count; i++) particles.push({ cloud: true, x: rand(-200, W), y: rand(0, H * 0.7), w: rand(220, 460), v: rand(0.12, 0.38) });
    } else {
        for (let i = 0; i < 3; i++) particles.push({ cloud: true, thin: true, x: rand(-200, W), y: rand(H * 0.05, H * 0.5), w: rand(200, 380), v: rand(0.1, 0.25) });
    }
}

function drawCloud(c) {
    const alpha = mode === "mist" ? 0.22 : c.thin ? 0.1 : mode === "clouds" ? 0.2 : 0.14;
    const tint = mode.includes("night") || mode === "thunder" || mode === "rain" ? "190,200,225" : "255,255,255";
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w / 2);
    g.addColorStop(0, `rgba(${tint},${alpha})`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w / 2, c.w / 5, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawSun() {
    const x = W * 0.82, y = H * 0.16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.5);
    g.addColorStop(0, "rgba(255,244,200,0.75)");
    g.addColorStop(0.08, "rgba(255,226,140,0.45)");
    g.addColorStop(0.4, "rgba(255,210,120,0.1)");
    g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

function drawMoon() {
    const x = W * 0.82, y = H * 0.15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 150);
    g.addColorStop(0, "rgba(220,230,255,0.4)");
    g.addColorStop(1, "rgba(220,230,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 160, y - 160, 320, 320);
    ctx.fillStyle = "#eef2ff";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160,175,220,0.35)";
    ctx.beginPath(); ctx.arc(x - 8, y - 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9, y + 8, 4, 0, Math.PI * 2); ctx.fill();
}

function frame() {
    ctx.clearRect(0, 0, W, H);

    if (mode === "clear-day") drawSun();
    if (mode === "clear-night") drawMoon();

    for (const p of particles) {
        if (p.cloud) {
            p.x += p.v;
            if (p.x - p.w / 2 > W) p.x = -p.w / 2;
            drawCloud(p);
        } else if (p.star) {
            p.t += p.s;
            ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(p.t))})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (mode === "snow") {
            p.y += p.v;
            p.d += 0.01;
            p.x += Math.sin(p.d) * 0.5;
            if (p.y > H + 5) { p.y = -5; p.x = rand(0, W); }
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // rain
            p.y += p.v;
            p.x -= p.v * 0.18;
            if (p.y > H) { p.y = -p.l; p.x = rand(0, W + 100); }
            ctx.strokeStyle = "rgba(190,215,255,0.5)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.l * 0.18, p.y + p.l);
            ctx.stroke();
        }
    }

    if (mode === "thunder") {
        if (flash <= 0 && Math.random() < 0.004) flash = 1;
        if (flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
            ctx.fillRect(0, 0, W, H);
            flash -= 0.06;
        }
    }

    rafId = requestAnimationFrame(frame);
}

function setSky(newMode) {
    mode = newMode;
    buildParticles();
    if (reduceMotion) {
        cancelAnimationFrame(rafId);
        frame();               // draw one still frame
        cancelAnimationFrame(rafId);
    } else if (!rafId) {
        frame();
    }
}

document.addEventListener("visibilitychange", () => {
    if (reduceMotion) return;
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!rafId) frame();
});

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
});

/* ---------- Start ---------- */
(function init() {
    setUnit(state.unit);
    resize();
    setSky("clear-day");
    renderRecent();

    const last = load("skyline.last", null);
    if (last) {
        loadByCoords(last.lat, last.lon);
    } else {
        // Default to Pune, as in the original app
        geocode("Pune", 1)
            .then((r) => (r.length ? loadByCoords(r[0].lat, r[0].lon) : loadByCoords(18.5204, 73.8567)))
            .catch(() => loadByCoords(18.5204, 73.8567));
    }
})();
