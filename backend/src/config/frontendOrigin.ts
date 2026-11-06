// The one address the browser app is served from.
//
// Used in two places: CORS/CSRF checks (app.ts) and the links we put in
// emails. It is a function, not a constant, so the environment is read when
// it is called, after dotenv has loaded the .env file.
export function getFrontendOrigin(): string {
  return new URL(
    process.env.FRONTEND_ORIGIN ??
      // Local default only: production must set it (checked in env.ts at start-up).
      'http://localhost:5173'
  ).origin;
}
