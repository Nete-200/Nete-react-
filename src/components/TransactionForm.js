


import React, { useState } from "react";

const API_URL = "http://localhost:5000";

function TransactionForm({
  books,
  setBooks,
  transactions,
  setTransactions,
  loggedInUser,
  isAdmin,
  isStaff,
  isMember,
}) {
  const [bookId, setBookId] = useState("");
  const [type, setType] = useState("Borrow");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // MySQL user_id is an INT, so use a numeric account ID.
  const rawUserId =
    loggedInUser?.id ?? loggedInUser?.userId ?? loggedInUser?.membershipId;

  const userId = Number(rawUserId);

  const userName =
    loggedInUser?.name ||
    loggedInUser?.username ||
    loggedInUser?.email ||
    "Unknown user";

  const canAddStock = Boolean(isAdmin || isStaff);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (loading) return;

    if (
      !loggedInUser ||
      rawUserId == null ||
      rawUserId === "" ||
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      userId > 2147483647
    ) {
      setError(
        "Your account has no valid numeric user ID. Please log out and log in again, or check your login code."
      );
      return;
    }

    if (!bookId) {
      setError("Please select a book.");
      return;
    }

    const amount = Number(quantity);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Quantity must be a whole number greater than 0.");
      return;
    }

    if (type === "Add Stock") {
      if (!canAddStock) {
        setError("Only Admin and Staff can add stock.");
        return;
      }

      setError(
        "Add Stock is not connected yet. Borrow and Return are supported."
      );
      return;
    }

    if (!["Borrow", "Return"].includes(type)) {
      setError("Invalid transaction type.");
      return;
    }

    const selectedBook = books.find(
      (book) => String(book.id) === String(bookId)
    );

    if (!selectedBook) {
      setError("Book not found. Please refresh the page.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId: Number(selectedBook.id),
          type,
          quantity: amount,
          userId,
          userName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.details
            ? `${result.error || "Transaction failed."} ${result.details}`
            : result.error || "Transaction failed."
        );
      }

      const [booksResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_URL}/books`),
        fetch(`${API_URL}/transactions`),
      ]);

      if (!booksResponse.ok || !transactionsResponse.ok) {
        throw new Error(
          "Transaction saved, but refreshing the data failed. Refresh the page."
        );
      }

      const latestBooks = await booksResponse.json();
      const latestTransactions = await transactionsResponse.json();

      const updatedBooks = latestBooks.map((book) => {
        const borrowed = latestTransactions.reduce((total, transaction) => {
          if (
            String(transaction.bookId ?? transaction.book_id) !==
            String(book.id)
          ) {
            return total;
          }

          if (transaction.type === "Borrow") {
            return total + Number(transaction.quantity);
          }

          if (transaction.type === "Return") {
            return total - Number(transaction.quantity);
          }

          return total;
        }, 0);

        return {
          ...book,
          available: Number(book.quantity) - borrowed,
        };
      });

      setBooks(updatedBooks);
      setTransactions(latestTransactions);
      setBookId("");
      setType("Borrow");
      setQuantity(1);
      setMessage(result.message || "Transaction completed successfully.");
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-card">
      <h2>Book Transactions</h2>

      <p>
        Logged in as: <strong>{userName}</strong>
      </p>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="transaction-book">Book</label>
          <select
            id="transaction-book"
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            required
          >
            <option value="">Select a book</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} - Available:{" "}
                {book.available ?? book.quantity ?? 0}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="transaction-type">Transaction Type</label>
          <select
            id="transaction-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="Borrow">Borrow Book</option>
            <option value="Return">Return Book</option>
            {canAddStock && (
              <option value="Add Stock">Add Stock</option>
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="transaction-quantity">Quantity</label>
          <input
            id="transaction-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </div>

        <div className="form-buttons">
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? "Processing..." : "Complete Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TransactionForm;
