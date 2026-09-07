import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from './supabase/supabase.module';
import { RealtimeBusModule } from './realtime/realtime.bus';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { ActivitiesModule } from './activities/activities.module';
import { RealtimeModule } from './realtime/realtime.module';
import { VotingModule } from './voting/voting.module';
import { ContributionsModule } from './contributions/contributions.module';
import { PovHmwModule } from './pov-hmw/pov-hmw.module';
import { LlmModule } from './llm/llm.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { InterviewModule } from './interview/interview.module';
import { SummaryModule } from './summary/summary.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    SupabaseModule,
    RealtimeBusModule,
    AuthModule,
    ActivitiesModule,
    RealtimeModule,
    VotingModule,
    ContributionsModule,
    PovHmwModule,
    LlmModule,
    EvaluationsModule,
    InterviewModule,
    SummaryModule,
  ],
  controllers: [HealthController],
  providers: [
    // Protected by default. Routes opt out with @Public().
    // The gateway authenticates separately, on the handshake.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
