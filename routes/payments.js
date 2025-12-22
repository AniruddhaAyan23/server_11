import express from 'express';
import Stripe from 'stripe';
import { getDB } from '../config/db.js';
import { verifyHR } from '../middleware/verifyHR.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent
router.post('/create-payment-intent', verifyHR, async (req, res) => {
  try {
    const { amount, packageName, employeeLimit } = req.body;

    if (!amount || !packageName || !employeeLimit) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        hrEmail: req.user.email,
        packageName,
        employeeLimit: employeeLimit.toString()
      }
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Payment failed', error: error.message });
  }
});

// Confirm payment and upgrade package
router.post('/confirm-payment', verifyHR, async (req, res) => {
  try {
    const db = getDB();
    const { paymentIntentId, packageName, employeeLimit, amount } = req.body;

    if (!paymentIntentId || !packageName || !employeeLimit || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    // Update user's package
    await db.collection('users').updateOne(
      { email: req.user.email },
      { 
        $set: { 
          packageLimit: parseInt(employeeLimit),
          subscription: packageName.toLowerCase(),
          updatedAt: new Date()
        } 
      }
    );

    // Save payment record
    await db.collection('payments').insertOne({
      hrEmail: req.user.email,
      packageName,
      employeeLimit: parseInt(employeeLimit),
      amount: parseFloat(amount),
      transactionId: paymentIntentId,
      paymentDate: new Date(),
      status: 'completed'
    });

    res.json({ 
      message: 'Package upgraded successfully',
      newLimit: parseInt(employeeLimit)
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Payment confirmation failed', error: error.message });
  }
});

// Get payment history (HR only)
router.get('/history', verifyHR, async (req, res) => {
  try {
    const db = getDB();

    const payments = await db.collection('payments')
      .find({ hrEmail: req.user.email })
      .sort({ paymentDate: -1 })
      .toArray();

    res.json({ payments });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;