"use client";

import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

function PaymentForm({ clientSecret: _clientSecret, amount, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order?payment=success`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message || "Unable to process payment",
          variant: "destructive",
        });
        onError?.(error.message || "Payment failed");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        toast({
          title: "Payment successful",
          description: "Your payment has been processed",
        });
        onSuccess(paymentIntent.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment processing failed";
      toast({
        title: "Payment error",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${(amount / 100).toFixed(2)}`
        )}
      </Button>
    </form>
  );
}

interface StripePaymentFormProps {
  amountCents: number;
  couponCode?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

export default function StripePaymentForm({
  amountCents,
  couponCode,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFree, setIsFree] = useState(false);
  const { toast } = useToast();
  const stripeConfigured = Boolean(stripePublishableKey);

  useEffect(() => {
    if (!stripeConfigured) {
      setClientSecret(null);
      setIsFree(false);
      setLoading(false);
      onError?.("Stripe is not configured.");
      return;
    }

    // Create Payment Intent
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents,
            couponCode,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create payment intent");
        }

        const data = await response.json();

        if (data.free) {
          setIsFree(true);
          toast({
            title: "Order is free",
            description: "No payment required for this order",
          });
          // Immediately call success with a special indicator for free orders
          onSuccess("free_order");
        } else {
          setClientSecret(data.clientSecret);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize payment";
        toast({
          title: "Payment initialization failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [amountCents, couponCode, onSuccess, onError, toast, stripeConfigured]);

  if (!stripeConfigured) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center">
        <p className="text-red-600 dark:text-red-400">
          Stripe is not configured. Please set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading payment form...</span>
      </div>
    );
  }

  if (isFree) {
    return (
      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-center">
        <p className="text-green-600 dark:text-green-400 font-medium">
          This order is free! No payment required.
        </p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center">
        <p className="text-red-600 dark:text-red-400">
          Unable to load payment form. Please try again.
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#0F172A",
        colorBackground: "#ffffff",
        colorText: "#1e293b",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        clientSecret={clientSecret}
        amount={amountCents}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}
