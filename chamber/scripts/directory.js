const url = "data/members.json";

const container =
document.querySelector("#members");

async function getMembers() {

    const response = await fetch(url);

    const data = await response.json();

    displayMembers(data);
}

function displayMembers(members) {

    container.innerHTML = "";

    members.forEach(member => {

        const card =
        document.createElement("article");

        card.classList.add("member-card");

        card.innerHTML = `
            <img src="images/${member.image}"
                 alt="${member.name}"
                 loading="lazy"
                 width="120"
                 height="120">

            <h3>${member.name}</h3>

            <p>${member.address}</p>

            <p>${member.phone}</p>

            <a href="${member.website}"
               target="_blank">
               Visit Website
            </a>

            <p>${member.description}</p>
        `;

        container.appendChild(card);
    });
}

getMembers();

/* GRID / LIST TOGGLE */

document.querySelector("#grid")
.addEventListener("click", () => {

    container.classList.add("grid-view");

    container.classList.remove("list-view");
});

document.querySelector("#list")
.addEventListener("click", () => {

    container.classList.add("list-view");

    container.classList.remove("grid-view");
});