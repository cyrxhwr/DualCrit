import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthedStudent } from './current-student.decorator';
import { IS_PUBLIC_KEY } from '../common/public.decorator';

interface TokenPayload {
  sub: string;
  studentId: string;
  fullName: string;
}

/**
 * Verifies the session token and attaches the student to the request.
 *
 * Applied globally, so a route is protected unless it opts out with
 * @Public(). Defaulting to protected is the point: the previous system left
 * every session-scoped endpoint open to anyone who knew a UUID.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { student?: AuthedStudent }>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sign in to continue');
    }

    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(
        header.slice('Bearer '.length),
      );
      request.student = {
        id: payload.sub,
        studentId: payload.studentId,
        fullName: payload.fullName,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Your session has expired');
    }
  }
}
