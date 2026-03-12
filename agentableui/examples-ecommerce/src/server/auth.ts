// src/server/auth.ts

export interface UserSession {
  apiKey: string
  role: string
}

export class AuthService {
  static extractSessionKey(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null
    return authHeader.slice(7)
  }
}
