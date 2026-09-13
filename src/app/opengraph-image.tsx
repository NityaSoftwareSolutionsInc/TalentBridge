import { ImageResponse } from "next/og";
import { BrandOgCard } from "@/lib/brand-images";

export const runtime = "edge";
export const alt = "TalentBridge Contact Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <BrandOgCard
        product="Contact Manager"
        title="The staffing relationship hub"
        subtitle="Candidates, clients, requirements and submissions — with ownership, context and next action."
      />
    ),
    { ...size },
  );
}
