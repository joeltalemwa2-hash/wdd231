async function loadSpotlights() {
  const response = await fetch("data/members.json");
  const members = await response.json();

  // filter gold/silver
  const eligible = members.filter(m => m.membership === "Gold" || m.membership === "Silver");

  // pick 2–3 random
  const shuffled = eligible.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  const container = document.getElementById("spotlight-container");
  container.innerHTML = "";
  selected.forEach(member => {
    container.innerHTML += `
      <div class="spotlight-card">
        <img src="${member.logo}" alt="${member.name} logo">
        <h3>${member.name}</h3>
        <p>${member.address}</p>
        <p>${member.phone}</p>
        <a href="${member.website}" target="_blank">Visit Website</a>
        <p class="membership">${member.membership} Member</p>
      </div>
    `;
  });
}

loadSpotlights();