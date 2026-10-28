
import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

const emptyForm = {
  name: "",
  membershipId: "",
  role: "Member",
};

function UserForm({
  users = [],
  setUsers,
  editingUser,
  setEditingUser,
  isAdmin = false,
}) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name || "",
        membershipId: editingUser.membershipId || "",
        role:
          editingUser.role?.charAt(0).toUpperCase() +
            editingUser.role?.slice(1).toLowerCase() || "Member",
      });
    } else {
      setFormData({ ...emptyForm });
    }

    setError("");
    setMessage("");
  }, [editingUser]);

  if (!isAdmin) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isAdmin) {
      setError("Only an Admin can manage users.");
      return;
    }

    const name = formData.name.trim();
    const membershipId = formData.membershipId.trim();
    const role = formData.role.toLowerCase();

    if (!name || !membershipId) {
      setError("Please complete all fields.");
      return;
    }

    if (!["member", "staff", "admin"].includes(role)) {
      setError("Please select a valid role.");
      return;
    }

    const duplicateId = users.some(
      (user) =>
        user.membershipId?.toLowerCase() ===
          membershipId.toLowerCase() &&
        String(user.id) !== String(editingUser?.id)
    );

    if (duplicateId) {
      setError("This membership ID already exists.");
      return;
    }

    if (!editingUser) {
      setError(
        "New accounts must be created through registration. Select an existing user to edit their details."
      );
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Your session token is missing. Please log in again.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            membershipId,
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to update user."
        );
      }

      const updatedUser = {
        ...editingUser,
        name,
        membershipId,
        role: role.charAt(0).toUpperCase() + role.slice(1),
      };

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          String(user.id) === String(editingUser.id)
            ? { ...user, ...updatedUser }
            : user
        )
      );

      setEditingUser(null);
      setFormData({ ...emptyForm });
      setMessage("User updated successfully in the database.");
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setFormData({ ...emptyForm });
    setError("");
    setMessage("");
  };

  return (
    <div className="form-card">
      <h2>{editingUser ? "Update User" : "Edit Existing User"}</h2>

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

      {!editingUser && (
        <p>Select Update beside a user in the table to edit their details.</p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="user-name">Name</label>
          <input
            id="user-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter user name"
            required
            disabled={!editingUser || loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="user-membership-id">Membership ID</label>
          <input
            id="user-membership-id"
            name="membershipId"
            value={formData.membershipId}
            onChange={handleChange}
            placeholder="Enter membership ID"
            required
            disabled={!editingUser || loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="user-role">Role</label>
          <select
            id="user-role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            disabled={!editingUser || loading}
          >
            <option value="Member">Member</option>
            <option value="Staff">Staff</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <div className="form-buttons">
          <button
            type="submit"
            className="primary-button"
            disabled={!editingUser || loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>

          {editingUser && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default UserForm;
