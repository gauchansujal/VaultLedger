import express, { Application, NextFunction, Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import multer from 'multer';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import auditLogRouter from './routes/auditLog.routes';
import userRouter from './routes/user.routes';
import transactionRouter from './routes/transaction.routes';
import adminRouter from './routes/admin.routes';

export function createApp(): Application {
  const app = express();

  // Trust first proxy (needed for correct client IP behind a load balancer/reverse proxy,
  // which matters for rate limiting and audit logs)
  app.set('trust proxy', 1);

  // --- Security headers ---
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  // --- CORS: only the known frontend origin, credentials allowed for httpOnly cookies ---
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
  );

  // --- Body parsing with size limits (mitigates payload-based DoS) ---
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // --- Sanitization: strips $ and . operators from req.body/query/params to block NoSQL injection ---
  app.use(mongoSanitize());

  // --- HTTP Parameter Pollution protection ---
  app.use(hpp());

  // --- Logging (dev only; production logging goes through the audit log service, not stdout) ---
  if (env.nodeEnv !== 'production') {
    app.use(morgan('dev'));
  }

  // --- Health check (unauthenticated, no sensitive data) ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // --- Static avatar serving ---
  // Read-only, no directory listing, no dotfiles, cache headers set - filenames served
  // here are always server-generated UUIDs (see user.controller.ts uploadAvatar), never
  // derived from user input, so there is no path traversal surface here.
  app.use(
    '/uploads/avatars',
    express.static(path.join(process.cwd(), 'uploads', 'avatars'), {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
    })
  );

  // --- Routes ---
  app.use('/api/auth', authRouter);
  app.use('/api/audit-log', auditLogRouter);
  app.use('/api/users', userRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/admin', adminRouter);

  // --- 404 handler ---
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not found' });
  });

  // --- Upload-specific error handling (file too large, wrong type) - must return 400,
  // not fall through to the generic 500 handler below ---
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 2MB' : 'Upload failed';
      res.status(400).json({ message });
      return;
    }
    if (err.message?.includes('Only JPEG, PNG, or WEBP')) {
      res.status(400).json({ message: err.message });
      return;
    }
    next(err);
  });

  // --- Centralized error handler (never leak stack traces in production) ---
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const isDev = env.nodeEnv !== 'production';
    res.status(500).json({
      message: 'Internal server error',
      ...(isDev ? { error: err.message, stack: err.stack } : {}),
    });
  });

  return app;
}
