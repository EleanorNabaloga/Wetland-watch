// lib/device.js

/**
 * Generates an ECDSA key pair and signs the evidence payload.
 * We generate a fresh key pair for every report to maintain whistleblower anonymity.
 */
export async function signEvidence(evidenceArray) {
  // 1. Generate a secure key pair
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  // 2. Export the public key so NEMA can verify the signature later
  const exportedPubKey = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );
  const publicKeyBase64 = btoa(
    String.fromCharCode(...new Uint8Array(exportedPubKey)),
  );

  // 3. Prepare the data to be signed
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(evidenceArray));

  // 4. Sign the data with the private key
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    keyPair.privateKey,
    data,
  );

  const signatureBase64 = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  );

  return { signature: signatureBase64, publicKey: publicKeyBase64 };
}
