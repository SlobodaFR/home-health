import { Global, Module } from '@nestjs/common';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { createFeatureFlags } from './openfeature-feature-flags';

/** Boolean feature flags served by home-features (OFREP), available everywhere. */
@Global()
@Module({
  providers: [
    {
      provide: FeatureFlags,
      useFactory: () => createFeatureFlags(process.env),
    },
  ],
  exports: [FeatureFlags],
})
export class FeatureFlagsModule {}
