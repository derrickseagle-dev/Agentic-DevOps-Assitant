import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "pipelineforge-dev-jwt-secret-change-in-prod";
const JWT_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: string;
  teamId?: string;
}

export function signToken(payload: JwtPayload, expiresIn: string = JWT_EXPIRES_IN): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
