import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The only place a Supabase client is created.
 *
 * Uses the service-role key, which bypasses RLS. Every table has RLS enabled
 * with no policies, so this connection is the only way in — which is why the
 * key must never reach the frontend or the repository.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Copy backend/.env.example to backend/.env and fill them in.',
      );
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async onModuleInit(): Promise<void> {
    // Fail loudly at boot rather than on the first student request.
    const { error } = await this.client
      .from('students')
      .select('id', { head: true, count: 'exact' });

    if (error) {
      this.logger.error(
        `Cannot reach Supabase or the schema is missing: ${error.message}`,
      );
      throw error;
    }

    this.logger.log('Supabase connection verified');
  }
}
