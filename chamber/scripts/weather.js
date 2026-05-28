<<<<<<< HEAD
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
=======
const key = "YOUR_API_KEY";

const lat = 0.3476;
const lon = 32.5825;

const url =
`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`;

async function apiFetch() {

    try {

        const response = await fetch(url);

        if (response.ok) {

            const data = await response.json();

            displayWeather(data);

        } else {

            throw Error(await response.text());
        }

    } catch (error) {

        console.log(error);
    }
}

function displayWeather(data) {

    const currentTemp =
    document.querySelector("#current-temp");

    const weatherDesc =
    document.querySelector("#weather-desc");

    currentTemp.textContent =
    Math.round(data.list[0].main.temp);

    weatherDesc.textContent =
    data.list[0].weather[0].description;

    const forecast =
    document.querySelector("#forecast");

    forecast.innerHTML = "";

    const days = [8, 16, 24];

    days.forEach(day => {

        const item =
        document.createElement("div");

        item.classList.add("forecast-item");

        item.innerHTML = `
        <p>
        Day Forecast:
        ${Math.round(data.list[day].main.temp)}°F
        </p>
        `;

        forecast.appendChild(item);
    });
}

apiFetch();
>>>>>>> 9814f035b781fe729519086e1ac09306a338dbc3
