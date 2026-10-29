import { redirect } from "next/navigation";

export default async function PipelinePage({ params }: PageProps<"/[pipeline]">) {
  const { pipeline } = await params;
  redirect(`/${pipeline}/negociaciones`);
}
