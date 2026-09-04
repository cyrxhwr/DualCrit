import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ActivitiesModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
