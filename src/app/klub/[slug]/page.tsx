import { ClubPage } from "../../../components/ClubPage";

export const dynamic = "force-dynamic";

export default async function KlubRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dag?: string; optaget?: string; fejl?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return <ClubPage slug={slug} searchParams={query} />;
}
