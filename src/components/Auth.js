import React, { useState } from "react";

const API_URL = "http://localhost:5000";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanName = name.trim();
    const cleanMembershipId = membershipId.trim();

    if (!cleanName || !cleanMembershipId || !password) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          membershipId: cleanMembershipId,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Registration failed."
        );
      }

      setName("");
      setMembershipId("");
      setPassword("");
      setMode("login");
      setMessage(data.message || "Account created. Please log in.");
    } catch (err) {
      setError(
        err.message || "Cannot connect to the server. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanMembershipId = membershipId.trim();

    if (!cleanMembershipId || !password) {
      setError("Enter your membership ID and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          membershipId: cleanMembershipId,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log("LOGIN RESPONSE:", data);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Login failed."
        );
      }

      if (!data.user) {
        throw new Error(
          "The server did not return user details. Check the backend login route."
        );
      }

      if (!data.token || typeof data.token !== "string") {
        throw new Error(
          "The server response is missing the authentication token. " +
          "Save backend/server.js and restart the backend server."
        );
      }

      const loggedInUser = {
        ...data.user,
        token: data.token,
      };

      // Save the authentication token and user details.
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));

      // Notify the main application that login succeeded.
      onLogin(loggedInUser);
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the server. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((currentMode) =>
      currentMode === "login" ? "register" : "login"
    );
    setError("");
    setMessage("");
    setPassword("");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{mode === "login" ? "Login" : "Create Account"}</h2>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}

        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
        >
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter full name"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="membershipId">Membership ID</label>
            <input
              id="membershipId"
              type="text"
              value={membershipId}
              onChange={(event) =>
                setMembershipId(event.target.value)
              }
              placeholder="Enter membership ID"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "register"
                  ? "At least 6 characters"
                  : "Enter password"
              }
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 6 : undefined}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <p>
          {mode === "login"
            ? "Don't have an account? "
            : "Already have an account? "}

          <button
            type="button"
            disabled={loading}
            onClick={switchMode}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Auth;