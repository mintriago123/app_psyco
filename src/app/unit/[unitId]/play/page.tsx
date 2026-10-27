import { Suspense } from "react";
import PlayPageClient from "./PlayExperience";
import { STUDY_UNITS } from "../../../../lib/unit-catalog";

export function generateStaticParams() {
  return STUDY_UNITS.map((unit) => ({ unitId: String(unit.id) }));
}

export default function PlayPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="page-wrap">
          <div className="status-panel" role="status">
            <p>Preparando la partida…</p>
          </div>
        </div>
      }
    >
      <ResolvedPlayPage params={params} />
    </Suspense>
  );
}

async function ResolvedPlayPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return <PlayPageClient unitParam={unitId} />;
}
