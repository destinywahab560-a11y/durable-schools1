import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const location = useLocation()

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-brown-300 border-t-brown-600 rounded-full animate-spin mb-4" />
          <p className="text-brown-500 font-medium">Setting up your profile...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
