import { generateRaisePoToken } from "@/lib/email";
import { notFound } from "next/navigation";
import PoUploadForm from "./PoUploadForm";

export default async function PoUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string; raised?: string }>;
}) {
  const { orderNumber } = await params;
  const { t, raised } = await searchParams;

  const expected = generateRaisePoToken(orderNumber);
  if (!t || t !== expected) notFound();

  return <PoUploadForm orderNumber={orderNumber} token={t} justRaised={raised === "true"} />;
}
