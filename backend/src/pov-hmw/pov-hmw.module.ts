import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { PovHmwController } from './pov-hmw.controller';
import { PovHmwService } from './pov-hmw.service';

@Module({
  imports: [ActivitiesModule],
  controllers: [PovHmwController],
  providers: [PovHmwService],
  exports: [PovHmwService],
})
export class PovHmwModule {}
