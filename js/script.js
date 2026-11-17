
// =========================
// MOBILE NAVIGATION
// =========================

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".navigation");

if (menuButton && navigation) {

    menuButton.addEventListener("click", () => {
        const isOpen = navigation.classList.toggle("active");

        menuButton.textContent = isOpen ? "✕" : "☰";
        menuButton.setAttribute("aria-expanded", isOpen);
    });

    const navigationLinks = navigation.querySelectorAll("a");

    navigationLinks.forEach(link => {
        link.addEventListener("click", () => {
            navigation.classList.remove("active");

            menuButton.textContent = "☰";
            menuButton.setAttribute("aria-expanded", "false");
        });
    });

}

// Close mobile menu after clicking a link

const navigationLinks = document.querySelectorAll(".navigation a");

navigationLinks.forEach(link => {
    link.addEventListener("click", () => {
        navigation.classList.remove("active");

        menuButton.textContent = "☰";
        menuButton.setAttribute("aria-expanded", "false");
    });
});

// =========================
// TOOL CARDS
// =========================

const toolCards = document.querySelectorAll(".tool-card");

toolCards.forEach(card => {

    card.addEventListener("click", () => {

        const toolName = card.querySelector("h4").textContent.trim();

        if (toolName === "Image Compressor") {
            window.location.href = "image-compressor.html";
            return;
        }

        alert(toolName + " is coming soon!");

    });

});

// =========================
// CONSOLE
// =========================

console.log("FileFix successfully initialized!");
// =========================
// THEME SYSTEM
// =========================

const themeToggle = document.getElementById("themeToggle");
const themeAuto = document.getElementById("themeAuto");

// Automatic theme based on the user's local time
function getAutomaticTheme() {
    const hour = new Date().getHours();

    return hour >= 7 && hour < 19 ? "light" : "dark";
}

// Load saved theme or use automatic mode
let savedTheme = localStorage.getItem("filefix-theme");

let currentTheme = savedTheme || getAutomaticTheme();

function applyTheme(theme) {
    currentTheme = theme;

    document.body.classList.toggle("dark-mode", theme === "dark");

    if (themeToggle) {
        themeToggle.classList.toggle("is-dark", theme === "dark");

        themeToggle.setAttribute(
            "aria-pressed",
            theme === "dark" ? "true" : "false"
        );

        themeToggle.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
        );
    }

    if (themeAuto) {
        themeAuto.classList.toggle(
            "active",
            !localStorage.getItem("filefix-theme")
        );
    }
}

// Apply theme when the page opens
if (themeToggle) {
    applyTheme(currentTheme);

    // Manual theme switching
    themeToggle.addEventListener("click", () => {
        const newTheme = currentTheme === "light" ? "dark" : "light";

        localStorage.setItem("filefix-theme", newTheme);

        applyTheme(newTheme);
    });
}
// =========================
// AUTOMATIC THEME MODE
// =========================

// Enable automatic theme
if (themeAuto) {
    themeAuto.addEventListener("click", () => {

        // Remove saved manual preference
        localStorage.removeItem("filefix-theme");

        // Apply theme based on local time
        applyTheme(getAutomaticTheme());

    });
}

// Check local time every minute
function updateAutomaticTheme() {
    const savedTheme = localStorage.getItem("filefix-theme");

    if (!savedTheme) {
        applyTheme(getAutomaticTheme());
    }
}

setInterval(updateAutomaticTheme, 60000);

// Update theme when the user returns to the tab
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        updateAutomaticTheme();
    }
});