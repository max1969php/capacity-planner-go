import '@cloudscape-design/global-styles/index.css'
import { I18nProvider } from '@cloudscape-design/components/i18n'
import messages from '@cloudscape-design/components/i18n/messages/all.en'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { applyPreference, readPreference } from './theme.ts'

// Apply the saved mode before the first render, so the page doesn't flash light.
applyPreference(readPreference())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="en" messages={[messages]}>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
