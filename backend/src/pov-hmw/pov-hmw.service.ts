import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ActivitiesService } from '../activities/activities.service';

/** How many of each the team records. Three of each, as in the previous system. */
export const NEEDS_COUNT = 3;
export const INSIGHTS_COUNT = 3;

export interface PovHmwData {
  needs: string[];
  insights: string[];
  /** False until the host has recorded them, which gates the POV step. */
  isSet: boolean;
}

interface Row {
  needs: string[] | null;
  insights: string[] | null;
}

@Injectable()
export class PovHmwService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly activities: ActivitiesService,
  ) {}

  async get(activityId: string, studentUuid: string): Promise<PovHmwData> {
    await this.activities.assertMember(activityId, studentUuid);

    const { data, error } = await this.supabase.client
      .from('pov_hmw_data')
      .select('needs, insights')
      .eq('activity_id', activityId)
      .maybeSingle<Row>();

    if (error) throw new BadRequestException(error.message);

    const needs = data?.needs ?? [];
    const insights = data?.insights ?? [];
    return {
      needs,
      insights,
      isSet: needs.length > 0 && insights.length > 0,
    };
  }

  /**
   * Record the team's needs and insights. Host only.
   *
   * The team agrees on these out loud and the host types them, so this is the
   * one step in the app that is deliberately not per-student. Everyone else
   * watches for the broadcast.
   *
   * Upserted on the activity id, which is the table's primary key, so a host
   * correcting a typo replaces the row rather than failing.
   */
  async set(
    activityId: string,
    studentUuid: string,
    needs: string[],
    insights: string[],
  ): Promise<PovHmwData> {
    await this.assertHost(activityId, studentUuid);

    const cleanNeeds = needs.map((n) => n.trim()).filter(Boolean);
    const cleanInsights = insights.map((i) => i.trim()).filter(Boolean);

    if (cleanNeeds.length !== NEEDS_COUNT) {
      throw new BadRequestException(`Enter all ${NEEDS_COUNT} needs`);
    }
    if (cleanInsights.length !== INSIGHTS_COUNT) {
      throw new BadRequestException(`Enter all ${INSIGHTS_COUNT} insights`);
    }

    const { error } = await this.supabase.client.from('pov_hmw_data').upsert(
      {
        activity_id: activityId,
        needs: cleanNeeds,
        insights: cleanInsights,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'activity_id' },
    );

    if (error) throw new BadRequestException(error.message);

    return { needs: cleanNeeds, insights: cleanInsights, isSet: true };
  }

  private async assertHost(
    activityId: string,
    studentUuid: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('activity_members')
      .select('is_host')
      .eq('activity_id', activityId)
      .eq('student_id', studentUuid)
      .eq('is_active', true)
      .maybeSingle<{ is_host: boolean }>();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new ForbiddenException('You are not in this activity');
    if (!data.is_host) {
      throw new ForbiddenException(
        'Only the host can set the needs and insights',
      );
    }
  }
}
