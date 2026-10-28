
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;

if (!AUTH_TOKEN_SECRET) {
  throw new Error(
    "AUTH_TOKEN_SECRET is missing from the backend .env file."
  );
}

app.use(cors());
app.use(express.json());

const roleNames = {
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

const validRoles = ["admin", "staff", "member"];

function normalizeRole(role) {
  return String(role || "member").trim().toLowerCase();
}

function createAuthToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: Number(user.id),
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", AUTH_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/);

  if (!match) {
    return res.status(401).json({
      message: "Authentication required. Please log in again.",
    });
  }

  const tokenParts = match[1].split(".");

  if (tokenParts.length !== 2) {
    return res.status(401).json({
      message: "Invalid authentication token.",
    });
  }

  const [payload, suppliedSignature] = tokenParts;

  const expectedSignature = crypto
    .createHmac("sha256", AUTH_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({
      message: "Invalid authentication token.",
    });
  }

  let tokenData;

  try {
    tokenData = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
  } catch {
    return res.status(401).json({
      message: "Invalid authentication token payload.",
    });
  }

  if (
    !Number.isInteger(tokenData.id) ||
    tokenData.id <= 0 ||
    !Number.isInteger(tokenData.exp) ||
    tokenData.exp <= Math.floor(Date.now() / 1000)
  ) {
    return res.status(401).json({
      message: "Your session has expired. Please log in again.",
    });
  }

  db.query(
    "SELECT id, name, membership_id, role FROM users WHERE id = ?",
    [tokenData.id],
    (err, results) => {
      if (err) {
        console.error("Authentication database error:", err);
        return res.status(500).json({
          message: "Could not verify the user.",
        });
      }

      if (!results.length) {
        return res.status(401).json({
          message: "User account no longer exists.",
        });
      }

      req.authUser = results[0];
      next();
    }
  );
}

function requireAdmin(req, res, next) {
  if (normalizeRole(req.authUser.role) !== "admin") {
    return res.status(403).json({
      message: "Administrator access is required.",
    });
  }

  next();
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    if (typeof storedHash !== "string" || !storedHash.includes(":")) {
      return resolve(false);
    }

    const [salt, keyHex] = storedHash.split(":");

    if (
      !salt ||
      !keyHex ||
      !/^[0-9a-f]+$/i.test(keyHex) ||
      keyHex.length !== 128
    ) {
      return resolve(false);
    }

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);

      const storedKey = Buffer.from(keyHex, "hex");

      resolve(crypto.timingSafeEqual(storedKey, derivedKey));
    });
  });
}

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    message: "Library Management API is running.",
    serverFile: __filename,
  });
});

// GET ALL USERS
app.get("/users", (req, res) => {
  db.query(
    `SELECT id, name, membership_id, role, created_at
     FROM users
     ORDER BY id ASC`,
    (err, results) => {
      if (err) {
        console.error("Get users error:", err);
        return res.status(500).json({
          message: "Failed to retrieve users.",
        });
      }

      res.json(
        results.map((user) => ({
          id: user.id,
          name: user.name,
          membershipId: user.membership_id,
          role: roleNames[normalizeRole(user.role)] || "Member",
          createdAt: user.created_at,
        }))
      );
    }
  );
});

// UPDATE USER — ADMIN ONLY
app.put("/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, membershipId, role } = req.body;
  const normalizedRole = normalizeRole(role);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !String(name || "").trim() ||
    !String(membershipId || "").trim() ||
    !validRoles.includes(normalizedRole)
  ) {
    return res.status(400).json({
      message: "A valid user ID, name, membership ID, and role are required.",
    });
  }

  db.query(
    `UPDATE users
     SET name = ?, membership_id = ?, role = ?
     WHERE id = ?`,
    [
      String(name).trim(),
      String(membershipId).trim(),
      normalizedRole,
      id,
    ],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message: "That membership ID is already in use.",
          });
        }

        console.error("Update user error:", err);
        return res.status(500).json({
          message: "Failed to update user.",
        });
      }

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "User not found, or no changes were made.",
        });
      }

      res.json({ message: "User updated successfully." });
    }
  );
});

// DELETE USER — ADMIN ONLY
app.delete("/users/:id", requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid user ID." });
  }

  if (Number(req.authUser.id) === id) {
    return res.status(400).json({
      message: "You cannot delete your own administrator account.",
    });
  }

  db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
    if (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
          message:
            "This user has transaction records and cannot be deleted. Preserve the transaction history.",
        });
      }

      console.error("Delete user error:", err);
      return res.status(500).json({
        message: "Failed to delete user.",
      });
    }

    if (!result.affectedRows) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  });
});

