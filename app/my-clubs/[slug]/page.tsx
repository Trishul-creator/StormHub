import { redirect } from "next/navigation";

interface MyClubPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MyClubRedirectPage({ params }: MyClubPageProps) {
  const { slug } = await params;
  redirect(`/clubs/${slug}/member`);
}
