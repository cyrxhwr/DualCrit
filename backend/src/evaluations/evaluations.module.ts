import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { PovHmwEvaluationsService } from './pov-hmw-evaluations.service';
import { PovHmwModule } from '../pov-hmw/pov-hmw.module';

@Module({
  imports: [ActivitiesModule, PovHmwModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, PovHmwEvaluationsService],
})
export class EvaluationsModule {}
