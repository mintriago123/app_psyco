import { AgencyRoute } from "../../../../components/agency/AgencyRoute";

export default async function AgencyCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <AgencyRoute initialPage={{ case: caseId }} />;
}
