// libs/auth/jwt.js

export function parseJwt(token) {
  try {
    return JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
  } catch (e) {
    console.error("❌ Erreur lors du décodage du JWT:", e);
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
