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

        const level =
        member.membership === 3
        ? "Gold"
        : "Silver";

        card.innerHTML = `
        <h3>${member.name}</h3>

        <div class="spotlight-info">

        <img src="images/${member.image}"
             alt="${member.name}"
             loading="lazy"
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

        spotlightContainer.appendChild(card);
    });
}

getSpotlights();

