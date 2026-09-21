import { notFound } from 'next/navigation';
import AdminPageContent from '../AdminPageContent';
import { isAdminSection } from '../../../lib/admin-navigation';
export const dynamic = 'force-dynamic';
export default async function AdminSectionPage({params, searchParams}: {params: Promise<{section: string}>; searchParams: Promise<{stripe?: string; abonnement?: string}>}) {
  const {section} = await params;
  if (!isAdminSection(section)) notFound();
  return <AdminPageContent section={section} searchParams={searchParams} />;
}
