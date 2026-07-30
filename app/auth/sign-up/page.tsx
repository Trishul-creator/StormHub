import { SignUpForm } from "@/components/auth/sign-up-form";
import { getSignupSchools } from "@/lib/schools";

interface SignUpPageProps {
  searchParams: Promise<{ school?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const schools = await getSignupSchools();
  const preselectedSchool = schools.find((school) => school.slug === params.school);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-storm-subtle px-4 py-12">
      <SignUpForm
        schools={schools.map((school) => ({
          id: school.id,
          name: school.name,
          short_name: school.short_name,
          slug: school.slug,
        }))}
        preselectedSchoolId={preselectedSchool?.id}
        googleAuthEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
      />
    </div>
  );
}
