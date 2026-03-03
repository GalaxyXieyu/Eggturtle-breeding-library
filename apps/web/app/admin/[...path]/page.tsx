import { DeprecatedAdminEntry, normalizeAdminSubPath } from '../_shared/deprecated-admin-entry';

export const dynamic = 'force-dynamic';

type AdminSubpathEntryProps = {
  params: {
    path?: string[];
  };
};

export default function DeprecatedWebAdminSubpathEntry({ params }: AdminSubpathEntryProps) {
  return <DeprecatedAdminEntry targetPath={normalizeAdminSubPath(params.path)} />;
}
