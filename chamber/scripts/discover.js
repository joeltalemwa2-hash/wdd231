import { places } from "../data/places.mjs";

const container = document.querySelector("#discover-grid");

places.forEach(place => {

    const card = document.createElement("article");

    card.innerHTML = `
        <h2>${place.name}</h2>

        <figure>
            <img
                src="${place.image}"
                alt="${place.name}"
                loading="lazy"
                width="300"
                height="200">
        </figure>

        <address>${place.address}</address>

        <p>${place.description}</p>

        <button>Learn More</button>
    `;

    container.appendChild(card);
});

const message = document.querySelector("#visit-message");

const lastVisit = localStorage.getItem("lastVisit");

const now = Date.now();

if (!lastVisit) {

    message.textContent =
    "Welcome! Let us know if you have any questions.";

} else {

    const days =
    Math.floor((now - Number(lastVisit)) /
    (1000 * 60 * 60 * 24));

    if (days < 1) {

        message.textContent =
        "Back so soon! Awesome!";

    } else if (days === 1) {

        message.textContent =
        "You last visited 1 day ago.";

    } else {

        message.textContent =
        `You last visited ${days} days ago.`;
    }
}

localStorage.setItem("lastVisit", now);