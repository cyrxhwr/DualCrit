import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { PovHmwEvaluationsService } from './pov-hmw-evaluations.service';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';

@Controller('activities/:id/evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluations: EvaluationsService,
    private readonly povHmwEvaluations: PovHmwEvaluationsService,
    private readonly realtime: RealtimeBus,
  ) {}

  /**
   * The team's feedback on their chosen question.
   *
   * Safe to call from every member: the first call generates, the rest read
   * the stored row.
   */
  @Post('question')
  async questionFeedback(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.evaluations.getOrCreateQuestionFeedback(
      id,
      student.id,
    );

    if (result.evaluation) {
      this.realtime.publish(id, 'evaluation:ready', {
        activityId: id,
        evaluationType: 'pre_question_eval',
      });
    }

    return result;
  }

  /** Feedback on this student's own interview, with transcript annotations. */
  @Post('interview')
  interviewFeedback(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.getOrCreateInterviewFeedback(id, student.id);
  }

  @Get('question')
  read(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.readQuestionFeedback(id, student.id);
  }

  /**
   * Every member's POV statement, scored together.
   *
   * Team-scoped like the interview question: the first caller generates and
   * the rest read the same row, so one team costs one call.
   */
  @Post('pov')
  async povFeedback(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.povHmwEvaluations.getOrCreatePovFeedback(
      id,
      student.id,
    );

    if (result.evaluation) {
      this.realtime.publish(id, 'evaluation:ready', {
        activityId: id,
        evaluationType: 'pov_feedback',
      });
    }

    return result;
  }

  /** The student's own HMW questions and the team's selected three. */
  @Post('hmw')
  hmwFeedback(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.povHmwEvaluations.getOrCreateHmwFeedback(id, student.id);
  }
}
