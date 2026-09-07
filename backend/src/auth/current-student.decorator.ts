import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthedStudent {
  id: string;
  studentId: string;
  fullName: string;
}

/**
 * The signed-in student, taken from the verified token.
 *
 * Handlers must read identity from here and never from the request body —
 * a client-supplied user id is not evidence of anything.
 */
export const CurrentStudent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedStudent => {
    const request = ctx.switchToHttp().getRequest<{ student: AuthedStudent }>();
    return request.student;
  },
);
