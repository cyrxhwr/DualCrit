import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ContributionsService,
  CONTRIBUTION_TYPES,
  type ContributionType,
} from './contributions.service';
import { SubmitContributionDto } from './dto/submit-contribution.dto';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';

function parseType(value: string): ContributionType {
  if ((CONTRIBUTION_TYPES as readonly string[]).includes(value)) {
    return value as ContributionType;
  }
  throw new BadRequestException(`Unknown contribution type: ${value}`);
}

@Controller('activities/:id/contributions/:type')
export class ContributionsController {
  constructor(
    private readonly contributions: ContributionsService,
    private readonly realtime: RealtimeBus,
  ) {}

  @Get()
  list(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ) {
    return this.contributions.list(id, student.id, parseType(type));
  }

  @Post()
  async submit(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Body() dto: SubmitContributionDto,
  ) {
    const contributionType = parseType(type);

    // A POV is a statement, not a question, and the readers downstream —
    // the evaluator and the POV screen — look for it under that key. Storing
    // everything as `question` left them reading an empty string, so every
    // POV was scored as if it were blank.
    const text = dto.text.trim();
    const content =
      contributionType === 'pov_statement'
        ? { statement: text }
        : { question: text };

    const mine = await this.contributions.submit(
      id,
      student.id,
      contributionType,
      content,
      dto.orderIndex ?? 1,
    );

    // Tell the room something changed. Each client re-reads for itself, so
    // nobody is sent another student's `isMine` flags.
    this.realtime.publish(id, 'contributions:changed', {
      activityId: id,
      type: contributionType,
    });

    return mine;
  }
}
