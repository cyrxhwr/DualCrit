import { IsNotEmpty, IsString, Length } from 'class-validator';

export class JoinActivityDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'A join code is 6 characters' })
  code!: string;
}
