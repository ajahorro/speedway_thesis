const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(geminiKey);
let availableModelsCache = { expiresAt: 0, names: [] };

const cleanJson = (text) => text
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

const parseJsonResponse = (text) => {
  const cleaned = cleanJson(text);
  try { return JSON.parse(cleaned); } catch {
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
    throw new Error('OCR model returned non-JSON text');
  }
};

/**
 * Reads a receipt with a cascading Gemini fallback. A model-level failure
 * (unavailable model, quota, timeout, or malformed result) advances to the
 * next model without exposing the API key or raw receipt to the client.
 */
async function processReceiptOCR(imageBuffer, mimeType = 'image/jpeg') {
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');

  const prompt = `Analyze this proof of payment carefully. Return ONLY a valid JSON object with these exact keys: amount (number or null), referenceNumber (string or null), timestamp (string or null), isValidReceipt (boolean), recipient (string or null), description (string or null). The timestamp must be the payment date/time printed on the receipt, not the date this scan was performed.`;
  const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };
  let lastError;
  const now = Date.now();
  if (availableModelsCache.expiresAt <= now) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey)}`);
    if (!response.ok) throw new Error(`Gemini model discovery failed (${response.status})`);
    const payload = await response.json();
    availableModelsCache = {
      expiresAt: now + 5 * 60 * 1000,
      names: (payload.models || [])
        .filter(model => model.name && (model.supportedGenerationMethods || []).includes('generateContent'))
        .map(model => model.name.replace(/^models\//, ''))
        .filter(name => /^gemini/i.test(name) && /flash/i.test(name) && !/2\.5-flash/i.test(name))
        .sort((a, b) => {
          const rank = name => name.includes('3.6-flash') ? 0 : name.includes('flash-latest') ? 1 : name.includes('3.5-flash') ? 2 : 3;
          return rank(a) - rank(b);
        })
    };
      console.log(`[OCR] Discovered ${availableModelsCache.names.length} Gemini generateContent model(s).`);
      if (!availableModelsCache.names.length) throw new Error('Gemini returned no models supporting generateContent');
  }

  for (const modelName of availableModelsCache.names.slice(0, 2)) {
    try {
      console.log(`[OCR] Attempting receipt scan with ${modelName}.`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OCR model timeout')), 9000))
      ]);
      const rawText = (await result.response).text();
      const parsed = parseJsonResponse(rawText);

      console.log(`[OCR] Receipt scan succeeded with ${modelName}.`);
      return {
        amount: parsed.amount ?? null,
        referenceNumber: parsed.referenceNumber ?? parsed.referenceNo ?? null,
        timestamp: parsed.timestamp ?? parsed.date ?? null,
        isValidReceipt: Boolean(parsed.isValidReceipt ?? parsed.isReceipt),
        recipient: parsed.recipient ?? null,
        description: parsed.description ?? null,
        modelName
      };
    } catch (error) {
      lastError = error;
      console.warn(`[OCR] ${modelName} failed: ${error.message}`);
    }
  }

  const unavailableError = new Error(`ALL_MODELS_FAILED: ${lastError?.message || 'Unknown OCR failure'}`);
  unavailableError.cause = lastError;
  throw unavailableError;
}

module.exports = { processReceiptOCR };
