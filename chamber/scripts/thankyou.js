const params =
    new URLSearchParams(window.location.search);

document.querySelector("#first").textContent =
    `First Name: ${params.get("fname")}`;

document.querySelector("#last").textContent =
    `Last Name: ${params.get("lname")}`;

document.querySelector("#email").textContent =
    `Email: ${params.get("email")}`;

document.querySelector("#phone").textContent =
    `Phone: ${params.get("phone")}`;

document.querySelector("#business").textContent =
    `Organization: ${params.get("organization")}`;

document.querySelector("#date").textContent =
    `Submitted: ${params.get("timestamp")}`;