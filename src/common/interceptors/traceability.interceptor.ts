import { randomUUID } from 'node:crypto';

import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { AppLogger } from '../logger/logger.service';
import { traceStorage } from '../trace-context';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const httpContext = context.switchToHttp();

        const request = httpContext.getRequest<Request>();
        const response = httpContext.getResponse<Response>();

        const incomingCorrelationId = request.headers['x-correlation-id'];

        const correlationId =
            typeof incomingCorrelationId === 'string' && incomingCorrelationId.trim().length > 0
                ? incomingCorrelationId.trim()
                : randomUUID();

        const startTime = performance.now();

        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        const logTrace = (statusCode: number): void => {
            const duration = Math.round(performance.now() - startTime);
            const statusText = `${statusCode} ${this.getStatusText(statusCode)}`;

            this.logger.logWithTrace(
                correlationId,
                'TRACE',
                `[${request.method} ${request.originalUrl}] [${statusText}] [Duration: ${duration}ms]`,
            );
        };

        return traceStorage.run({ correlationId }, () =>
            next.handle().pipe(
                tap({
                    complete: () => logTrace(response.statusCode),
                }),
                catchError((error: unknown) => {
                    logTrace(this.resolveStatus(error, response));
                    return throwError(() => error);
                }),
            ),
        );
    }

    private resolveStatus(error: unknown, response: Response): number {
        if (error instanceof HttpException) {
            return error.getStatus();
        }

        return response.statusCode >= 400 ? response.statusCode : 500;
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
