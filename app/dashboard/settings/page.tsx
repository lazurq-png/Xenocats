import { Metadata } from 'next';
import PasswordForm from '@/app/ui/settings/password-form';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function Page() {
  return (
    <div className="max-w-xl">
      <h1 className="mb-8 font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
        Settings
      </h1>
      <section aria-labelledby="password-heading">
        <h2 id="password-heading" className="mb-4 text-xl font-semibold text-white">
          Change password
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
