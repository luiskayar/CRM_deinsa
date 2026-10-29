import { redirect } from "next/navigation";
import { DEFAULT_PIPELINE } from "@/lib/constants";

// Ruta anterior a los pipelines (5.2.2): se conserva para enlaces guardados.
export default function NegociacionesPage() {
  redirect(`/${DEFAULT_PIPELINE.id}/negociaciones`);
}
