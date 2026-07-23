import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { DollarSign, CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function ParentFees() {
  const { profile } = useAuthStore()
  const parentId = profile?.id
  const queryClient = useQueryClient()
  const [selectedChild, setSelectedChild] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  const { data: children } = useQuery({
    queryKey: ['my-children', parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('student_id, student:profiles(first_name, last_name)')
        .eq('parent_id', parentId)
      return data ?? []
    },
    enabled: !!parentId
  })

  const activeChildId = selectedChild || children?.[0]?.student_id

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['child-invoices-full', activeChildId],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select(`
          id, amount, status, due_date, paid_at, created_at,
          fee:fees(name, fee_type)
        `)
        .eq('student_id', activeChildId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!activeChildId
  })

  const handlePay = async (invoiceId: string, amount: number) => {
    setPaying(invoiceId)
    try {
      const { data: payment, error } = await supabase.from('payments').insert({
        invoice_id: invoiceId,
        student_id: activeChildId,
        amount,
        status: 'pending'
      }).select().single()

      if (error) throw error

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/paystack-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: profile?.email,
          amount: amount * 100,
          reference: `DS-${payment.id.substring(0, 8)}`,
          payment_id: payment.id,
          invoice_id: invoiceId
        })
      })

      if (!response.ok) throw new Error('Payment initialization failed')
      const data = await response.json()

      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        throw new Error('No payment URL returned')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
      setPaying(null)
    }
  }

  if (isLoading) return <Spinner />

  const totalPaid = invoices?.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0) ?? 0
  const totalOwed = invoices?.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0) ?? 0

  return (
    <div>
      <PageHeader title="Fees & Payments" subtitle="View invoices and pay via Paystack" />

      {children && children.length > 1 && (
        <div className="flex gap-3 mb-6">
          {children.map((c) => (
            <button
              key={c.student_id}
              onClick={() => setSelectedChild(c.student_id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeChildId === c.student_id ? 'bg-brown-600 text-cream-100' : 'bg-cream-200 text-brown-400'
              }`}
            >
              {c.student?.first_name} {c.student?.last_name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-sage-100 text-sage-500 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-brown-400">Total Paid</p>
              <p className="text-2xl font-bold text-sage-500">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-error-100 text-error-500 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-brown-400">Outstanding</p>
              <p className="text-2xl font-bold text-error-500">{formatCurrency(totalOwed)}</p>
            </div>
          </div>
        </div>
      </div>

      {invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-brown-800">{inv.fee?.name || 'Invoice'}</p>
                <p className="text-sm text-brown-400">
                  {formatCurrency(inv.amount)}
                  {inv.due_date && ` • Due: ${formatDate(inv.due_date)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${
                  inv.status === 'paid' ? 'badge-sage' :
                  inv.status === 'overdue' ? 'badge-error' : 'badge-amber'
                }`}>
                  {inv.status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                   inv.status === 'overdue' ? <AlertCircle className="w-3 h-3 mr-1" /> :
                   <Clock className="w-3 h-3 mr-1" />}
                  {inv.status}
                </span>
                {(inv.status === 'pending' || inv.status === 'overdue') && (
                  <button
                    className="btn btn-primary text-sm"
                    disabled={paying === inv.id}
                    onClick={() => handlePay(inv.id, inv.amount)}
                  >
                    <CreditCard className="w-4 h-4" />
                    {paying === inv.id ? 'Processing...' : 'Pay Now'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={DollarSign} title="No invoices" description="Fee invoices will appear here when generated." />
      )}
    </div>
  )
}
