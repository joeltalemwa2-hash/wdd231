import { savePreference } from "./storage.js";

const container = document.querySelector("#programsContainer");
const filter = document.querySelector("#levelFilter");

let programs = [];

async function getPrograms() {

try {

const response =
await fetch("data/programs.json");

if (!response.ok) {
throw new Error("Data error");
}

programs = await response.json();

displayPrograms(programs);

} catch(error) {

container.innerHTML =
`<p>${error.message}</p>`;

}
}

function displayPrograms(list){

container.innerHTML = "";

list.forEach(program => {

container.innerHTML += `
<div class="card">

<h3>${program.name}</h3>

<p>Level: ${program.level}</p>

<p>Duration: ${program.duration}</p>

<p>Price: ${program.price}</p>

<p>${program.description}</p>

</div>
`;

});
}

filter.addEventListener("change", () => {

savePreference(filter.value);

const filtered =
filter.value === "all"
? programs
: programs.filter(
p => p.level === filter.value
);

displayPrograms(filtered);

});

getPrograms();