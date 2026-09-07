import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { PovHmwService } from './pov-hmw.service';
import { SetNeedsInsightsDto } from './dto/set-needs-insights.dto';
import {
  AuthedStudent,
  CurrentStudent,
} from '../auth/current-student.decorator';
import { RealtimeBus } from '../realtime/realtime.bus';

@Controller('activities/:id/pov-hmw')
export class PovHmwController {
  constructor(
    private readonly povHmw: PovHmwService,
    private readonly realtime: RealtimeBus,
  ) {}

  @Get()
  get(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.povHmw.get(id, student.id);
  }

  /** Host only. Broadcast so the waiting members move on without a reload. */
  @Post()
  async set(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetNeedsInsightsDto,
  ) {
    const data = await this.povHmw.set(id, student.id, dto.needs, dto.insights);
    this.realtime.publish(id, 'pov-hmw:needs_insights', {
      activityId: id,
      ...data,
    });
    return data;
  }
}
