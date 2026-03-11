import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInView } from "@/components/sign-in-view";

export default async function RootPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return <SignInView />;
}
