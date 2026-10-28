
const API_URL = "http://localhost:5000";

export async function getBooks() {
  const response = await fetch(`${API_URL}/books`);

  if (!response.ok) {
    throw new Error("Failed to load books from the server.");
  }

  return response.json();
}

export async function addBook(book) {
  const response = await fetch(`${API_URL}/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(book),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to add book.");
  }

  return data;
}

export async function updateBook(id, book) {
  const response = await fetch(`${API_URL}/books/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(book),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to update book.");
  }

  return data;
}

export async function deleteBook(id) {
  const response = await fetch(`${API_URL}/books/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to delete book.");
  }

  return data;
}
