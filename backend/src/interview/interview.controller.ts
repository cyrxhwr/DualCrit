import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { AskDto } from './dto/ask.dto';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';

@Controller('activities/:id/interview')
export class InterviewController {
  constructor(
    private readonly interview: InterviewService,
    private readonly realtime: RealtimeBus,
  ) {}

  @Get()
  state(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interview.getState(id, student.id);
  }

  @Get('progress')
  progress(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interview.progress(id, student.id);
  }

  /** Everyone's interview, once the whole team has finished. */
  @Get('transcripts')
  transcripts(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interview.listTeamTranscripts(id, student.id);
  }

  @Post('ask')
  ask(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AskDto,
  ) {
    return this.interview.ask(id, student.id, dto.text);
  }

  @Post('complete')
  async complete(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.interview.complete(id, student.id);

    // Everyone's progress bar moves; the steps after this wait for the team.
    this.realtime.publish(id, 'interview:progress', { activityId: id });

    return this.interview.progress(id, student.id);
  }
}
