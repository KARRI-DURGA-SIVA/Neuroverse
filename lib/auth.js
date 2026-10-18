
import jwt from "jsonwebtoken";

const COOKIE_NAME = "neuroverse_token";

export function getAuthenticatedUser(req) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const index = cookie.indexOf("=");

      if (index === -1) {
        return [cookie.trim(), ""];
      }

      return [
        cookie.slice(0, index).trim(),
        decodeURIComponent(cookie.slice(index + 1).trim()),
      ];
    })
  );

  const token = cookies[COOKIE_NAME];

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.userId) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export function getUserFromReq(req) {
  const user = getAuthenticatedUser(req);
  return user ? { ...user, id: user.userId } : null;
}

export function signPasswordResetToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { purpose: "password_reset", id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

export function verifyPasswordResetToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== "password_reset" || !payload.id || !payload.email) {
    throw new Error("Invalid reset token");
  }

  return payload;
}

export function setAuthCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

export function clearAuthCookie(res) {
  const secure =
    process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}
