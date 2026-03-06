import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request } from "express";
import type { JwtPayload } from "@delvion/types";

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("AuditLog");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    const { method, url, user } = request;
    const userEmail = user?.email ?? "anonymous";
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `${method} ${url} — user=${userEmail} duration=${duration}ms`
        );
      })
    );
  }
}
