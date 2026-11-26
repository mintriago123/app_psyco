import { Suspense } from "react";
import ResultExperience from "./ResultExperience";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";

export function generateStaticParams() {
  return STUDY_UNITS.map((unit) => ({ unitId: String(unit.id) }));
}

export default function ResultPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="result-shell">
        <div className="status-panel" role="status"><p>Preparando el resumen de la partida…</p></div>
      </div>
    }>
      <ResolvedResultPage params={params} />
    </Suspense>
  );
}

async function ResolvedResultPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return <ResultExperience unitParam={unitId} />;
}
