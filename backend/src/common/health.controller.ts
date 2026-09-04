import { Controller, Get } from '@nestjs/common';
import { Public } from './public.decorator';

@Controller('health')
export class HealthController {
  /**
   * Checked after every deploy. A successful build is not a working app:
   * missing environment or a missing schema only shows up at runtime.
   */
  @Public()
  @Get()
  check() {
    return { status: 'ok', at: new Date().toISOString() };
  }
}
