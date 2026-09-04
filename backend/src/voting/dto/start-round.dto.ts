import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartRoundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSelections?: number;
}
