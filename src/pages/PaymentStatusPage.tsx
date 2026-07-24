import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function PaymentStatusPage() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const isSuccess = status === 'success'

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 px-4">
      <div className="card max-w-sm w-full text-center py-10">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isSuccess ? 'bg-sage-100' : 'bg-error-100'}`}>
          {isSuccess ? (
            <CheckCircle2 className="w-9 h-9 text-sage-600" />
          ) : (
            <XCircle className="w-9 h-9 text-error-600" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-brown-800 mb-2">
          {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
        </h1>
        <p className="text-brown-500 mb-6">
          {isSuccess
            ? 'Your payment has been confirmed.'
            : "We couldn't confirm this payment. If you were charged, please contact the school office."}
        </p>
        <Link to="/parent" className="btn btn-primary inline-block">
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
