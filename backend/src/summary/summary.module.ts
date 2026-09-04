import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [ActivitiesModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
