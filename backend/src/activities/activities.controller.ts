import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { JoinActivityDto } from './dto/join-activity.dto';
import { SetStepDto } from './dto/set-step.dto';
import { AuthedStudent, CurrentStudent } from '../auth/current-student.decorator';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  /** The dashboard list. */
  @Get()
  list(@CurrentStudent() student: AuthedStudent) {
    return this.activities.listForStudent(student.id);
  }

  @Post()
  create(
    @CurrentStudent() student: AuthedStudent,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activities.create(student.id, dto.name, dto.type);
  }

  @Post('join')
  join(
    @CurrentStudent() student: AuthedStudent,
    @Body() dto: JoinActivityDto,
  ) {
    return this.activities.join(student.id, dto.code);
  }

  /** Called as the student moves through the workflow, so Continue works. */
  @Post(':id/step')
  async setStep(
    @CurrentStudent() student: AuthedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStepDto,
  ) {
    await this.activities.setStep(id, student.id, dto.step);
    return { ok: true };
  }
}
