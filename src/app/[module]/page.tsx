import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";
import { TbLoader } from "@/components/TbLoader";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  return (
    <Suspense fallback={<TbLoader variant="page" hint="Loading workspace" />}>
      <Workspace moduleKey={module} />
    </Suspense>
  );
}

