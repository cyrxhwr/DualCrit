import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** Trim before validating, so " 20260001 " is accepted and "   " is not. */
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SignInDto {
  /**
   * The student's institutional ID. This is the only credential, so it
   * identifies rather than authenticates — see the note in the migration.
   *
   * Exactly eight digits: the first four are the year the student entered
   * the school. Enforced here and not only in the form, because this is the
   * key every activity, transcript and evaluation hangs off — a typo creates
   * a second, empty student rather than failing, and nothing later would
   * reveal that the two are the same person.
   */
  @IsString()
  @Transform(trimmed)
  @Matches(/^\d{8}$/, {
    message: 'Student ID must be exactly 8 digits',
  })
  studentId!: string;

  /** Used only when the student signs in for the first time. */
  @IsString()
  @Transform(trimmed)
  @IsNotEmpty({ message: 'Enter your full name' })
  @MaxLength(80)
  fullName!: string;
}