// REGISTER
app.post("/auth/register", async (req, res) => {
  const { name, membershipId, password } = req.body;

  if (
    !String(name || "").trim() ||
    !String(membershipId || "").trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      message: "Name, membership ID, and password are required.",
    });
  }

  try {
    const count = await new Promise((resolve, reject) => {
      db.query(
        "SELECT COUNT(*) AS total FROM users",
        (err, rows) => {
          if (err) return reject(err);
          resolve(Number(rows[0].total));
        }
      );
    });

    const role = count === 0 ? "admin" : "member";
    const passwordHash = await hashPassword(password);

    const result = await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO users
         (name, membership_id, role, password_hash)
         VALUES (?, ?, ?, ?)`,
        [
          String(name).trim(),
          String(membershipId).trim(),
          role,
          passwordHash,
        ],
        (err, insertResult) => {
          if (err) return reject(err);
          resolve(insertResult);
        }
      );
    });

    res.status(201).json({
      message: "Registration successful.",
      user: {
        id: result.insertId,
        name: String(name).trim(),
        membershipId: String(membershipId).trim(),
        role: roleNames[role],
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That membership ID is already registered.",
      });
    }

    console.error("Registration error:", err);
    res.status(500).json({ message: "Registration failed." });
  }
});

// LOGIN — ALWAYS RETURNS A TOKEN ON SUCCESS
app.post("/auth/login", async (req, res) => {
  console.log("LOGIN ROUTE HIT:", __filename);

  const { membershipId, password } = req.body;

  if (
    !String(membershipId || "").trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      message: "Membership ID and password are required.",
    });
  }

  try {
    const user = await new Promise((resolve, reject) => {
      db.query(
        `SELECT id, name, membership_id, role, password_hash
         FROM users
         WHERE membership_id = ?
         LIMIT 1`,
        [String(membershipId).trim()],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0] || null);
        }
      );
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid membership ID or password.",
      });
    }

    const passwordMatches = await verifyPassword(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid membership ID or password.",
      });
    }

    const token = createAuthToken(user);

    const response = {
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        membershipId: user.membership_id,
        role: roleNames[normalizeRole(user.role)] || "Member",
      },
    };

    console.log("Login successful for user ID:", user.id);
    console.log("Response fields:", Object.keys(response));
    console.log("Token included:", Boolean(response.token));

    return res.status(200).json(response);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      message: "Login failed due to a server error.",
    });
  }
});

// GET BOOKS
app.get("/books", (req, res) => {
  db.query("SELECT * FROM books ORDER BY id DESC", (err, results) => {
    if (err) {
      console.error("Get books error:", err);
      return res.status(500).json({
        message: "Failed to retrieve books.",
      });
    }

    res.json(results);
  });
});

// ADD BOOK — GENRE FIX
app.post("/books", (req, res) => {
  const { title, author, isbn, quantity, genre } = req.body;

  if (!String(title || "").trim() || !String(author || "").trim()) {
    return res.status(400).json({
      message: "Book title and author are required.",
    });
  }

  const bookGenre = String(genre || "General").trim() || "General";

  db.query(
    `INSERT INTO books (title, author, isbn, quantity, genre)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(title).trim(),
      String(author).trim(),
      isbn || null,
      Number.isFinite(Number(quantity)) ? Number(quantity) : 0,
      bookGenre,
    ],
    (err, result) => {
      if (err) {
        console.error("Add book error:", err);
        return res.status(500).json({
          message: "Failed to add book.",
          error: err.message,
        });
      }

      res.status(201).json({
        message: "Book added successfully.",
        id: result.insertId,
      });
    }
  );
});

// UPDATE BOOK — PRESERVE GENRE WHEN NOT PROVIDED
app.put("/books/:id", (req, res) => {
  const { title, author, isbn, quantity, genre } = req.body;
  const bookGenre = String(genre || "").trim() || null;

  db.query(
    `UPDATE books
     SET title = ?, author = ?, isbn = ?, quantity = ?,
         genre = COALESCE(?, genre)
     WHERE id = ?`,
    [
      title,
      author,
      isbn || null,
      Number(quantity) || 0,
      bookGenre,
      Number(req.params.id),
    ],
    (err, result) => {
      if (err) {
        console.error("Update book error:", err);
        return res.status(500).json({
          message: "Failed to update book.",
          error: err.message,
        });
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Book not found." });
      }

      res.json({ message: "Book updated successfully." });
    }
  );
});

// DELETE BOOK
app.delete("/books/:id", (req, res) => {
  db.query(
    "DELETE FROM books WHERE id = ?",
    [Number(req.params.id)],
    (err, result) => {
      if (err) {
        console.error("Delete book error:", err);
        return res.status(500).json({ message: "Failed to delete book." });
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Book not found." });
      }

      res.json({ message: "Book deleted successfully." });
    }
  );
});

