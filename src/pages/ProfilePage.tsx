import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { PageHeader, Spinner } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import { User, Mail, Phone, Save } from 'lucide-react'

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
    bio: profile?.bio ?? '',
    qualification: profile?.qualification ?? '',
    preferred_channel: profile?.preferred_channel ?? 'email'
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
      bio: form.bio || null,
      qualification: form.qualification || null,
      preferred_channel: form.preferred_channel
    }).eq('id', profile?.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Profile updated')
    setEditing(false)
    refreshProfile()
  }

  if (!profile) return <Spinner />

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Manage your account information"
        action={!editing ? <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit Profile</button> : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="w-24 h-24 rounded-full bg-brown-600 text-cream-100 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
            {getInitials(`${profile.first_name} ${profile.last_name}`)}
          </div>
          <p className="font-semibold text-brown-800 text-lg">{profile.first_name} {profile.last_name}</p>
          <span className="badge badge-brown mt-2 capitalize">{profile.role}</span>
          {profile.email && <p className="text-sm text-brown-400 mt-3">{profile.email}</p>}
        </div>

        <div className="lg:col-span-2 card">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name</label>
                  <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-brown-300" />
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input pl-10" placeholder="080..." />
                </div>
              </div>
              <div>
                <label className="label">Preferred Notification Channel</label>
                <select value={form.preferred_channel} onChange={(e) => setForm({ ...form, preferred_channel: e.target.value as any })} className="input">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push Notification</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              {profile.role === 'teacher' && (
                <>
                  <div>
                    <label className="label">Qualification</label>
                    <input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className="input" placeholder="e.g. B.Sc Mathematics" />
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input" placeholder="Tell students about yourself" />
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-brown-300" />
                <div>
                  <p className="text-sm text-brown-400">Email</p>
                  <p className="text-brown-700">{profile.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-brown-300" />
                <div>
                  <p className="text-sm text-brown-400">Phone</p>
                  <p className="text-brown-700">{profile.phone || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-brown-400">Preferred Channel</p>
                <p className="text-brown-700 capitalize">{profile.preferred_channel}</p>
              </div>
              {profile.role === 'teacher' && (
                <>
                  <div>
                    <p className="text-sm text-brown-400">Qualification</p>
                    <p className="text-brown-700">{profile.qualification || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-brown-400">Bio</p>
                    <p className="text-brown-700">{profile.bio || '—'}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
