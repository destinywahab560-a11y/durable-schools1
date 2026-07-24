import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
// Supabase Edge Functions cannot serve real HTML on the shared supabase.co
// domain (GET requests returning text/html get silently rewritten to
// text/plain by the platform). So instead of rendering a page here, this
// function verifies the payment and redirects the browser to the actual
// frontend, which renders the real success/failure page.
const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://durable-schools.vercel.app'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get('reference')
    const paymentId = url.searchParams.get('payment_id')
    const invoiceId = url.searchParams.get('invoice_id')

    if (!reference) {
      return Response.redirect(`${frontendUrl}/payment-status?status=failed&reason=missing_reference`, 302)
    }

    if (!paystackSecretKey) {
      return Response.redirect(`${frontendUrl}/payment-status?status=failed&reason=not_configured`, 302)
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`
      }
    })

    const data = await response.json()

    if (!response.ok || data.data.status !== 'success') {
      return Response.redirect(`${frontendUrl}/payment-status?status=failed&reason=verification_failed`, 302)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (paymentId) {
      await supabase.from('payments').update({
        status: 'success',
        paystack_reference: reference,
        paid_at: new Date().toISOString()
      }).eq('id', paymentId)
    }

    if (invoiceId) {
      await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString()
      }).eq('id', invoiceId)
    }

    return Response.redirect(`${frontendUrl}/payment-status?status=success`, 302)
  } catch (err) {
    console.error('Payment verification error:', err)
    return Response.redirect(`${frontendUrl}/payment-status?status=failed&reason=server_error`, 302)
  }
})
