import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityLock } from './activity-lock';

@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityLock],
  exports: [ActivitiesService, ActivityLock],
})
export class ActivitiesModule {}
