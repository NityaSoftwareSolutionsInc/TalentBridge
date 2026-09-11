import { prisma } from "./db";

export async function tenantSettings(tenantId: string) {
  const row = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!row) {
    throw new Error("Tenant settings missing");
  }
  return row;
}
