
import React, { useState } from "react";

function LoginForm({ users, setLoggedInUser }) {
  const [membershipId, setMembershipId] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();

    const enteredId = membershipId.trim();

    if (!enteredId) {
      setIsError(true);
      setMessage("Please enter your membership ID.");
      return;
    }

    const user = users.find(
      (item) =>
        String(item.membershipId ?? "").toLowerCase() ===
        enteredId.toLowerCase()
    );

    if (!user) {
      setIsError(true);
      setMessage("User not found. Please check your membership ID.");
      return;
    }

    // Store the logged-in user for the rest of the application.
    setLoggedInUser({
      ...user,
      id: user.id,
      membershipId: user.membershipId,
      name: user.name,
      role: user.role,
    });

    setIsError(false);
    setMessage(`Welcome, ${user.name}! You are logged in as ${user.role}.`);
  };

  return (
    <div className="form-card">
      <h2>Library Login</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="membership-id">Membership ID</label>
          <input
            id="membership-id"
            type="text"
            value={membershipId}
            onChange={(event) => setMembershipId(event.target.value)}
            placeholder="Enter membership ID"
            required
          />
        </div>

        <div className="form-buttons">
          <button type="submit" className="primary-button">
            Login
          </button>
        </div>
      </form>

      {message && (
        <div
          className={isError ? "error-message" : "success-message"}
          role={isError ? "alert" : "status"}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default LoginForm;
