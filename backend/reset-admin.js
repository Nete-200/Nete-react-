
const crypto = require("crypto");
const db = require("./config/db");

const password = "TEST1001";
const salt = crypto.randomBytes(16).toString("hex");

crypto.scrypt(password, salt, 64, (err, key) => {
  if (err) {
    console.error("Password hashing failed:", err.message);
    if (typeof db.end === "function") {
      db.end();
    }
    return;
  }

  const passwordHash = `${salt}:${key.toString("hex")}`;

  db.query(
    "UPDATE users SET password_hash = ? WHERE membership_id = ? AND role = 'admin'",
    [passwordHash, "TEST1001"],
    (error, result) => {
      if (error) {
        console.error("Database update failed:", error.message);
      } else if (result.affectedRows === 1) {
        console.log("Admin password reset successfully!");
        console.log("Membership ID: TEST1001");
        console.log("Password: TEST1001");
      } else {
        console.log(
          "No admin account found with membership ID TEST1001."
        );
      }

      if (typeof db.end === "function") {
        db.end();
      }
    }
  );
});
