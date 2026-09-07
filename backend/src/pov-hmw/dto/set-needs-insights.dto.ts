import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/** Trim each entry before validating, so trailing spaces do not become content. */
const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
    : value;

export class SetNeedsInsightsDto {
  @IsArray()
  @Transform(trimEach)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  needs!: string[];

  @IsArray()
  @Transform(trimEach)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  insights!: string[];
}
