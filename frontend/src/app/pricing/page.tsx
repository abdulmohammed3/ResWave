'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const plans = [
  {
    name: 'Basic',
    features: [
      'Up to 20 resumes per month',
      'Basic optimization',
      'Standard support',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID
  },
  {
    name: 'Pro',
    price: 19.99,
    features: [
      'Up to 50 resumes per month',
      'Advanced optimization',
      'Priority support',
      'Version history'
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    popular: true
  },
  {
    name: 'Enterprise',
    price: 49.99,
    features: [
      'Unlimited resumes',
      'Custom optimization',
      '24/7 support',
      'Version history',
      'Custom branding'
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string | undefined, planName: string) => {
    if (!priceId) {
      console.error('Price ID not found');
      return;
    }

    setLoading(planName);
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const response = await fetch('/api/v1/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const { sessionId } = await response.json();
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        console.error('Stripe Checkout Error:', error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Select the perfect plan for your resume optimization needs
          </p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg shadow-lg divide-y divide-gray-200 ${
                plan.popular
                  ? 'border-2 border-blue-500 relative'
                  : 'border border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
                  <span className="inline-flex rounded-full bg-blue-500 px-4 py-1 text-sm font-semibold text-white">
                    Popular
                  </span>
                </div>
              )}

              <div className="p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {plan.name}
                </h3>
                <p>
                  <span className="text-4xl font-extrabold text-gray-900">
                    {plan.price ? `$${plan.price}` : 'Free'}
                  </span>
                  <span className="text-base font-medium text-gray-500">
                      /month
                    </span>
                </p>
                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.name)}
                  disabled={!!loading}
                  className={`mt-8 block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-md transition duration-200 ${
                    loading === plan.name
                      ? 'opacity-75 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {loading === plan.name ? 'Processing...' : 'Sign Up Now'}
                </button>
              </div>
              <div className="pt-6 pb-8 px-6">
                <h4 className="text-sm font-medium text-gray-900 tracking-wide">
                  What&apos;s included
                </h4>
                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex space-x-3">
                      <svg
                        className="flex-shrink-0 h-5 w-5 text-green-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-500">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}