import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middlware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import teacherRoutes from './modules/teacher/teacher.routes';

dotenv.config();

const app = express();

const frontendOrigin = new URL(
  process.env.FRONTEND_ORIGIN ??
    (process.env.NODE_ENV === 'production' ? 'https://diraya.vercel.app' : 'http://localhost:5173')
).origin;

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
