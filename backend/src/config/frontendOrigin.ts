// The one address the browser app is served from.
//
// Used in two places: CORS/CSRF checks (app.ts) and the links we put in
// emails. It is a function, not a constant, so the environment is read when
// it is called, after dotenv has loaded the .env file.
export function getFrontendOrigin(): string {
  return new URL(
    process.env.FRONTEND_ORIGIN ??
      (process.env.NODE_ENV === 'production' ? 'https://diraya.vercel.app' : 'http://localhost:5173')
  ).origin;
}
