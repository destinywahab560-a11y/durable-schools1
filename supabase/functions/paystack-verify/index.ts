import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')

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
      return new Response(
        JSON.stringify({ error: 'Missing reference parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Paystack secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`
      }
    })

    const data = await response.json()

    if (!response.ok || data.data.status !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Payment verification failed', status: data.data?.status || 'unknown' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Successful</title>
<style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF5EB;color:#5C3A1E}
.box{text-align:center;padding:2rem}.check{width:64px;height:64px;border-radius:50%;background:#22C55E;color:white;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 1rem}
a{display:inline-block;margin-top:1rem;padding:.75rem 1.5rem;background:#5C3A1E;color:#FAF5EB;border-radius:8px;text-decoration:none}</style></head>
<body><div class="box"><div class="check">✓</div><h1>Payment Successful!</h1><p>Your payment has been confirmed.</p><a href="/">Return to Dashboard</a></div></body></html>`

    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
