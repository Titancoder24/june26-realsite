import { redirect } from "next/navigation";

export default async function TourAliasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/view/${slug}`);
}
