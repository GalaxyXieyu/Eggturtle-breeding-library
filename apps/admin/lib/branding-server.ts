import { cache } from 'react';
import { fetchPlatformBrandingServerConfig } from '@eggturtle/shared';

export const getPlatformBrandingServer = cache(fetchPlatformBrandingServerConfig);
