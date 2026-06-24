import { redirect } from "next/navigation";

export default function ServiceHoursPage() {
  // TODO: Volunteering/service hours disabled because school uses a separate system.
  redirect("/opportunities");
}
