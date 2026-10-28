import React, { useState, useEffect } from "react";
import UserForm from "../components/UserForm";
import UserList from "../components/UserList";

const API_URL = "http://localhost:5000";

function Users({ users = [], setUsers, loggedInUser, isAdmin }) {
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState(null);

  const admin =
    typeof isAdmin === "boolean"
      ? isAdmin
      : loggedInUser?.role?.toLowerCase() === "admin";

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/users`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Failed to load users."
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("The server returned an unexpected response.");
        }

        if (!cancelled) {
          setUsers(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not connect to the server.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (typeof setUsers === "function") {
      fetchUsers();
    } else {
      setError("User list configuration is missing.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [setUsers]);

  const handleEdit = (user) => {
    if (!admin) return;

    setEditingUser(user);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    if (!admin || deletingUserId !== null) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this user? This action cannot be undone."
    );

    if (!confirmed) return;

    const token =
      loggedInUser?.token || localStorage.getItem("token");

    if (!token) {
      window.alert("Your login session is missing. Please log in again as an admin.");
      return;
    }

    try {
      setDeletingUserId(id);
      setError("");

      const response = await fetch(`${API_URL}/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to delete the user."
        );
      }

      setUsers((previousUsers) =>
        previousUsers.filter((user) => user.id !== id)
      );

      if (editingUser?.id === id) {
        setEditingUser(null);
      }

      window.alert("User deleted successfully.");
    } catch (err) {
      window.alert(
        err.message || "Could not connect to the backend."
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div>
      <h1>User Management</h1>
      <p>View community library users and staff.</p>

      {admin && (
        <UserForm
          users={users}
          setUsers={setUsers}
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          isAdmin={admin}
        />
      )}

      <h2>Library Users</h2>

      {loading ? (
        <p>Loading users...</p>
      ) : error ? (
        <p role="alert">Unable to load users: {error}</p>
      ) : users.length === 0 ? (
        <p>No users have been added yet.</p>
      ) : (
        <UserList
          users={users}
          isAdmin={admin}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {deletingUserId !== null && (
        <p role="status">Deleting user...</p>
      )}
    </div>
  );
}

export default Users;