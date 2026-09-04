import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';

@Module({
  imports: [ActivitiesModule],
  controllers: [InterviewController],
  providers: [InterviewService],
})
export class InterviewModule {}
