import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SignInDto {
  /**
   * The student's institutional ID. This is the only credential, so it
   * identifies rather than authenticates — see the note in the migration.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'studentId may contain only letters, numbers and hyphens',
  })
  studentId!: string;

  /** Used only when the student signs in for the first time. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fullName!: string;
}
