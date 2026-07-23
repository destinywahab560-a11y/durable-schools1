import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { PageHeader, Modal, Spinner, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { DollarSign, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function AdminFees() {
  const { profile } = useAuthStore()
  const schoolId = profile?.school_id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', class_id: '', due_date: '', fee_type: 'term' })

  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name')
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: fees, isLoading } = useQuery({
    queryKey: ['fees', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('fees')
        .select(`
          id, name, amount, due_date, fee_type, created_at,
          class:classes(name, arm)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!schoolId
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices-overview', schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, amount, status, student:profiles(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(20)
      return data ?? []
    },
    enabled: !!schoolId
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('fees').insert({
      school_id: schoolId,
      name: form.name,
      amount: parseFloat(form.amount),
      class_id: form.class_id || null,
      due_date: form.due_date || null,
      fee_type: form.fee_type
    })
    if (error) { toast.error(error.message); return }
    toast.success('Fee created')
    setModalOpen(false)
    setForm({ name: '', amount: '', class_id: '', due_date: '', fee_type: 'term' })
    queryClient.invalidateQueries({ queryKey: ['fees', schoolId] })
  }

  const generateInvoices = async (feeId: string, fee: any) => {
    const targetClass = fee.class_id
    let studentQuery = supabase.from('student_enrollments').select('student_id')
    if (targetClass) studentQuery = studentQuery.eq('class_id', targetClass)
    const { data: enrollments } = await studentQuery

    if (!enrollments || enrollments.length === 0) {
      toast.error('No students found for this fee')
      return
    }

    const invoices = enrollments.map((e) => ({
      student_id: e.student_id,
      fee_id: feeId,
      amount: fee.amount,
      due_date: fee.due_date,
      status: 'pending'
    }))

    const { error } = await supabase.from('invoices').insert(invoices)
    if (error) { toast.error(error.message); return }
    toast.success(`${invoices.length} invoices generated`)
    queryClient.invalidateQueries({ queryKey: ['invoices-overview', schoolId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="Fees & Billing" subtitle="Configure fees and track payments"
        action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Fee</button>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Fee Structures</h3>
          {fees && fees.length > 0 ? (
            <div className="space-y-3">
              {fees.map((f: any) => (
                <div key={f.id} className="card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-brown-800">{f.name}</p>
                      <p className="text-sm text-brown-400">
                        {f.class ? `${f.class.name} ${f.class.arm}` : 'All classes'} • {f.fee_type}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-brown-700">{formatCurrency(f.amount)}</p>
                  </div>
                  {f.due_date && <p className="text-sm text-brown-400 mb-3">Due: {formatDate(f.due_date)}</p>}
                  <button className="btn btn-outline text-sm w-full" onClick={() => generateInvoices(f.id, f)}>
                    Generate Invoices
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={DollarSign} title="No fees configured" description="Create fee structures for your school." />
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-brown-800 mb-4">Recent Invoices</h3>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brown-700">{inv.student?.first_name} {inv.student?.last_name}</p>
                    <p className="text-sm text-brown-400">{formatCurrency(inv.amount)}</p>
                  </div>
                  <span className={`badge ${
                    inv.status === 'paid' ? 'badge-sage' :
                    inv.status === 'overdue' ? 'badge-error' : 'badge-amber'
                  }`}>
                    {inv.status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                     inv.status === 'overdue' ? <AlertCircle className="w-3 h-3 mr-1" /> :
                     <Clock className="w-3 h-3 mr-1" />}
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={DollarSign} title="No invoices yet" description="Generate invoices from fee structures." />
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Fee">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Fee Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. First Term Tuition" />
          </div>
          <div>
            <label className="label">Amount (₦)</label>
            <input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="label">Class (optional — leave blank for all)</label>
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="input">
              <option value="">All classes</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Fee Type</label>
            <select value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })} className="input">
              <option value="term">Term Fee</option>
              <option value="holiday">Holiday Lesson</option>
              <option value="programme">Programme</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">Create Fee</button>
        </form>
      </Modal>
    </div>
  )
}
