import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getDatabase } from 'firebase-admin/database';
import Stripe from 'stripe';

// Set both with:
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
// The secret key never reaches the app — only this backend and Stripe's
// own SDK ever see it. The publishable key (safe to embed in the app) is
// a separate, non-secret value set in mobile/app.config.js instead.
export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

function getStripe(): Stripe {
  return new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });
}

type RideRecord = {
  riderId: string;
  status: string;
  paymentMethod: 'cash' | 'card';
  finalFareBGN: number | null;
  fareEstimateBGN: number;
};

// Called by the rider's client once the driver has completed the trip and
// the ride's paymentMethod is 'card'. Creates a Stripe PaymentIntent for
// the ride's final fare and returns its client_secret so the app can
// present Stripe's own Payment Sheet — card details never touch this
// backend or the Realtime Database, only Stripe's PCI-compliant SDK does.
export const createPaymentIntent = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Трябва да си влязъл в профила си.');

  const rideId = request.data?.rideId as string | undefined;
  if (!rideId) throw new HttpsError('invalid-argument', 'Липсва rideId.');

  const db = getDatabase();
  const rideSnapshot = await db.ref(`/rides/${rideId}`).get();
  if (!rideSnapshot.exists()) throw new HttpsError('not-found', 'Пътуването не е намерено.');
  const ride = rideSnapshot.val() as RideRecord;

  if (ride.riderId !== uid) {
    throw new HttpsError('permission-denied', 'Това не е твоето пътуване.');
  }
  if (ride.status !== 'completed') {
    throw new HttpsError('failed-precondition', 'Пътуването все още не е приключило.');
  }
  if (ride.paymentMethod !== 'card') {
    throw new HttpsError('failed-precondition', 'Това пътуване не е с плащане с карта.');
  }

  const fareBGN = ride.finalFareBGN ?? ride.fareEstimateBGN;
  const amountStotinki = Math.round(fareBGN * 100);
  if (!(amountStotinki > 0)) {
    throw new HttpsError('failed-precondition', 'Невалидна сума за плащане.');
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountStotinki,
    currency: 'bgn',
    metadata: { rideId, riderId: uid },
    automatic_payment_methods: { enabled: true },
  });

  await db.ref(`/rides/${rideId}`).update({
    paymentStatus: 'pending',
    stripePaymentIntentId: paymentIntent.id,
  });

  return { clientSecret: paymentIntent.client_secret };
});

// Configured as a webhook endpoint in the Stripe dashboard, pointed at
// this function's deployed URL — Stripe calls it directly once a payment
// actually succeeds or fails server-side. This is the ONLY thing allowed
// to mark a ride as paid, so a dishonest client can't just write
// paymentStatus: 'paid' to the database without a real, Stripe-confirmed
// charge.
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = getStripe();
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature as string, stripeWebhookSecret.value());
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', err);
      res.status(400).send('Invalid signature');
      return;
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const rideId = intent.metadata?.rideId;
      if (rideId) {
        const paymentStatus = event.type === 'payment_intent.succeeded' ? 'paid' : 'failed';
        await getDatabase().ref(`/rides/${rideId}`).update({ paymentStatus });
        logger.info(`Ride ${rideId} payment ${paymentStatus} (intent ${intent.id})`);
      }
    }

    res.status(200).send('ok');
  }
);
