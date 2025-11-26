import * as winston from 'winston'
import * as Sentry from '@sentry/node';
import Transport from 'winston-transport';
import { initSentry, setupUnhandledExceptionHandlers } from './sentry';

// Initialize Sentry and setup exception handlers
initSentry();
setupUnhandledExceptionHandlers();

const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport, {
  levels: ['error', 'warn'],
});

const logger: winston.Logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
      ),
    }),
    new SentryWinstonTransport(),
  ],
})

export default logger
