import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: imageBase64,
        },
      },
      `You are analyzing a Nigerian product label to extract information for NAFDAC verification.

Extract the following and respond ONLY with valid JSON (no markdown, no backticks):
{
  "productName": "exact product/brand name as shown",
  "nafdacNumber": "NAFDAC registration number if visible (format like A4-1234 or B4-5678)",
  "manufacturer": "manufacturer or company name if visible",
  "activeIngredients": "active ingredients if visible, comma separated",
  "productCategory": "drug/food/cosmetic/water/etc if identifiable",
  "confidence": "high/medium/low based on image clarity",
  "notes": "any notes about visibility or extraction quality"
}

If a field is not visible, use null. For nafdacNumber, look for text like "NAFDAC REG. NO.", "NRN:", "Reg No:". Return ONLY the JSON object.`,
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, "").trim();
    const extracted = JSON.parse(cleaned);

    return NextResponse.json({ extracted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}