

import React, { useState, useEffect } from "react";
import BookForm from "../components/BookForm";
import BookList from "../components/BookList";
import { getBooks, deleteBook } from "../api";

function Books({ books = [], setBooks, loggedInUser }) {
  const [editingBook, setEditingBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin =
    String(loggedInUser?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    let active = true;

    async function loadBooks() {
      try {
        setLoading(true);
        setError("");

        const data = await getBooks();

        if (active) {
          setBooks(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load books.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBooks();

    return () => {
      active = false;
    };
  }, [setBooks]);

  const handleEdit = (book) => {
    if (!isAdmin) return;

    setEditingBook(book);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    if (!isAdmin || deletingId !== null) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this book?"
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");

    try {
      await deleteBook(id);

      setBooks((currentBooks) =>
        currentBooks.filter(
          (book) => String(book.id) !== String(id)
        )
      );

      setEditingBook((current) =>
        current && String(current.id) === String(id)
          ? null
          : current
      );
    } catch (err) {
      setError(err.message || "Could not delete the book.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h1>Book Management</h1>
      <p>View the community library collection.</p>

      {loading && <p>Loading books from the database...</p>}

      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}

      {!loading && !error && isAdmin && (
        <BookForm
          books={books}
          setBooks={setBooks}
          editingBook={editingBook}
          setEditingBook={setEditingBook}
          isAdmin={isAdmin}
        />
      )}

      {!loading && !error && (
        <BookList
          books={books}
          isAdmin={isAdmin}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {deletingId !== null && <p>Deleting book...</p>}
    </div>
  );
}

export default Books;

