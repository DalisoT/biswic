import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/require-user';

export default async function HomePage() {
  const user = await getUser();
  if (user) redirect('/dashboard');
  redirect('/login');
}
