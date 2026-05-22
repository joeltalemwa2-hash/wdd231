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