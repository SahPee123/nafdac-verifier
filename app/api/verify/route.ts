import { NextRequest, NextResponse } from "next/server";

interface GreenBookProduct {
  productName: string;
  nrn: string;
  status: string;
  applicantName: string;
  approvalDate: string;
  expiryDate: string;
  productCategory: string;
  activeIngredients: string;
  manufacturer: string;
  form: string;
  strengths: string;
}

async function searchGreenbook(query: string, field: "name" | "nrn"): Promise<GreenBookProduct[]> {
  const baseUrl = "https://greenbook.nafdac.gov.ng";
  
  // Build search URL based on field type
  const searchParam = field === "nrn" ? `nrn=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
  const url = `${baseUrl}/products?${searchParam}&limit=5`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json, text/html, */*",
      "User-Agent": "Mozilla/5.0 (compatible; NAFDACVerifier/1.0)",
      "Referer": "https://greenbook.nafdac.gov.ng/",
      "X-Requested-With": "XMLHttpRequest",
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) {
    throw new Error(`Greenbook request failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    const json = await res.json();
    // The API may return an array or object with data key
    const items = Array.isArray(json) ? json : json.data || json.products || [];
    return items.map(mapProduct);
  }

  // If HTML returned, parse it
  const html = await res.text();
  return parseGreenbookHTML(html, query);
}

function mapProduct(item: Record<string, string>): GreenBookProduct {
  return {
    productName: item["Product Name"] || item.productName || item.name || "",
    nrn: item["NRN"] || item.nrn || item.registrationNumber || "",
    status: item["Status"] || item.status || "Unknown",
    applicantName: item["Applicant Name"] || item.applicantName || "",
    approvalDate: item["Approval Date"] || item.approvalDate || "",
    expiryDate: item.expiryDate || item["Expiry Date"] || "",
    productCategory: item["Product Category"] || item.productCategory || "",
    activeIngredients: item["Active Ingredients"] || item.activeIngredients || "",
    manufacturer: item.manufacturer || item.manufacturerName || "",
    form: item["Form"] || item.form || "",
    strengths: item["Strengths"] || item.strengths || "",
  };
}

function parseGreenbookHTML(html: string, _query: string): GreenBookProduct[] {
  // Extract table rows from the HTML
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const products: GreenBookProduct[] = [];

  const rows = html.match(rowRegex) || [];
  
  for (const row of rows) {
    const cells: string[] = [];
    let cellMatch;
    const cellRe = new RegExp(cellRegex.source, "gi");
    
    while ((cellMatch = cellRe.exec(row)) !== null) {
      // Strip HTML tags from cell content
      const text = cellMatch[1].replace(/<[^>]+>/g, "").trim();
      cells.push(text);
    }
    
    // NAFDAC table: ProductName | ActiveIngredients | ProductCategory | ProductCategoryID | Synonym | NRN | Form | ROA | Strengths | ApplicantName | ApprovalDate | Status
    if (cells.length >= 6 && cells[5] && /[A-Z]\d{1,2}-\d+/.test(cells[5])) {
      products.push({
        productName: cells[0] || "",
        activeIngredients: cells[1] || "",
        productCategory: cells[2] || "",
        nrn: cells[5] || "",
        form: cells[6] || "",
        strengths: cells[8] || "",
        applicantName: cells[9] || "",
        approvalDate: cells[10] || "",
        status: cells[11] || "Active",
        expiryDate: "",
        manufacturer: "",
      });
    }
  }

  return products;
}

export async function POST(req: NextRequest) {
  try {
    const { productName, nafdacNumber, manufacturer } = await req.json();

    let results: GreenBookProduct[] = [];
    let searchMethod = "";

    // Priority 1: Search by NAFDAC registration number (most reliable)
    if (nafdacNumber) {
      try {
        results = await searchGreenbook(nafdacNumber, "nrn");
        searchMethod = "NAFDAC Registration Number";
      } catch (e) {
        console.warn("NRN search failed:", e);
      }
    }

    // Priority 2: Search by product name
    if (results.length === 0 && productName) {
      try {
        results = await searchGreenbook(productName, "name");
        searchMethod = "Product Name";
      } catch (e) {
        console.warn("Name search failed:", e);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        status: "not_found",
        searchMethod,
        message: "No matching product found in the NAFDAC Greenbook database.",
        products: [],
        searchedFor: { productName, nafdacNumber, manufacturer },
      });
    }

    // Check if any result is Active
    const activeProducts = results.filter(
      (p) => p.status?.toLowerCase() === "active" || !p.status
    );

    return NextResponse.json({
      status: activeProducts.length > 0 ? "approved" : "expired",
      searchMethod,
      message:
        activeProducts.length > 0
          ? "Product found and ACTIVE in the NAFDAC Greenbook."
          : "Product found but registration may be expired.",
      products: results.slice(0, 3),
      searchedFor: { productName, nafdacNumber, manufacturer },
    });
  } catch (error: unknown) {
    console.error("Verify error:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
