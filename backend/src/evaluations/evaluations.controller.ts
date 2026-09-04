import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';

@Controller('activities/:id/evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluations: EvaluationsService,
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
}
