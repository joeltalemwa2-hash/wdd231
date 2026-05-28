const apiKey = "YOUR_API_KEY";

const url =
`https://api.openweathermap.org/data/2.5/forecast?lat=0.3476&lon=32.5825&units=imperial&appid=${apiKey}`;

async function getWeather() {

    const response =
    await fetch(url);

    const data =
    await response.json();

    displayWeather(data);
}

function displayWeather(data) {

    document.querySelector("#current-temp")
    .textContent =
    Math.round(data.list[0].main.temp);

    document.querySelector("#weather-desc")
    .textContent =
    data.list[0].weather[0].description;

    document.querySelector("#humidity")
    .textContent =
    `Humidity: ${data.list[0].main.humidity}%`;

    const forecast =
    document.querySelector("#forecast");

    const days = [8, 16, 24];

    days.forEach(day => {

        const p =
        document.createElement("p");

        p.innerHTML =
        `${Math.round(data.list[day].main.temp)}°F`;

        forecast.appendChild(p);
    });
}

getWeather();
