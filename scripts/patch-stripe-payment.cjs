const fs = require('fs');
const path = require('path');

const ORDER_PAGE_PATH = path.join(__dirname, '../app/(public)/order/page.tsx');

console.log('🔧 Patching order page to use Stripe Payment Element...\n');

// Read the file
let content = fs.readFileSync(ORDER_PAGE_PATH, 'utf8');

// 1. Add import for StripePaymentForm
if (!content.includes('import StripePaymentForm')) {
  console.log('✅ Adding StripePaymentForm import...');
  content = content.replace(
    /import { Badge } from "@\/components\/ui\/badge";/,
    `import { Badge } from "@/components/ui/badge";\nimport StripePaymentForm from "@/components/stripe/StripePaymentForm";`
  );
}

// 2. Replace state variables
if (content.includes('const [cardName, setCardName]')) {
  console.log('✅ Replacing card state variables with showStripePayment...');
  content = content.replace(
    /const \[cardName, setCardName\] = useState\(""\);\s*const \[cardNumber, setCardNumber\] = useState\(""\);\s*const \[cardExpiry, setCardExpiry\] = useState\(""\);\s*const \[cardCvc, setCardCvc\] = useState\(""\);/,
    'const [showStripePayment, setShowStripePayment] = useState(false);'
  );
}

// 3. Add new handler functions before handleSubmit
if (!content.includes('const handleStripePaymentSuccess')) {
  console.log('✅ Adding Stripe payment handlers...');
  
  const newHandlers = `
  const handleStripePaymentSuccess = async (paymentIntentId: string) => {
    try {
      const cachedImageData = await ensureReceiptImageData();
      
      setFeePaid(true);
      setDeliveryCheckoutSessionId(paymentIntentId);
      setShowStripePayment(false);
      
      await persistDraft(
        buildDraftPayload({
          deliveryCheckoutSessionId: paymentIntentId,
          feePaid: true,
          receiptImageData: cachedImageData,
        })
      ).catch(() => null);

      toast({
        title: "Payment successful",
        description: "Your delivery payment is ready. You can place your order.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Payment succeeded but failed to update order. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleStripePaymentError = (error: string) => {
    toast({
      title: "Payment failed",
      description: error || "Please try again.",
      variant: "destructive",
    });
    setShowStripePayment(false);
  };
`;
  
  content = content.replace(
    /async function handleSubmit\(\)/,
    newHandlers + '\n  async function handleSubmit()'
  );
}

// 4. Simplify handlePayDeliveryFee
if (content.includes('if (!cardName.trim()')) {
  console.log('✅ Simplifying handlePayDeliveryFee to show Stripe form...');
  
  // Find the start of the function
  const funcStart = content.indexOf('const handlePayDeliveryFee = async () => {');
  const funcEnd = content.indexOf('};', funcStart) + 2;
  
  const newFunction = `const handlePayDeliveryFee = async () => {
    if (feePaid) {
      toast({
        title: "Already paid",
        description: "You've already authorized payment for this delivery.",
      });
      return;
    }

    if (requiresReceipt && !receiptImageData) {
      if (step !== "receipt") {
        toast({
          title: "Receipt required",
          description: "Please upload a receipt before paying.",
          variant: "destructive",
        });
        setStep("receipt");
        return;
      }
    }

    if (requiresReceipt && receiptAnalysis) {
      if (!receiptAnalysis.items.length) {
        toast({
          title: "Receipt items missing",
          description: "Add at least one receipt item before paying.",
          variant: "destructive",
        });
        setStep("receipt");
        return;
      }
    }

    // Show Stripe payment form
    setShowStripePayment(true);
  };`;
  
  content = content.substring(0, funcStart) + newFunction + content.substring(funcEnd);
}

// 5. Replace the payment form UI
if (content.includes('Pay securely with your card')) {
  console.log('✅ Replacing custom payment form with Stripe Payment Element...');
  
  // Find and replace the payment form section
  const formStart = content.indexOf('<div className="rounded-lg border border-border/70 bg-card/80 p-3 space-y-3">');
  const formStartContext = content.substring(formStart - 100, formStart + 200);
  
  if (formStartContext.includes('Pay securely with your card')) {
    const formEnd = content.indexOf('</div>\n                </div>', formStart) + '</div>\n                </div>'.length;
    
    const newForm = `{showStripePayment && !feePaid ? (
                  <div className="rounded-lg border border-border/70 bg-card/80 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <CreditCard className="h-4 w-4" />
                      <span>Pay securely with Stripe</span>
                    </div>
                    <StripePaymentForm
                      amountCents={Math.max(0, orderTotalCents - discountCents)}
                      couponCode={couponCode}
                      onSuccess={handleStripePaymentSuccess}
                      onError={handleStripePaymentError}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setShowStripePayment(false)}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/70 bg-card/80 p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span>Secure payment powered by Stripe</span>
                    </div>
                  </div>
                )}`;
    
    content = content.substring(0, formStart) + newForm + content.substring(formEnd);
  }
}

// Write the patched file
fs.writeFileSync(ORDER_PAGE_PATH, content, 'utf8');

console.log('\n✅ Order page successfully patched!');
console.log('\n📝 Next steps:');
console.log('1. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel');
console.log('2. Test locally with: pnpm dev');
console.log('3. Commit and push changes');
console.log('\n🎉 Stripe Payment Element integration complete!');
