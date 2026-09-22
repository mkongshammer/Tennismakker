import { getCurrentUser } from '../../lib/session';
import { SuperadminNavigation } from './SuperadminNavigation';
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Individual pages retain their authorization checks; bootstrap has its own token gate.
  if (user?.role !== 'SUPERADMIN') return <>{children}</>;
  return <SuperadminNavigation>{children}</SuperadminNavigation>;
}
