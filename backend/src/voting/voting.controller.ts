import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { VotingService, VOTE_TYPES, type VoteType } from './voting.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';
import { BadRequestException } from '@nestjs/common';

function parseType(value: string): VoteType {
  if ((VOTE_TYPES as readonly string[]).includes(value))
    return value as VoteType;
  throw new BadRequestException(`Unknown vote type: ${value}`);
}

@Controller('activities/:id/voting/:type')
export class VotingController {
  constructor(
    private readonly voting: VotingService,
    private readonly realtime: RealtimeBus,
  ) {}

  @Get()
  async state(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ) {
    const voteType = parseType(type);
    const [state, myVote] = await Promise.all([
      this.voting.getState(id, student.id, voteType),
      this.voting.getMyVote(id, student.id, voteType),
    ]);
    return { state, myVote };
  }

  /** Safe to call repeatedly — returns the running round rather than resetting. */
  @Post('start')
  async start(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ) {
    // How many options a vote picks is decided by the server, from the type.
    // A body sent by an older page is simply ignored.
    const state = await this.voting.startOrGet(id, student.id, parseType(type));
    this.realtime.publish(id, 'voting:state', state);
    return state;
  }

  @Post('vote')
  async vote(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Body() dto: CastVoteDto,
  ) {
    const state = await this.voting.castVote(
      id,
      student.id,
      parseType(type),
      dto.optionIds,
    );
    this.realtime.publish(id, 'voting:state', state);

    // A finished round writes the team's choice onto the activity, which is
    // what decides the next step. Tell the room so nobody has to reload.
    if (state.status === 'completed') {
      this.realtime.publish(id, 'activity:updated', { activityId: id });
    }

    return state;
  }
}
