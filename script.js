const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");

const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const weatherCondition = document.getElementById("weatherCondition");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const weatherIcon = document.getElementById("weatherIcon");
const feelsLike = document.getElementById("feelsLike");

const loading = document.getElementById("loading");
const errorMessage = document.getElementById("errorMessage");
const forecastContainer = document.getElementById("forecastContainer");

function getWeather(city) {

    const apiKey = "84f628bd3e048edbb99fed81c7b3e866";

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    loading.classList.remove("hidden");

    fetch(url)
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {

            loading.classList.add("hidden");

            if (data.cod != 200) {
                errorMessage.textContent = "City not found!";
                errorMessage.classList.remove("hidden");
                weatherIcon.style.display = "none";
                return;
            }

            errorMessage.classList.add("hidden");

            cityName.textContent = data.name;
            temperature.textContent = data.main.temp + " °C";
            weatherCondition.textContent = data.weather[0].description;
            humidity.textContent = "Humidity: " + data.main.humidity + "%";
            windSpeed.textContent = "Wind Speed: " + data.wind.speed + " m/s";

            feelsLike.textContent = "Feels Like: " + data.main.feels_like + " °C";

            weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
            weatherIcon.style.display = "block";

            getForecast(city);
        });

}



function getForecast(city){

    const apiKey = "84f628bd3e048edbb99fed81c7b3e866";

    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;

    fetch(url)
        .then(function(response){
            return response.json();
        })
        .then(function(data){

            forecastContainer.innerHTML = "";

            for(let i = 0; i < data.list.length; i += 8){

    const forecast = data.list[i];

    const date = new Date(forecast.dt_txt);

const shortDayName = date.toLocaleDateString("en-US", {
    weekday: "short"
});

    const card = document.createElement("div");

    card.classList.add("forecast-card");

    card.innerHTML = `
        <h3>${shortDayName}</h3>
        <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png">
        <p>${Math.round(forecast.main.temp)} °C</p>
        <p>${forecast.weather[0].description}</p>
    `;

    forecastContainer.appendChild(card);

}
        });

}

function getWeatherByLocation(latitude, longitude) {

    const apiKey = "84f628bd3e048edbb99fed81c7b3e866";

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    loading.classList.remove("hidden");

    fetch(url)
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {

            loading.classList.add("hidden");

            if (data.cod != 200) {
                errorMessage.textContent = "City not found!";
                errorMessage.classList.remove("hidden");
                weatherIcon.style.display = "none";
                return;
            }

            errorMessage.classList.add("hidden");

            cityName.textContent = data.name;
            temperature.textContent = data.main.temp + " °C";
            weatherCondition.textContent = data.weather[0].description;
            humidity.textContent = "Humidity: " + data.main.humidity + "%";
            windSpeed.textContent = "Wind Speed: " + data.wind.speed + " m/s";

            feelsLike.textContent = "Feels Like: " + data.main.feels_like + " °C";

            weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
            weatherIcon.style.display = "block";
            getForecast(data.name);
        });

}



searchBtn.addEventListener("click", function () {

    const city = cityInput.value.trim();

    if (city === "") {
        errorMessage.textContent = "Please enter a city name.";
        errorMessage.classList.remove("hidden");
        return;
    }

    errorMessage.classList.add("hidden");

    getWeather(city);

});

cityInput.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {
        searchBtn.click();
    }

});

getWeather("Pune");

locationBtn.addEventListener("click", function () {

    if (navigator.geolocation) {

    navigator.geolocation.getCurrentPosition(function(position){

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        getWeatherByLocation(latitude, longitude);

    });

} else {

    alert("Geolocation is not supported by this browser.");

}

});