import functions from '@react-native-firebase/functions';

// Asks the createPaymentIntent Cloud Function (firebase/functions/src/payments.ts)
// to open a Stripe charge for this ride's final fare and returns the
// PaymentIntent's client_secret, which the caller hands to Stripe's own
// Payment Sheet (via useStripe() in the component) to actually collect
// card details — this app/backend never sees or stores card numbers.
export async function createCardPaymentIntent(rideId: string): Promise<string> {
  const callable = functions().httpsCallable('createPaymentIntent');
  const result = await callable({ rideId });
  const clientSecret = (result.data as { clientSecret?: string } | undefined)?.clientSecret;
  if (!clientSecret) {
    throw new Error('Неуспешно стартиране на плащането. Опитай отново.');
  }
  return clientSecret;
}
