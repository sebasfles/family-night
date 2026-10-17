import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ToastProvider } from '../components/Toast';
import { IdentityGate } from '../identity/IdentityGate';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col px-4">
        <IdentityGate>
          <Outlet />
        </IdentityGate>
      </div>
    </ToastProvider>
  ),
});
