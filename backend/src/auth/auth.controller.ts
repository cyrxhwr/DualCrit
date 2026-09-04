import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { AuthedStudent, CurrentStudent } from './current-student.decorator';
import { Public } from '../common/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('sign-in')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto);
  }

  /** Lets the frontend confirm a stored token is still good on load. */
  @Get('me')
  me(@CurrentStudent() student: AuthedStudent) {
    return { student };
  }
}
