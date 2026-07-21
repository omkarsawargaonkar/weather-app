const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");

const cityName = document.getElementById("cityName");
const temperature = document.getElementById("temperature");
const weatherCondition = document.getElementById("weatherCondition");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");

searchBtn.addEventListener("click", function () {

    const city = cityInput.value.trim();

    if (city === "") {
        alert("Please enter a city name.");
        return;
    }

    const apiKey = "84f628bd3e048edbb99fed81c7b3e866";

const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

fetch(url)
    .then(function (response) {
        return response.json();
    })
    .then(function (data) {
        
        cityName.textContent = data.name;
temperature.textContent = data.main.temp + " °C";
weatherCondition.textContent = data.weather[0].description;
humidity.textContent = "Humidity: " + data.main.humidity + "%";
windSpeed.textContent = "Wind Speed: " + data.wind.speed + " m/s";
    });

});