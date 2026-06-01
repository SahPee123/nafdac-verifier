import { NextRequest, NextResponse } from "next/server";

export interface Suggestion {
  productName: string;
  nrn: string;
  activeIngredients: string;
  applicantName: string;
  productCategory: string;
  status: string;
  form: string;
  strengths: string;
}

function parseGreenbookTable(html: string): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Match table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const rows = html.match(rowRegex) || [];

  for (const row of rows) {
    const cells: string[] = [];
    let cellMatch;
    const cellRe = new RegExp(cellRegex.source, "gi");

    while ((cellMatch = cellRe.exec(row)) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      cells.push(text);
    }

    // Table: ProductName | ActiveIngredients | ProductCategory | ProductCategoryID | Synonym | NRN | Form | ROA | Strengths | ApplicantName | ApprovalDate | Status
    if (cells.length >= 6 && cells[0] && cells[5]) {
      suggestions.push({
        productName: cells[0] || "",
        activeIngredients: cells[1] || "",
        productCategory: cells[2] || "",
        nrn: cells[5] || "",
        form: cells[6] || "",
        strengths: cells[8] || "",
        applicantName: cells[9] || "",
        status: cells[11] || "Active",
      });
    }
  }

  return suggestions;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Try searching the Greenbook by product name
    const url = `https://greenbook.nafdac.gov.ng/products?name=${encodeURIComponent(query.trim())}&limit=10`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/html, */*",
        "User-Agent": "Mozilla/5.0 (compatible; NAFDACVerifier/1.0)",
        Referer: "https://greenbook.nafdac.gov.ng/",
        "X-Requested-With": "XMLHttpRequest",
      },
      next: { revalidate: 600 }, // cache 10 mins
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const contentType = res.headers.get("content-type") || "";
    let suggestions: Suggestion[] = [];

    if (contentType.includes("application/json")) {
      const json = await res.json();
      const items = Array.isArray(json) ? json : json.data || json.products || [];
      suggestions = items.slice(0, 10).map((item: Record<string, string>) => ({
        productName: item["Product Name"] || item.productName || item.name || "",
        nrn: item["NRN"] || item.nrn || "",
        activeIngredients: item["Active Ingredients"] || item.activeIngredients || "",
        applicantName: item["Applicant Name"] || item.applicantName || "",
        productCategory: item["Product Category"] || item.productCategory || "",
        status: item["Status"] || item.status || "Active",
        form: item["Form"] || item.form || "",
        strengths: item["Strengths"] || item.strengths || "",
      }));
    } else {
      const html = await res.text();
      suggestions = parseGreenbookTable(html).slice(0, 10);
    }

    // Filter out empty product names and deduplicate
    const seen = new Set<string>();
    const unique = suggestions.filter((s) => {
      const key = s.productName.toLowerCase();
      if (!s.productName || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ suggestions: unique });
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
