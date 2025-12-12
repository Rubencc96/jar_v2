import { createWorker } from 'tesseract.js';
import { ParseResult } from '../types';

export const parseReceiptImage = async (base64Image: string): Promise<ParseResult> => {
  try {
    // Initialize Tesseract worker
    const worker = await createWorker('eng');
    
    // Perform OCR
    const ret = await worker.recognize(base64Image);
    const text = ret.data.text;
    
    await worker.terminate();

    // Parse the raw text using regex heuristics
    const items: { name: string; price: number }[] = [];
    const lines = text.split('\n');
    
    // Regex to match lines ending in a price (e.g., "Burger 10.00" or "Fries ... 5,50")
    // Captures group 1 (Name) and group 2 (Price)
    const priceRegex = /^(.+?)\s+([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\s*$/;

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip likely headers/footers based on keywords
      if (/total|tax|subtotal|change|cash|visa|mastercard/i.test(trimmedLine)) continue;

      const match = trimmedLine.match(priceRegex);
      if (match) {
        const name = match[1].trim().replace(/[.|_—-]+$/, '').trim(); // Clean up trailing dots/dashes
        // Normalize price: replace ',' with '.'
        const priceStr = match[2].replace(',', '.');
        const price = parseFloat(priceStr);

        // Basic sanity checks
        if (name.length > 2 && !isNaN(price) && price > 0) {
          items.push({ name, price });
        }
      }
    }

    if (items.length === 0) {
      console.warn("OCR found text but regex matched no items. Raw text:", text);
      // Fallback: Return at least one empty item if nothing found so user doesn't get stuck
      // But returning empty array is handled by App.tsx
    }

    return { items };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to read receipt. Please try a clearer image.");
  }
};
