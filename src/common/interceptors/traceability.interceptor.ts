import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AppLogger } from '../logger/logger.service';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const httpContext = context.switchToHttp();

    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const incomingCorrelationId = request.headers['x-correlation-id'];

    const correlationId =
      typeof incomingCorrelationId === 'string' &&
      incomingCorrelationId.trim().length > 0
        ? incomingCorrelationId
        : randomUUID();

    const startTime = Date.now();

    request.correlationId = correlationId;

    response.setHeader('x-correlation-id', correlationId);

    return next.handle().pipe(
      finalize(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const statusText = `${statusCode} ${this.getStatusText(statusCode)}`;

        this.logger.logWithTrace(
          correlationId,
          'TRACE',
          `[TRACE] [${request.method} ${request.originalUrl}] [${statusText}] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`,
        );
      }),
    );
  }

  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return statusTexts[statusCode] ?? 'Unknown Status';
  }
}