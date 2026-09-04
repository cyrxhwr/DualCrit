import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { ActivitiesModule } from './activities/activities.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [SupabaseModule, AuthModule, ActivitiesModule],
  controllers: [HealthController],
  providers: [
    // Protected by default. Routes opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
