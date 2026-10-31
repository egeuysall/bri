import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/auth-shell';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'sign up', robots: { index: false, follow: false } };

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
