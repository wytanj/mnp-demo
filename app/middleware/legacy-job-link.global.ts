/**
 * Legacy deep links. The old ops home lived at `/` and opened a job with
 * `?job=MP-4471-AF` (older spelling: `?mail=`). Those URLs are in seeded emails
 * and in Felicia's notes, so keep them working against the new route tree.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/') return

  const id = (to.query.job ?? to.query.mail) as string | undefined
  if (!id) return

  return navigateTo(`/ops/jobs/${String(id).toUpperCase()}`, { replace: true })
})
