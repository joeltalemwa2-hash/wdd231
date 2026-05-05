const courses = [
  { code: "WDD130", subject: "WDD", credits: 2, completed: true },
  { code: "WDD131", subject: "WDD", credits: 2, completed: true },
  { code: "WDD231", subject: "WDD", credits: 2, completed: false },
  { code: "CSE110", subject: "CSE", credits: 2, completed: false }
];

const container = document.getElementById("courses");
const creditDisplay = document.getElementById("credits");

function displayCourses(list) {
  container.innerHTML = "";

  list.forEach(course => {
    const div = document.createElement("div");
    div.classList.add("course");

    if (course.completed) {
      div.classList.add("completed");
    }

    div.textContent = `${course.code} (${course.credits} credits)`;
    container.appendChild(div);
  });

  // reduce for credits
  const total = list.reduce((sum, c) => sum + c.credits, 0);
  creditDisplay.textContent = total;
}

// FILTERS
document.getElementById("all").addEventListener("click", () => {
  displayCourses(courses);
});

document.getElementById("wdd").addEventListener("click", () => {
  displayCourses(courses.filter(c => c.subject === "WDD"));
});

document.getElementById("cse").addEventListener("click", () => {
  displayCourses(courses.filter(c => c.subject === "CSE"));
});

// initial load
displayCourses(courses);