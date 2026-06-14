const params = new URLSearchParams(window.location.search);

document.querySelector("#results").innerHTML = `
<p><strong>Name:</strong> ${params.get("name")}</p>
<p><strong>Email:</strong> ${params.get("email")}</p>
<p><strong>Trainer:</strong> ${params.get("trainer")}</p>
`;