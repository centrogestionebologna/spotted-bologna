const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const db = getFirestore();
const usersRef = db.collection("users");
const communityStatsRef = db.collection("publicStats").doc("community");

const aggiornaConteggioIscritti = async () => {
  const snapshot = await usersRef.count().get();
  const numeroIscritti = snapshot.data().count;

  await communityStatsRef.set({ numeroIscritti }, { merge: true });
  return numeroIscritti;
};

exports.sincronizzaConteggioIscritti = onDocumentWritten(
  "users/{userId}",
  async (event) => {
    const prima = event.data?.before.exists || false;
    const dopo = event.data?.after.exists || false;

    // Le modifiche ai dati del profilo non cambiano il numero degli iscritti.
    if (prima === dopo) return;

    await aggiornaConteggioIscritti();
  }
);

exports.leggiConteggioIscritti = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Accedi per visualizzare il conteggio degli iscritti."
    );
  }

  const numeroIscritti = await aggiornaConteggioIscritti();
  return { numeroIscritti };
});
