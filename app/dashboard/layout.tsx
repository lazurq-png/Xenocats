import SideNav from '@/app/ui/dashboard/sidenav';
import { XenocatCatsProvider } from '@/app/ui/xenocats/cat-layer';
import { XenocatCursorProvider } from '@/app/ui/xenocats/fake-cursor';

/** The dashboard shell from the mockup's first page: the sidebar and a framed content area. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <XenocatCursorProvider>
      <XenocatCatsProvider>
        <div className="flex h-screen flex-col bg-void font-ui md:flex-row md:overflow-hidden">
          {/* First in the tab order: past the navigation, straight to the page. */}
          <a
            href="#main-content"
            className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
          >
            Skip to main content
          </a>
          <div className="w-full flex-none md:w-[228px]">
            <SideNav />
          </div>
          <div className="grow md:overflow-y-auto">
            <main
              id="main-content"
              tabIndex={-1}
              className="min-h-full px-4 py-6 focus-visible:outline-none md:rounded-bl-[40px] md:border-b md:border-l md:border-line/70 md:px-8 md:py-9"
            >
              {children}
            </main>
          </div>
        </div>
      </XenocatCatsProvider>
    </XenocatCursorProvider>
  );
}
