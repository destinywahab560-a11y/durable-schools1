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
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Paystack secret key not configured. Add PAYSTACK_SECRET_KEY to your edge function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, amount, reference, payment_id, invoice_id } = await req.json()

    if (!email || !amount || !reference) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, amount, reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount),
        reference,
        callback_url: `${supabaseUrl}/functions/v1/paystack-verify?reference=${reference}&payment_id=${payment_id}&invoice_id=${invoice_id}`
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.message || 'Paystack initialization failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
