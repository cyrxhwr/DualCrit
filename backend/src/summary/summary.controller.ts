import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { SummaryService } from './summary.service';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';

@Controller('activities/:id/summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  /** Assembles the student's summary and stores it on the way out. */
  @Get()
  build(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.summary.build(id, student.id);
  }

  /**
   * The same for a POV & HMW activity.
   *
   * A separate route rather than a branch on the activity type, so the two
   * response shapes stay distinct and the interview summary — which is live —
   * is untouched by this.
   */
  @Get('pov-hmw')
  buildPovHmw(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.summary.buildPovHmw(id, student.id);
  }
}
