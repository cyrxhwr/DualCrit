import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

@Module({
  imports: [ActivitiesModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
