const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const draftKey = "quicknotes-draft";
const themeKey = "quicknotes-theme";

function updateCounts() {
  const characterTotal = noteText.value.length;
  const trimmedText = noteText.value.trim();
  const wordTotal = trimmedText ? trimmedText.split(/\s+/).length : 0;

  charCount.textContent = `${characterTotal} / 200 characters`;
  wordCount.textContent = `${wordTotal} ${wordTotal === 1 ? "word" : "words"}`;
  charCount.classList.toggle("warning", characterTotal > 180 && characterTotal <= 200);
  charCount.classList.toggle("over", characterTotal > 200);
}

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(draftKey);
  updateCounts();
}

function updateThemeButton() {
  themeToggle.textContent = document.body.classList.contains("dark") ? "Light mode" : "Dark mode";
}

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(draftKey, noteText.value);
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const theme = document.body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem(themeKey, theme);
  updateThemeButton();
});

noteText.value = localStorage.getItem(draftKey) || "";
if (localStorage.getItem(themeKey) === "dark") {
  document.body.classList.add("dark");
}
updateThemeButton();
updateCounts();