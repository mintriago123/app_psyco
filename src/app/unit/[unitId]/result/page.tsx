import ResultExperience from "./ResultExperience";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";

export function generateStaticParams() {
  return STUDY_UNITS.map((unit) => ({ unitId: String(unit.id) }));
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return <ResultExperience unitParam={unitId} />;
}
