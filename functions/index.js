const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Webhook handler for Scalev payments.
 * Extracts email and payment_status to upgrade user to Premium in Firestore.
 */
exports.scalevWebhook = onRequest(async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const payload = req.body;
  console.log("Scalev Webhook Received:", JSON.stringify(payload));

  // Extract email and payment status
  // Handle various potential structures (Scalev typical or flat)
  const email = payload.email || 
                (payload.customer && payload.customer.email) || 
                payload.customer_email;
                
  const status = payload.payment_status || 
                 (payload.order && payload.order.status) || 
                 payload.status;

  if (!email) {
    console.error("Validation Error: No email found in payload");
    res.status(400).send("Bad Request: Email is required");
    return;
  }

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(email.toLowerCase().trim());

    // Scalev/Midtrans success statuses: PAID, COMPLETED, settlement, etc.
    const successStatuses = ["PAID", "COMPLETED", "SUCCEEDED", "settlement", "captured"];
    const isSuccess = status && successStatuses.includes(status);

    if (isSuccess) {
      await userRef.set({
        isPremium: true,
        lastPaymentStatus: status,
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`SUCCESS: User ${email} upgraded to Premium. Status: ${status}`);
      res.status(200).send("User upgraded successfully");
    } else {
      console.log(`INFO: Payment status '${status}' for ${email} did not trigger upgrade.`);
      res.status(200).send(`Received. Status: ${status}`);
    }
  } catch (error) {
    console.error("FIRESTORE ERROR:", error);
    res.status(500).send("Internal Server Error");
  }
});
