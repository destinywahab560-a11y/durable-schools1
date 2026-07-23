import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-brown-800">{title}</h1>
        {subtitle && <p className="text-brown-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: 'brown' | 'amber' | 'sage' | 'error'
}

export function StatCard({ label, value, icon: Icon, color = 'brown' }: StatCardProps) {
  const colorClasses = {
    brown: 'bg-brown-100 text-brown-600',
    amber: 'bg-amber-100 text-amber-600',
    sage: 'bg-sage-100 text-sage-500',
    error: 'bg-error-100 text-error-600'
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', colorClasses[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-brown-400">{label}</p>
        <p className="text-2xl font-bold text-brown-800">{value}</p>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-12">
      <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-brown-300" />
      </div>
      <h3 className="text-lg font-semibold text-brown-700 mb-1">{title}</h3>
      {description && <p className="text-brown-400 text-sm max-w-md mb-4">{description}</p>}
      {action}
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brown-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-cream-50 rounded-xl shadow-xl border border-cream-300 w-full max-h-[90vh] overflow-y-auto animate-slide-up', sizeClasses[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300 sticky top-0 bg-cream-50 z-10">
          <h2 className="text-lg font-semibold text-brown-800">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-brown-50 text-brown-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  const sizeClasses = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className="flex items-center justify-center py-8">
      <div className={cn('border-4 border-cream-300 border-t-brown-600 rounded-full animate-spin', sizeClasses[size])} />
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-brown-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={cn('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
