import { notFound } from "next/navigation";
import { Board } from "@/components/Board";
import { getPipeline } from "@/lib/server/pipelines";

export default async function NegociacionesPage({ params }: PageProps<"/[pipeline]/negociaciones">) {
  const pipeline = await getPipeline((await params).pipeline);
  if (!pipeline) notFound();
  // key: al cambiar de pipeline el tablero arranca de cero (sin tarjetas del anterior).
  return <Board key={pipeline.id} boardType="negociaciones" pipeline={pipeline} />;
}
