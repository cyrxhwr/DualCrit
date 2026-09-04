import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SetStepDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  step!: string;
}
