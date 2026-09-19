const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(geminiKey);
const preferredModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

async function getAvailableOCRModel() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey)}`);
    if (!response.ok) throw new Error(`Model listing returned ${response.status}`);
    const payload = await response.json();
    const models = payload.models || [];
    for (const preferred of preferredModels) {
      const found = models.find(model => model.name?.includes(preferred) && (model.supportedGenerationMethods || []).includes('generateContent'));
      if (found) return found.name.replace(/^models\//, '');
    }
  } catch (error) {
    console.warn('[OCR] Model discovery failed:', error.message);
  }
  return 'gemini-1.5-flash';
}

const cleanJson = (text) => text
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

async function processReceiptOCR(imageBuffer, mimeType = 'image/jpeg') {
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');

  const modelName = await getAvailableOCRModel();
  const model = genAI.getGenerativeModel({ model: modelName });
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType
    }
  };
  const prompt = `Analyze this payment receipt image and return only valid JSON with these keys: amount (number or null), referenceNumber (string or null), timestamp (string or null), isValidReceipt (boolean).`;
  const result = await model.generateContent([prompt, imagePart]);
  const rawText = (await result.response).text();

  try {
    const parsed = JSON.parse(cleanJson(rawText));
    return {
      amount: parsed.amount ?? null,
      referenceNumber: parsed.referenceNumber ?? parsed.referenceNo ?? null,
      timestamp: parsed.timestamp ?? parsed.date ?? null,
      isValidReceipt: Boolean(parsed.isValidReceipt ?? parsed.isReceipt),
      modelName
    };
  } catch (error) {
    console.error('[OCR] Failed to parse model response:', rawText);
    return { amount: null, referenceNumber: null, timestamp: null, isValidReceipt: false, rawText, modelName };
  }
}

module.exports = { getAvailableOCRModel, processReceiptOCR };
