document.querySelector("#timestamp").value =
    new Date().toISOString();
const npBtn = document.querySelector("#npBtn");
const npModal = document.querySelector("#npModal");

npBtn.addEventListener("click", () => {
    npModal.showModal();
});
document.querySelectorAll(".closeBtn")
.forEach(button => {

    button.addEventListener("click", () => {

        button.closest("dialog").close();

    });

});