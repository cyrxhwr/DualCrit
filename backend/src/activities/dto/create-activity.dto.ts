import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const ACTIVITY_TYPES = ['interview', 'pov_hmw'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  /**
   * Which workflow the team will run. Chosen once, by whoever creates the
   * activity, because it is a property of the team's work rather than of
   * one student's screen — everyone who joins the code does the same one.
   */
  @IsIn(ACTIVITY_TYPES)
  type!: ActivityType;
}
