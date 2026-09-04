import { ClubPage } from "../../../components/ClubPage";

export const dynamic = "force-dynamic";

export default function KlubRoute({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { dag?: string; optaget?: string; fejl?: string };
}) {
  return <ClubPage slug={params.slug} searchParams={searchParams} />;
}
