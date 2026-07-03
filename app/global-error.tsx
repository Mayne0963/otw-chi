'use client'
import { useEffect } from 'react'
import { buildErrorPageHref, ERROR_PAGE_PATH } from '@/lib/error-routing';
 
function isQuotaError(error: Error) {
  const message = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return message.includes('exceeded the data transfer quota') || (message.includes('quota') && message.includes('exceeded'))
}

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const error = _error
    const digest = error?.digest
    const href = typeof window !== 'undefined' ? window.location.href : null

    try {
      const key = digest ? `otw:global-error:${digest}` : `otw:global-error:${href ?? ''}:${error?.name ?? ''}:${error?.message ?? ''}`
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(key)) return
      if (typeof window !== 'undefined') window.sessionStorage.setItem(key, '1')
    } catch {
      // ignore
    }

    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        digest: digest ?? null,
        name: error?.name ?? null,
        message: error?.message ?? null,
        stack: error?.stack ?? null,
        href,
      }),
    }).catch(() => {})

    if (typeof window !== 'undefined' && window.location.pathname !== ERROR_PAGE_PATH) {
      window.location.replace(buildErrorPageHref(error, 'global-error-boundary'))
    }
  }, [_error])

  const quota = isQuotaError(_error)

  return (
    <html>
      <body className="bg-otwBlack text-otwOffWhite">
        <div className="flex h-screen flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-red-500">
            {quota ? 'Service temporarily unavailable' : 'Something went wrong!'}
          </h2>
          <button 
            className="mt-4 rounded-lg bg-otwGold px-4 py-2 text-otwBlack font-bold hover:bg-otwGold/90"
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
