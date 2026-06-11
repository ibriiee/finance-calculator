import LoadingSpinner from '@/components/shared/LoadingSpinner'

// Instant feedback while the dashboard's server data loads —
// without this, tapping "back" feels frozen until the fetch finishes.
export default function DashboardLoading() {
  return <LoadingSpinner />
}
