'use client';



import { useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;


let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> | null {
  if (!PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onSuccess();
      return;
    }

    setError('Payment did not complete. Please try again.');
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!stripe || !elements || submitting}>
          {submitting ? 'Processing…' : 'Pay with Stripe'}
        </Button>
      </div>
    </div>
  );
}

export function StripePaymentForm({ clientSecret, onSuccess, onCancel }: StripePaymentFormProps) {
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
    <Elements stripe={promise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
