import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  return (
    <Suspense fallback={<div className="p-8">Loading workspace…</div>}>
      <Workspace moduleKey={module} />
    </Suspense>
  );
}

