import { QueryClient, MutationCache } from '@tanstack/react-query'
import { useToastStore } from '@/store/toast.store'
import { getErrorMessage } from '@/utils/errors'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Skip the global error toast — set when a mutation already shows a
       * more specific, contextual error itself (e.g. inline under a form). */
      suppressToast?: boolean
    }
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchInterval: 30 * 1000,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressToast) return
      useToastStore.getState().push(getErrorMessage(error))
    },
  }),
})
