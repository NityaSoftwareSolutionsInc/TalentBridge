import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const users = await prisma.user.findMany({
    where: { enabled: true },
    include: { memberships: true, tenant: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      title: u.title,
      role: u.memberships[0]?.role,
      tenant: u.tenant.name,
    })),
  );
}
