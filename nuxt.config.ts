export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  // Demo is pitched on a projector — pin light mode; the ops sidebar opts into
  // dark locally via a `dark` class so it reads charcoal.
  colorMode: { preference: 'light', fallback: 'light' },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'M&P International Freights — Live Tracking Demo',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#221f1f' },
        { name: 'description', content: 'Live shipment tracking, driver updates, e-signature POD and review requests for freight forwarders.' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }
      ]
    }
  }
})
