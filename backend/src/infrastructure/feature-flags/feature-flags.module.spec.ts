import { Test } from '@nestjs/testing';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { FeatureFlagsModule } from './feature-flags.module';
import { OpenFeatureFeatureFlags } from './openfeature-feature-flags';

describe('FeatureFlagsModule', () => {
  it('provides the FeatureFlags port, no-op without home-features configuration', async () => {
    const previous = { ...process.env };
    delete process.env.FEATURES_OFREP_URL;
    delete process.env.FEATURES_API_KEY;
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [FeatureFlagsModule],
      }).compile();
      const flags = moduleRef.get(FeatureFlags);
      expect(flags).toBeInstanceOf(OpenFeatureFeatureFlags);
      await expect(flags.isEnabled('any-flag', true)).resolves.toBe(true);
      await expect(flags.isEnabled('any-flag', false)).resolves.toBe(false);
    } finally {
      process.env = previous;
    }
  });
});