// BORROW BOOK
app.post("/transactions/borrow", (req, res) => {
  const { userId, bookId } = req.body;

  if (!userId || !bookId) {
    return res.status(400).json({
      message: "User ID and book ID are required.",
    });
  }

  db.query(
    "SELECT id, quantity FROM books WHERE id = ?",
    [bookId],
    (bookErr, books) => {
      if (bookErr) {
        console.error("Borrow lookup error:", bookErr);
        return res.status(500).json({ message: "Failed to borrow book." });
      }

      if (!books.length) {
        return res.status(404).json({ message: "Book not found." });
      }

      if (Number(books[0].quantity) <= 0) {
        return res.status(400).json({
          message: "No copies of this book are available.",
        });
      }

      db.query(
        `INSERT INTO library_transactions
         (user_id, book_id, transaction_type, transaction_date)
         VALUES (?, ?, 'borrow', NOW())`,
        [userId, bookId],
        (insertErr, result) => {
          if (insertErr) {
            console.error("Borrow transaction error:", insertErr);
            return res.status(500).json({
              message: "Failed to create borrow transaction.",
            });
          }

          db.query(
            "UPDATE books SET quantity = quantity - 1 WHERE id = ?",
            [bookId],
            (updateErr) => {
              if (updateErr) {
                console.error("Book quantity update error:", updateErr);
                return res.status(500).json({
                  message: "Transaction was created, but book quantity could not be updated.",
                  transactionId: result.insertId,
                });
              }

              res.status(201).json({
                message: "Book borrowed successfully.",
                transactionId: result.insertId,
              });
            }
          );
        }
      );
    }
  );
});

// RETURN BOOK
app.post("/transactions/return", (req, res) => {
  const { userId, bookId } = req.body;

  if (!userId || !bookId) {
    return res.status(400).json({
      message: "User ID and book ID are required.",
    });
  }

  db.query(
    `SELECT id
     FROM library_transactions
     WHERE user_id = ?
       AND book_id = ?
       AND transaction_type = 'borrow'
       AND NOT EXISTS (
         SELECT 1
         FROM library_transactions AS returned
         WHERE returned.user_id = library_transactions.user_id
           AND returned.book_id = library_transactions.book_id
           AND returned.transaction_type = 'return'
           AND returned.id > library_transactions.id
       )
     ORDER BY id DESC
     LIMIT 1`,
    [userId, bookId],
    (lookupErr, rows) => {
      if (lookupErr) {
        console.error("Return lookup error:", lookupErr);
        return res.status(500).json({
          message: "Failed to check the borrow record.",
        });
      }

      if (!rows.length) {
        return res.status(400).json({
          message: "No outstanding borrow record was found for this book.",
        });
      }

      db.query(
        `INSERT INTO library_transactions
         (user_id, book_id, transaction_type, transaction_date)
         VALUES (?, ?, 'return', NOW())`,
        [userId, bookId],
        (insertErr, result) => {
          if (insertErr) {
            console.error("Return transaction error:", insertErr);
            return res.status(500).json({
              message: "Failed to return book.",
            });
          }

          db.query(
            "UPDATE books SET quantity = quantity + 1 WHERE id = ?",
            [bookId],
            (updateErr) => {
              if (updateErr) {
                console.error("Book quantity update error:", updateErr);
                return res.status(500).json({
                  message: "Return recorded, but book quantity could not be updated.",
                  transactionId: result.insertId,
                });
              }

              res.json({
                message: "Book returned successfully.",
                transactionId: result.insertId,
              });
            }
          );
        }
      );
    }
  );
});

// GET TRANSACTION HISTORY
app.get("/transactions", (req, res) => {
  db.query(
    `SELECT
       t.id,
       t.user_id AS userId,
       t.book_id AS bookId,
       t.transaction_type AS transactionType,
       t.transaction_date AS transactionDate,
       u.name AS userName,
       u.membership_id AS membershipId,
       b.title AS bookTitle
     FROM library_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN books b ON b.id = t.book_id
     ORDER BY t.transaction_date DESC, t.id DESC`,
    (err, results) => {
      if (err) {
        console.error("Get transactions error:", err);
        return res.status(500).json({
          message: "Failed to retrieve transactions.",
        });
      }

      res.json(results);
    }
  );
});

// START SERVER
function startServer() {
  db.query(
    `CREATE TABLE IF NOT EXISTS library_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      book_id INT NOT NULL,
      transaction_type ENUM('borrow', 'return') NOT NULL,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )`,
    (err) => {
      if (err) {
        console.error("Could not initialize library_transactions:", err);
        process.exit(1);
      }

      const server = app.listen(PORT, () => {
        console.log("======================================");
        console.log("LIBRARY MANAGEMENT BACKEND RUNNING");
        console.log("File:", __filename);
        console.log(`URL: http://localhost:${PORT}`);
        console.log("======================================");
      });

      server.on("error", (serverError) => {
        console.error("Backend server error:", serverError);
      });
    }
  );
}

startServer();
