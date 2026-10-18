
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../../../lib/db";
import { setAuthCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      message: "Method not allowed",
    });
  }

  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return res.status(500).json({
        message: "Authentication is not configured",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await query(
      `SELECT id, name, email, password_hash,
              age, bio, profile_pic, credits, created_at
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (
      typeof user.password_hash !== "string" ||
      !user.password_hash
    ) {
      console.error("User has no password hash:", user.id);

      return res.status(500).json({
        message: "Account password data needs to be checked",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setAuthCookie(res, token);

    const {
      password_hash,
      ...safeUser
    } = user;

    return res.status(200).json({
      message: "Login successful",
      user: safeUser,
    });
  } catch (error) {
    console.error("Login API error:", error);

    return res.status(500).json({
      message: "Login failed due to a server error",
    });
  }
}
