import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'
import { History } from 'lucide-react'

export default function AdminAuditLog() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select(`
          id, action, entity_type, entity_id, details, created_at,
          actor:profiles(first_name, last_name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
    enabled: !!schoolId
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Track key actions across your school" />

      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="card flex items-start gap-4 py-3">
              <div className="w-8 h-8 rounded-full bg-brown-100 text-brown-600 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brown-700">
                  <span className="text-brown-800">{log.actor?.first_name} {log.actor?.last_name}</span>
                  {' '}{log.action}
                </p>
                <p className="text-xs text-brown-400">{formatDateTime(log.created_at)}</p>
                {log.entity_type && <p className="text-xs text-brown-300 mt-1">{log.entity_type}{log.entity_id ? `: ${log.entity_id}` : ''}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={History} title="No audit entries yet" description="Key actions like result releases and grade edits will appear here." />
      )}
    </div>
  )
}
