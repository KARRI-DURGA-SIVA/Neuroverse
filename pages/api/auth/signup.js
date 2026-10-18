
import bcrypt from "bcryptjs";
import pool from "../../../lib/db";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { name, email, password, age, bio, profilePic } =
      req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter your name, email and a password of at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, age, bio, profile_pic, credits)
       VALUES ($1, $2, $3, $4, $5, $6, 50)
       RETURNING id, name, email`,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        age ?? null,
        bio?.trim() || null,
        profilePic || null,
      ]
    );

    return res.status(201).json({
      message: "Account created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    return res.status(500).json({
      message: "Unable to create account",
    });
  }
}
