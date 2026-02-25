import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  // 既ログインならサインイン画面を出さずdashboardへ移動する。
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
