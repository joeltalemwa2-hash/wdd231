const url = "data/members.json";
const container = document.getElementById("members");

// Fetch Data
async function getMembers() {
    const response = await fetch(url);
    const data = await response.json();
    displayMembers(data.members);
}

getMembers();

// Display Members
function displayMembers(members) {
    container.innerHTML = "";

    members.forEach(member => {
        const card = document.createElement("div");
        card.classList.add("card");

        card.innerHTML = `
            <h3>${member.name}</h3>
            <img src="images/${member.image}" alt="${member.name}" width="150">
            <p>${member.address}</p>
            <p>${member.phone}</p>
            <a href="${member.website}" target="_blank">Visit Website</a>
        `;

        container.appendChild(card);
    });
}

// Toggle Views
document.getElementById("gridBtn").addEventListener("click", () => {
    container.classList.add("grid");
    container.classList.remove("list");
});

document.getElementById("listBtn").addEventListener("click", () => {
    container.classList.add("list");
    container.classList.remove("grid");
});

// Footer Dates
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("lastModified").textContent = document.lastModified;

// Menu Toggle
document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("navMenu").classList.toggle("open");
});