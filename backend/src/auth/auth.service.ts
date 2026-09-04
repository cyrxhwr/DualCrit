import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { SignInDto } from './dto/sign-in.dto';
import { AuthedStudent } from './current-student.decorator';

interface StudentRow {
  id: string;
  student_id: string;
  full_name: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Sign in by student ID, creating the student on first use.
   *
   * The upsert is on the unique `student_id`, so signing in twice never
   * creates a second row — the duplicate-identity problem that made the
   * previous system lose work simply cannot occur.
   */
  async signIn(
    dto: SignInDto,
  ): Promise<{ token: string; student: AuthedStudent }> {
    const studentId = dto.studentId.trim().toUpperCase();
    const fullName = dto.fullName.trim();

    const { data, error } = await this.supabase.client
      .from('students')
      .upsert(
        { student_id: studentId, full_name: fullName },
        { onConflict: 'student_id' },
      )
      .select('id, student_id, full_name, role')
      .single<StudentRow>();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Could not sign in: ${error?.message ?? 'no student returned'}`,
      );
    }

    const student: AuthedStudent = {
      id: data.id,
      studentId: data.student_id,
      fullName: data.full_name,
    };

    const token = await this.jwt.signAsync({
      sub: student.id,
      studentId: student.studentId,
      fullName: student.fullName,
    });

    return { token, student };
  }
}
