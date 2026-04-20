import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/auth-shell';

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
        appearance={{
          elements: {
            card: 'bg-transparent shadow-none p-0',
            footer: 'hidden',
          },
        }}
      />
    </AuthShell>
  );
}
