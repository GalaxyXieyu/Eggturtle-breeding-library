'use client';

import { UiPreferenceControls } from '@/components/ui-preferences';
import { cn } from '@/lib/utils';

type TenantFloatingPreferencesProps = {
  className?: string;
};

export default function TenantFloatingPreferences({ className }: TenantFloatingPreferencesProps) {
  return (
    <div className={cn('fixed right-6 top-6 z-50 flex flex-col gap-2 sm:right-6 lg:right-8', className)}>
      <div className="tenant-mobile-pref">
        <UiPreferenceControls />
      </div>
    </div>
  );
}
