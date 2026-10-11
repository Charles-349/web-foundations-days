const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const usersUrl = "https://jsonplaceholder.typicode.com/users";
let users = [];

function renderUsers(list) {
  usersList.replaceChildren();

  for (const user of list) {
    const listItem = document.createElement("li");
    listItem.className = "user-item";

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    listItem.append(name, email, city, company);
    usersList.append(listItem);
  }
}

async function loadUsers() {
  loadButton.disabled = true;
  statusMessage.textContent = "Loading users...";

  try {
    const response = await fetch(usersUrl);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    users = await response.json();
    const searchTerm = filterInput.value.trim().toLowerCase();
    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchTerm));
    renderUsers(filteredUsers);
    statusMessage.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    renderUsers(users);
    statusMessage.textContent = "Unable to load users. Please try again.";
    console.error("Could not load users:", error);
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const searchTerm = filterInput.value.trim().toLowerCase();
  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchTerm));

  renderUsers(filteredUsers);
  statusMessage.textContent = filteredUsers.length === 0
    ? "No users match your filter."
    : `Showing ${filteredUsers.length} of ${users.length} users.`;
});