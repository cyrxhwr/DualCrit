import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CastVoteDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  optionIds!: string[];
}
