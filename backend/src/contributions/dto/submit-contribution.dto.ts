import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitContributionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;

  /** Which slot this fills — HMW questions use 1..3, the rest use 1. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  orderIndex?: number;
}
