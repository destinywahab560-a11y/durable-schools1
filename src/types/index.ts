import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
import webpush from 'npm:web-push@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

const gmailUser = Deno.env.get('GMAIL_USER')
const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@durableschools.example'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

let mailTransport: nodemailer.Transporter | null = null
if (gmailUser && gmailAppPassword) {
  mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    // Scoped to the calling user (the Admin), so RLS applies exactly as
    // it would for any other request they make from the browser.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { recipientIds, title, body } = await req.json()
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: 'recipientIds is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: recipients, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, notification_channels')
      .in('id', recipientIds)
    if (profilesError) throw profilesError

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', recipientIds)
    if (subsError) throw subsError

    let emailsSent = 0
    let pushSent = 0
    const errors: string[] = []

    for (const person of recipients ?? []) {
      const channels: string[] = person.notification_channels ?? ['email']

      if (channels.includes('email') && person.email && mailTransport) {
        try {
          await mailTransport.sendMail({
            from: `Durable Schools <${gmailUser}>`,
            to: person.email,
            subject: title,
            text: body ?? title
          })
          emailsSent++
        } catch (err) {
          errors.push(`email to ${person.email}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      }

      if (channels.includes('push') && vapidPublicKey && vapidPrivateKey) {
        const theirSubs = (subscriptions ?? []).filter((s) => s.user_id === person.id)
        for (const sub of theirSubs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              JSON.stringify({ title, body, url: '/notifications' })
            )
            pushSent++
          } catch (err: any) {
            // Subscription is no longer valid (browser unsubscribed, app
            // uninstalled, etc.) — clean it up so we stop retrying it.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            } else {
              errors.push(`push to ${person.id}: ${err instanceof Error ? err.message : 'failed'}`)
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ emailsSent, pushSent, errors, emailConfigured: !!mailTransport, pushConfigured: !!(vapidPublicKey && vapidPrivateKey) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
