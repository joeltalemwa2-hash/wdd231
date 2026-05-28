<<<<<<< HEAD
const spotlightURL =
"data/members.json";

const container =
document.querySelector("#spotlight-container");

async function getSpotlights() {

    const response =
    await fetch(spotlightURL);

    const data =
    await response.json();

    displaySpotlights(data);
}

function displaySpotlights(members) {

    const filtered =
    members.filter(member =>
    member.membership >= 2);

    const shuffled =
    filtered.sort(() => 0.5 - Math.random());

    const selected =
    shuffled.slice(0, 3);

    selected.forEach(member => {

        const card =
        document.createElement("section");

        card.classList.add("spotlight-card");

        card.innerHTML = `
        <h3>${member.name}</h3>

        <div class="spotlight-info">

        <img src="images/${member.image}"
             alt="${member.name}"
             width="100"
             height="100">

        <div>

        <p><strong>EMAIL:</strong> info@gmail.com</p>

        <p><strong>PHONE:</strong> ${member.phone}</p>

        <p>
        <strong>URL:</strong>
        ${member.website}
        </p>

        </div>

        </div>
        `;

        container.appendChild(card);
    });
}

=======
const spotlightURL =
"data/members.json";

const spotlightContainer =
document.querySelector("#spotlights");

async function getSpotlights() {

    const response =
    await fetch(spotlightURL);

    const data =
    await response.json();

    displaySpotlights(data);
}

function displaySpotlights(members) {

    const premiumMembers =
    members.filter(member =>
    member.membership >= 2);

    const shuffled =
    premiumMembers.sort(() => 0.5 - Math.random());

    const selected =
    shuffled.slice(0, 3);

    selected.forEach(member => {

        const card =
        document.createElement("div");

        card.classList.add("spotlight-card");

        const level =
        member.membership === 3
        ? "Gold"
        : "Silver";

        card.innerHTML = `
        <img src="images/${member.image}"
             alt="${member.name}"
             loading="lazy"
             width="100"
             height="100">

        <h3>${member.name}</h3>

        <p>${member.phone}</p>

        <p>${member.address}</p>

        <p>${level} Member</p>

        <a href="${member.website}"
           target="_blank">
           Visit Website
        </a>
        `;

        spotlightContainer.appendChild(card);
    });
}

>>>>>>> 9814f035b781fe729519086e1ac09306a338dbc3
getSpotlights();