import React from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => {
    const TanStackRouterDevtools = 
      process.env.NODE_ENV === 'development'
        ? React.lazy(() =>
            import('@tanstack/router-devtools').then((res) => ({
              default: res.TanStackRouterDevtools,
            }))
          )
        : () => null;

    return (
      <>
        <Outlet />
        {process.env.NODE_ENV === 'development' ? (
          <React.Suspense fallback={null}>
            <TanStackRouterDevtools />
          </React.Suspense>
        ) : null}
      </>
    );
  },
})