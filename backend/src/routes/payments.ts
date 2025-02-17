import express from 'express';
import { stripeService } from '../services/stripe.service';

const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;
  
  try {
    const session = await stripeService.createCheckoutSession(priceId);
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error creating checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/create-portal-session', async (req, res) => {
  const { customerId } = req.body;

  try {
    const session = await stripeService.createPortalSession(customerId);
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error creating portal session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;