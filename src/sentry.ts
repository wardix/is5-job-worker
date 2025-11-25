import * as Sentry from '@sentry/node';
import { sentryDsn } from './config';

export function initSentry() {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
    enableLogs: true,
  });
}

export function setupUnhandledExceptionHandlers() {
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        handler: 'uncaughtException',
      },
    });

    Sentry.close(2000).then(() => {
      process.exit(1);
    });
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);

    const error = reason instanceof Error ? reason : new Error(String(reason));
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        handler: 'unhandledRejection',
      },
    });
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    Sentry.close(2000).then(() => {
      process.exit(0);
    });
  });
}
