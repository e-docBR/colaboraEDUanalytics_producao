import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login - colaboraEDU Analytics',
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
