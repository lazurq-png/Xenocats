import SideNav from '@/app/ui/dashboard/sidenav';
import { XenocatCatsProvider } from '@/app/ui/xenocats/cat-layer';
import { XenocatCursorProvider } from '@/app/ui/xenocats/fake-cursor';

/** The dashboard shell from the mockup's first page: the sidebar and a framed content area. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider>
        <div className="flex h-screen flex-col bg-void font-ui md:flex-row md:overflow-hidden">
          <div className="w-full flex-none md:w-[228px]">
            <SideNav />
          </div>
          <div className="grow md:overflow-y-auto">
            <div className="min-h-full px-4 py-6 md:rounded-bl-[40px] md:border-b md:border-l md:border-line/70 md:px-8 md:py-9">
              {children}
            </div>
          </div>
        </div>
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}
