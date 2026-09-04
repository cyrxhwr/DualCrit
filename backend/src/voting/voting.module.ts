import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [ActivitiesModule, RealtimeModule],
  controllers: [VotingController],
  providers: [VotingService],
})
export class VotingModule {}
