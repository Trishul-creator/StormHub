import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { getAuthContext } from "@/lib/auth";
import { isAssistantEnabled } from "@/lib/env";

export default async function AssistantPage() {
  const auth = await getAuthContext();
  if (!auth.isLoggedIn) redirect("/auth/sign-in?redirect=/assistant");

  const configured = isAssistantEnabled();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="StormHub Assistant"
        description="Ask for help finding clubs, understanding your next steps, drafting club posts, or navigating StormHub."
      />
      <AssistantChat configured={configured} />
    </div>
  );
}
