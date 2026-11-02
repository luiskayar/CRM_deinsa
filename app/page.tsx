import { redirect } from "next/navigation";
import { DEFAULT_PIPELINE } from "@/lib/constants";

export default function Home() {
  redirect(`/${DEFAULT_PIPELINE.id}/negociaciones`);
}
