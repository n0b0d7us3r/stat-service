import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { getUserById, type PublicUser } from '../services/authService.js';

const COOKIE_NAME = 'stat_session';

export interface AuthRequest extends Request {
  user?: PublicUser;
}

interface TokenPayload {
  userId: number;
}

export function signSessionToken(userId: number): string {
  return jwt.sign({ userId } satisfies TokenPayload, JWT_SECRET, { expiresIn: '30d' });
}

export function setSessionCookie(res: Response, token: string, remember: boolean): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : undefined,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function readToken(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const user = getUserById(payload.userId);

    if (!user) {
      res.status(401).json({ message: 'Сессия недействительна' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Сессия недействительна' });
  }
}

export { COOKIE_NAME };
