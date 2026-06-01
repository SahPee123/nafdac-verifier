import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `You are analyzing a Nigerian product label/packaging to extract information for NAFDAC verification.

Extract the following from this product image and respond ONLY with valid JSON (no markdown, no explanation):
{
  "productName": "exact product/brand name as shown",
  "nafdacNumber": "NAFDAC registration number if visible (format like A4-1234 or B4-5678 or 04-1234)",
  "manufacturer": "manufacturer or applicant company name if visible",
  "activeIngredients": "active ingredients if visible (comma separated)",
  "productCategory": "drug/food/cosmetic/water/etc if identifiable",
  "confidence": "high/medium/low based on image clarity",
  "notes": "any relevant notes about visibility or extraction quality"
}

If a field is not visible or readable, use null for that field.
For nafdacNumber, look for text like "NAFDAC REG. NO.", "NRN:", "Reg No:", or similar.
Return ONLY the JSON object.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    
    // Clean and parse JSON
    const cleaned = text.replace(/```json|```/g, "").trim();
    const extracted = JSON.parse(cleaned);

    return NextResponse.json({ extracted });
  } catch (error: unknown) {
    console.error("Extract error:", error);
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
