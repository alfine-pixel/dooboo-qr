const Stripe = require('stripe');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    if (!getApps().length) {
      initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        databaseURL: 'https://dooboo-qr-default-rtdb.asia-southeast1.firebasedatabase.app'
      });
    }

    const db = getDatabase();
    await db.ref(`orders/${orderId}`).update({ status: 'NEW' });
  }

  res.status(200).json({ received: true });
}
