let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchTerm = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const noteWord = notes.length === 1 ? "note" : "notes";
  return `${notes.length} ${noteWord}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === normalizedText);
}

function addNote(text, category) {
  if (typeof text !== "string") {
    console.log("Note text must be a string.");
    return false;
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note text must be 1-200 characters.");
    return false;
  }
  if (!["personal", "work", "study"].includes(category)) {
    console.log("Category must be personal, work, or study.");
    return false;
  }
  if (isDuplicate(trimmedText)) {
    console.log("A note with that text already exists.");
    return false;
  }

  const nextId = Math.max(0, ...notes.map((note) => note.id)) + 1;
  notes.push({ id: nextId, text: trimmedText, category });
  return true;
}

console.log(searchNotes("DAY 3")); // Expected: [{ id: 2, text: "Finish the Day 3 assignment", category: "study" }]
console.log(searchNotes("meeting")); // Expected: []

console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotes = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotes;

console.log(countByCategory()); // Expected: { personal: 2, work: 1, study: 2 }
notes = [];
console.log(countByCategory()); // Expected: { personal: 0, work: 0, study: 0 }
notes = savedNotes;

console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
notes = [];
console.log(getSummary()); // Expected: "0 notes: 0 personal, 0 work, 0 study."
notes = [savedNotes[0]];
console.log(getSummary()); // Expected: "1 note: 1 personal, 0 work, 0 study."
notes = savedNotes;

console.log(isDuplicate("  BUY MILK AND BREAD  ")); // Expected: true
console.log(isDuplicate("Buy oat milk")); // Expected: false

console.log(addNote("Plan the weekend", "personal")); // Expected: true
console.log(addNote("   ", "personal")); // Expected: "Note text must be 1-200 characters." then false
console.log(addNote("Plan the weekend", "study")); // Expected: "A note with that text already exists." then false
console.log(addNote("A".repeat(201), "work")); // Expected: "Note text must be 1-200 characters." then false
console.log(addNote("Prepare report", "other")); // Expected: "Category must be personal, work, or study." then false