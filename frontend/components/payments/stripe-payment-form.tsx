'use client';

/**
 * Client-side Stripe confirmation step.
 *
 * The backend creates a real Stripe PaymentIntent (with automatic payment
 * methods enabled) and returns its `clientSecret`. This component mounts
 * Stripe's Payment Element against that clientSecret and confirms the intent
 * from the browser. The set of payment methods shown (cards, UPI, net banking,
 * wallets, …) is whatever Stripe enables for the account/currency — the Payment
 * Element decides, nothing is hardcoded here. Settlement of the EduPay payment
 * record stays authoritative on the server via the Stripe webhook.
 */

import { useState } from 'react';
import { loadStripe, type Stripe, type PaymentIntent } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/constants';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Load Stripe.js once per session; null when the key is not configured.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> | null {
  if (!PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

interface StripePaymentFormProps {
  clientSecret: string;
  amount: number;
  invoiceNumber?: string;
  studentName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({
  amount,
  invoiceNumber,
  studentName,
  onSuccess,
  onCancel,
}: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentIntent | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Stay in the app for card payments; only redirect when a method requires it.
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment could not be completed. Please try again.');
      setSubmitting(false);
      return;
    }

    const status = paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing') {
      setResult(paymentIntent ?? null);
      return;
    }

    setError('Payment did not complete. Please try again.');
    setSubmitting(false);
  };

  // Success / processing confirmation state.
  if (result) {
    const processing = result.status === 'processing';
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 motion-safe:animate-in motion-safe:zoom-in-50">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <p className="text-base font-semibold">
            {processing ? 'Payment submitted' : 'Payment successful'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {processing
              ? 'Your payment is being processed. The invoice updates once it settles.'
              : 'Your payment has been received. The invoice updates once it settles.'}
          </p>
        </div>
        <p className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
          {result.id}
        </p>
        <Button className="mt-1 w-full" onClick={onSuccess}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment summary */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Amount due</p>
            <p className="text-2xl font-bold tracking-tight">{formatCurrency(amount)}</p>
          </div>
          <div className="min-w-0 text-right">
            {invoiceNumber && <p className="truncate text-sm font-medium">{invoiceNumber}</p>}
            {studentName && <p className="truncate text-xs text-muted-foreground">{studentName}</p>}
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Payment method</p>
        <div className="rounded-lg border p-3">
          {!ready && (
            <div className="space-y-2" aria-hidden>
              <div className="h-10 animate-pulse rounded-md bg-muted" />
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            </div>
          )}
          <PaymentElement onReady={() => setReady(true)} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span>Payments are securely processed by Stripe.</span>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={submitting} className="sm:w-auto">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!stripe || !elements || !ready || submitting}
          className="sm:w-auto"
        >
          {submitting ? 'Processing…' : `Pay ${formatCurrency(amount)}`}
        </Button>
      </div>
    </div>
  );
}

export function StripePaymentForm({
  clientSecret,
  amount,
  invoiceNumber,
  studentName,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) {
  const promise = getStripe();

  if (!promise) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Stripe checkout is unavailable because <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> is
        not configured in this environment.
      </div>
    );
  }

  return (
    <Elements
      stripe={promise}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { borderRadius: '8px' } } }}
    >
      <CheckoutForm
        amount={amount}
        invoiceNumber={invoiceNumber}
        studentName={studentName}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}
