import { notFound } from 'next/navigation';
import SuperadminPageContent from '../SuperadminPageContent';
import { isSuperadminSection } from '../../../lib/superadmin-navigation';
export const dynamic = 'force-dynamic';
export default async function SuperadminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSuperadminSection(section)) notFound();
  return <SuperadminPageContent section={section} />;
}
