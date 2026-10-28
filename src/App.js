
import React from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Books from "./pages/Books";
import Transactions from "./pages/Transactions";
import Users from "./pages/Users";
import Auth from "./components/Auth";

import useLocalStorage from "./hooks/useLocalStorage";

import {
  initialBooks,
  initialUsers,
  initialTransactions,
} from "./data/initialData";

import "./App.css";

function AppContent() {
  const [books, setBooks] = useLocalStorage(
    "libraryBooks",
    initialBooks
  );

  const [users, setUsers] = useLocalStorage(
    "libraryUsers",
    initialUsers
  );

  const [transactions, setTransactions] = useLocalStorage(
    "libraryTransactions",
    initialTransactions
  );

  const [loggedInUser, setLoggedInUser] = useLocalStorage(
    "loggedInUser",
    null
  );

  const role = String(loggedInUser?.role || "").toLowerCase();

  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isMember = role === "member";

  const handleLogout = () => {
    setLoggedInUser(null);
  };

  return (
    <>
      {!loggedInUser ? (
        <Routes>
          <Route
            path="/login"
            element={
              <Auth
                users={users}
                setUsers={setUsers}
                onLogin={setLoggedInUser}
              />
            }
          />

          <Route
            path="/register"
            element={
              <Auth
                users={users}
                setUsers={setUsers}
                onLogin={setLoggedInUser}
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      ) : (
        <>
          <Navbar loggedInUser={loggedInUser} />

          <main>
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    books={books}
                    users={users}
                    transactions={transactions}
                    loggedInUser={loggedInUser}
                  />
                }
              />

              <Route
                path="/books"
                element={
                  <Books
                    books={books}
                    setBooks={setBooks}
                    loggedInUser={loggedInUser}
                  />
                }
              />

              <Route
                path="/transactions"
                element={
                  <Transactions
                    books={books}
                    setBooks={setBooks}
                    transactions={transactions}
                    setTransactions={setTransactions}
                    users={users}
                    loggedInUser={loggedInUser}
                    isAdmin={isAdmin}
                    isStaff={isStaff}
                    isMember={isMember}
                  />
                }
              />

              <Route
                path="/users"
                element={
                  <Users
                    users={users}
                    setUsers={setUsers}
                    loggedInUser={loggedInUser}
                    isAdmin={isAdmin}
                  />
                }
              />

              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
            </Routes>
          </main>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </>
      )}
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
export default App;
