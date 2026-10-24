export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'teacher' | 'student';
        // The session this request belongs to: lets a password change keep it
        // while signing out every other one.
        sessionId: string;
      };
    }
  }
}
