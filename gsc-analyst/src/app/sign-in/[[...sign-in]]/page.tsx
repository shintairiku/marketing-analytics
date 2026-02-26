import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {/* サインイン後はdashboardへ戻す。 */}
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
