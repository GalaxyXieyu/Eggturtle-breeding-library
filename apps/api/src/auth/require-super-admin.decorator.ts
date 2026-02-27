import { SetMetadata } from '@nestjs/common';

import { REQUIRE_SUPER_ADMIN_KEY } from './super-admin.constants';

export const RequireSuperAdmin = () => SetMetadata(REQUIRE_SUPER_ADMIN_KEY, true);
