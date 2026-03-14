import React, { useState, useEffect, useRef } from 'react';
import { X, Coffee, CreditCard, CircleCheck as CheckCircle, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';

interface TipJarProps {
  onClose: () => void;
}

type PaymentStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'success' | 'error';

declare global {
  interface Window {
    Stripe?: (key: string) => StripeInstance;
  }
}

interface StripeInstance {
  elements: (opts: object) => StripeElements;
  confirmPayment: (opts: object) => Promise<{ error?: { message: string } }>;
}

interface StripeElements {
  create: (type: string, opts?: object) => StripeElement;
  submit: () => Promise<{ error?: { message: string } }>;
  getElement: (type: string) => StripeElement | null;
}

interface StripeElement {
  mount: (el: HTMLElement) => void;
  unmount: () => void;
  on: (event: string, handler: () => void) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

const TIP_AMOUNTS = [
  { label: '$3', amount: 300, desc: 'A sip' },
  { label: '$5', amount: 500, desc: 'A full cup' },
  { label: '$10', amount: 1000, desc: 'A fancy latte' },
];

function loadStripeJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
}

export default function TipJar({ onClose }: TipJarProps) {
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const stripeRef = useRef<StripeInstance | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardMountRef = useRef<HTMLDivElement>(null);
  const cardElementRef = useRef<StripeElement | null>(null);
  const mountedRef = useRef(false);

  const selectedTip = TIP_AMOUNTS.find(t => t.amount === selectedAmount) ?? TIP_AMOUNTS[1];

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cardElementRef.current?.unmount();
    };
  }, []);

  const initializePayment = async () => {
    setStatus('loading');
    setErrorMsg('');

    try {
      await loadStripeJs();

      if (!STRIPE_PK) {
        throw new Error('Stripe publishable key not configured (VITE_STRIPE_PUBLISHABLE_KEY)');
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-tip-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create payment');

      const stripe = window.Stripe!(STRIPE_PK);
      stripeRef.current = stripe;

      const elements = stripe.elements({
        clientSecret: data.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#ef4444',
            colorBackground: '#0a0a0a',
            colorText: '#fca5a5',
            colorDanger: '#f87171',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      });

      elementsRef.current = elements;
      setClientSecret(data.clientSecret);

      const paymentEl = elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
      });
      cardElementRef.current = paymentEl;

      mountedRef.current = true;
      setStatus('ready');

      requestAnimationFrame(() => {
        if (cardMountRef.current && cardElementRef.current) {
          cardElementRef.current.mount(cardMountRef.current);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const handlePay = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setStatus('processing');
    setErrorMsg('');

    const { error: submitError } = await elementsRef.current.submit();
    if (submitError) {
      setErrorMsg(submitError.message ?? 'Validation failed');
      setStatus('ready');
      return;
    }

    const { error } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      clientSecret,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message ?? 'Payment failed');
      setStatus('ready');
    } else {
      setStatus('success');
    }
  };

  const handleAmountChange = (amount: number) => {
    if (status === 'ready' || status === 'error') {
      cardElementRef.current?.unmount();
      cardElementRef.current = null;
      elementsRef.current = null;
      stripeRef.current = null;
      setClientSecret('');
      setStatus('idle');
    }
    setSelectedAmount(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm bg-black border-2 border-red-500/50 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(239,68,68,0.25), 0 0 80px rgba(239,68,68,0.1)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 to-transparent pointer-events-none" />

        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-red-400/60 hover:text-red-400 transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 mb-3"
              style={{ boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
              <Coffee className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-red-400" style={{ textShadow: '0 0 15px rgba(239,68,68,0.6)' }}>
              Buy a Coffee
            </h2>
            <p className="text-sm text-red-300/60 mt-1">Support Rowdy's development</p>
          </div>

          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/40 mb-4"
                style={{ boxShadow: '0 0 24px rgba(34,197,94,0.3)' }}>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xl font-bold text-green-400 mb-1" style={{ textShadow: '0 0 12px rgba(34,197,94,0.5)' }}>
                Thanks so much!
              </p>
              <p className="text-sm text-red-300/60 mb-6">Your {selectedTip.label} coffee is on its way.</p>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all active:scale-95 touch-manipulation"
                style={{ boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}
              >
                Back to Rowdy
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {TIP_AMOUNTS.map((tip) => (
                  <button
                    key={tip.amount}
                    onClick={() => handleAmountChange(tip.amount)}
                    disabled={status === 'loading' || status === 'processing'}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all active:scale-95 touch-manipulation ${
                      selectedAmount === tip.amount
                        ? 'border-red-500 bg-red-500/15 text-red-400'
                        : 'border-red-500/25 bg-transparent text-red-400/60 hover:border-red-500/50'
                    }`}
                    style={selectedAmount === tip.amount ? { boxShadow: '0 0 14px rgba(239,68,68,0.2)' } : {}}
                  >
                    <span className="text-lg font-bold">{tip.label}</span>
                    <span className="text-xs mt-0.5 opacity-70">{tip.desc}</span>
                  </button>
                ))}
              </div>

              {status === 'idle' && (
                <button
                  onClick={initializePayment}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                  style={{ boxShadow: '0 0 25px rgba(239,68,68,0.4)' }}
                >
                  <CreditCard className="w-5 h-5" />
                  Tip {selectedTip.label}
                </button>
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                  <p className="text-sm text-red-400/60">Setting up payment...</p>
                </div>
              )}

              {(status === 'ready' || status === 'processing') && (
                <div>
                  <div
                    ref={cardMountRef}
                    className="mb-4 min-h-[120px]"
                    id="stripe-payment-element"
                  />
                  {errorMsg && (
                    <div className="flex items-start gap-2 mb-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{errorMsg}</p>
                    </div>
                  )}
                  <button
                    onClick={handlePay}
                    disabled={status === 'processing'}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-lg rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                    style={{ boxShadow: '0 0 25px rgba(239,68,68,0.4)' }}
                  >
                    {status === 'processing' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Coffee className="w-5 h-5" />
                        Pay {selectedTip.label}
                      </>
                    )}
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div>
                  {errorMsg && (
                    <div className="flex items-start gap-2 mb-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">{errorMsg}</p>
                    </div>
                  )}
                  <button
                    onClick={initializePayment}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                    style={{ boxShadow: '0 0 25px rgba(239,68,68,0.4)' }}
                  >
                    <CreditCard className="w-5 h-5" />
                    Try Again
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-red-500/40 mt-4">
                Secured by Stripe. No card data touches our servers.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
