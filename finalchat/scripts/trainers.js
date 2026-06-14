const container =
document.querySelector("#trainersContainer");

const modal =
document.querySelector("#trainerModal");

const content =
document.querySelector("#modalContent");

async function getTrainers() {

try {

const response =
await fetch("data/trainers.json");

const trainers =
await response.json();

trainers.forEach(trainer => {

const card =
document.createElement("div");

card.innerHTML = `
<h3>${trainer.name}</h3>
<p>${trainer.specialty}</p>
<button>Details</button>
`;

card.querySelector("button")
.addEventListener("click", () => {

content.innerHTML = `
<h2>${trainer.name}</h2>
<p>${trainer.specialty}</p>
<p>${trainer.experience}</p>
<p>${trainer.certification}</p>
<p>${trainer.bio}</p>
`;

modal.showModal();

});

container.appendChild(card);

});

} catch(error) {

container.innerHTML =
"<p>Unable to load trainers.</p>";

}
}

document.querySelector("#closeModal")
.addEventListener("click", () => {
modal.close();
});

getTrainers();