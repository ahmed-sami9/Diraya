import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middlware/errorHandler';
import { getFrontendOrigin } from './config/frontendOrigin';

import authRoutes from './modules/auth/auth.routes';
import teacherRoutes from './modules/teacher/teacher.routes';

dotenv.config();

const app = express();

// Hosting platforms (Render, Railway, Fly...) put a proxy in front of the app,
// so every request appears to come from the proxy's address. Without this
// line the rate limiters would count ALL visitors as one person, and a few
// failed logins by anyone would lock everybody out. With it, Express reads
// the real visitor address that the proxy passes along.
//
// "1" means: trust exactly one proxy. Locally there is none, so it stays off.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const frontendOrigin = getFrontendOrigin();

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Browser API CSRF protection:
// require an exact trusted Origin on state-changing requests.
app.use('/api/v1', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  if (req.get('origin') !== frontendOrigin) {
    res.status(403).json({
      code: 'UNTRUSTED_ORIGIN',
      message: 'Request origin is not allowed.',
    });
    return;
  }

  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/teacher', teacherRoutes);

app.get('/', (_req, res) => {
  res.send('Hello from the backend');
});

app.use(errorHandler);

export default app;
