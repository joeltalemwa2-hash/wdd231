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

getSpotlights();