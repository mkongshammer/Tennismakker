import AdminPageContent from './AdminPageContent';
import { LegacyAdminLinks } from './LegacyAdminLinks';
export const dynamic = 'force-dynamic';
export default function AdminPage(props: {searchParams: Promise<{stripe?: string; abonnement?: string}>}) { return <><LegacyAdminLinks /><AdminPageContent {...props} /></>; }
