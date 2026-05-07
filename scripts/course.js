const courses = [
    {
        code: "WDD 130",
        subject: "WDD",
        credits: 2,
        completed: true
    },
    {
        code: "WDD 131",
        subject: "WDD",
        credits: 2,
        completed: true
    },
    {
        code: "WDD 231",
        subject: "WDD",
        credits: 2,
        completed: false
    },
    {
        code: "CSE 111",
        subject: "CSE",
        credits: 2,
        completed: true
    },
    {
        code: "CSE 210",
        subject: "CSE",
        credits: 2,
        completed: true
    },
    {
        code: "CSE 212",
        subject: "CSE",
        credits: 2,
        completed: false
    }

];

const coursesContainer = document.querySelector("#courses");
const credits = document.querySelector("#credits");

function displayCourses(courseList) {

    coursesContainer.innerHTML = "";

    courseList.forEach(course => {

        const div = document.createElement("div");

        div.classList.add("course");

        if (course.completed) {
            div.classList.add("completed");
        }

        div.textContent = course.code;

        coursesContainer.appendChild(div);
    });

    const totalCredits =
        courseList.reduce((sum, course) =>
        sum + course.credits, 0);

    credits.textContent = totalCredits;
}

displayCourses(courses);

document.querySelector("#all")
.addEventListener("click", () => {
    displayCourses(courses);
});

document.querySelector("#wdd")
.addEventListener("click", () => {

    const wddCourses =
        courses.filter(course =>
        course.subject === "WDD");

    displayCourses(wddCourses);
});

document.querySelector("#cse")
.addEventListener("click", () => {

    const cseCourses =
        courses.filter(course =>
        course.subject === "CSE");

    displayCourses(cseCourses);
});