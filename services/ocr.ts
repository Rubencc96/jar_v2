import { createWorker } from 'tesseract.js';
import { ParseResult } from '../types';

/**
 * Pre-processes the image for better OCR results and memory management.
 * 1. Resizes massive images (12MP+) to a max width of 1500px.
 * 2. Converts to grayscale.
 * 3. Increases contrast.
 */
const preprocessImage = (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(base64Image); // Fallback if canvas fails
        return;
      }

      // 1. Resize logic
      // Max width of 1500px is usually sufficient for text receipt reading
      // and prevents browser crashes on mobile.
      const MAX_WIDTH = 1500;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(img, 0, 0, width, height);

      // 2. Grayscale & Contrast
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Simple high contrast grayscale filter
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Standard luminosity grayscale
        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        // Increase contrast
        // Thresholding: if lighter than 128, make it white, else black. 
        // This is "Binarization" which Tesseract likes.
        // However, simple contrast is safer for varying lighting.
        // Let's do a soft contrast stretch.
        gray = (gray > 120) ? 255 : (gray < 80) ? 0 : gray;

        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = (e) => reject(e);
  });
};

export const parseReceiptImage = async (base64Image: string): Promise<ParseResult> => {
  try {
    // Step 0: Pre-process image to avoid crash on mobile and improve text contrast
    const processedImage = await preprocessImage(base64Image);

    // Step 1: Initialize Tesseract worker
    const worker = await createWorker('eng');
    
    // Step 2: Perform OCR
    const ret = await worker.recognize(processedImage);
    const text = ret.data.text;
    
    await worker.terminate();

    // Step 3: Parse the raw text using regex heuristics
    const items: { name: string; price: number }[] = [];
    const lines = text.split('\n');
    
    // Regex explanation:
    // ^(.+?)       -> Capture name (lazy)
    // \s+          -> Separator space
    // ([0-9]+[.,]?[0-9]*[.,][0-9]{2}) -> Capture price.
    //    Allows formats: 10.00, 10,00, 1.000,00
    //    Note: Tesseract often reads '10.00' as '10 00' or '10.OO'. 
    //    This regex looks for strict numbers.
    const priceRegex = /^(.+?)\s+([0-9]{1,3}(?:[.,\s]?[0-9]{3})*[.,][0-9]{2})\s*$/;

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip likely headers/footers based on keywords
      if (/total|subtotal|change|cash|visa|mastercard|date|time|tax/i.test(trimmedLine)) continue;

      // Skip lines that are too short to be items
      if (trimmedLine.length < 5) continue;

      const match = trimmedLine.match(priceRegex);
      if (match) {
        const name = match[1].trim()
          .replace(/[.|_—-]+$/, '') // Clean up trailing dots/dashes
          .replace(/[^a-zA-Z0-9\s%&()-]/g, ''); // Remove random noise characters from name
        
        // Normalize price: remove spaces, replace ',' with '.'
        // Handle European 1.000,00 vs US 1,000.00 is tricky without knowing locale.
        // Assumption: The LAST separator is the decimal separator.
        let priceStr = match[2].replace(/\s/g, ''); 
        
        // Check if comma is the last separator
        if (priceStr.indexOf(',') > priceStr.indexOf('.')) {
             priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
             priceStr = priceStr.replace(/,/g, '');
        }
        
        const price = parseFloat(priceStr);

        // Basic sanity checks
        if (name.length > 1 && !isNaN(price) && price > 0 && price < 10000) {
          items.push({ name, price });
        }
      }
    }

    if (items.length === 0) {
      console.warn("OCR found text but regex matched no items. Raw text sample:", text.substring(0, 200));
    }

    return { items };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to process image. It might be too large or unclear.");
  }
};
