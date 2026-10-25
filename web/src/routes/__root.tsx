import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ToastProvider } from '../components/Toast';
import { MotionProvider } from '../motion/motion';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <MotionProvider>
      <ToastProvider>
        <div className="flex min-h-dvh flex-col px-4">
          <Outlet />
        </div>
      </ToastProvider>
    </MotionProvider>
  ),
});
