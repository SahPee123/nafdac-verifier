import { NextRequest, NextResponse } from "next/server";

async function queryGreenbook(searchTerm: string) {
  const baseUrl = "https://greenbook.nafdac.gov.ng";

  // Step 1: Get CSRF token from homepage
  const homeRes = await fetch(baseUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await homeRes.text();
  const csrfMatch = html.match(/meta-csrf-token["\s]+content="([^"]+)"/i) ||
                    html.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
                    html.match(/csrf[_-]token.*?content="([^"]+)"/i) ||
                    html.match(/meta-csrf-token:\s*([^\s<]+)/i);
  const csrfToken = csrfMatch ? csrfMatch[1] : "";

  // Get cookies from homepage response
  const cookies = homeRes.headers.get("set-cookie") || "";
  const cookieStr = cookies.split(",").map(c => c.split(";")[0].trim()).join("; ");

  // Step 2: Query the products DataTable endpoint
  const params = new URLSearchParams({
    draw: "1",
    "columns[0][data]": "ProductName",
    "columns[0][searchable]": "true",
    "columns[1][data]": "ActiveIngredients",
    "columns[1][searchable]": "true",
    "columns[2][data]": "ProductCategory",
    "columns[3][data]": "NRN",
    "columns[3][searchable]": "true",
    "columns[4][data]": "ApplicantName",
    "columns[5][data]": "ApprovalDate",
    "columns[6][data]": "Status",
    "order[0][column]": "0",
    "order[0][dir]": "asc",
    "start": "0",
    "length": "15",
    "search[value]": searchTerm,
    "search[regex]": "false",
  });

  const apiRes = await fetch(`${baseUrl}/products?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-TOKEN": csrfToken,
      "Referer": baseUrl,
      "Cookie": cookieStr,
    },
  });

  if (!apiRes.ok) {
    throw new Error(`API responded with ${apiRes.status}`);
  }

  const json = await apiRes.json();
  return json.data || json.aaData || [];
}

function mapProduct(item: Record<string, string>) {
  return {
    productName: item.ProductName || item.productName || "",
    nrn: item.NRN || item.nrn || "",
    status: item.Status || item.status || "Active",
    applicantName: item.ApplicantName || item.applicantName || "",
    approvalDate: item.ApprovalDate || item.approvalDate || "",
    expiryDate: "",
    productCategory: item.ProductCategory || item.productCategory || "",
    activeIngredients: item.ActiveIngredients || item.activeIngredients || "",
    manufacturer: "",
    form: item.Form || item.form || "",
    strengths: item.Strengths || item.strengths || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { productName, nafdacNumber } = await req.json();

    let results: Record<string, string>[] = [];
    let searchMethod = "";

    // Search by NRN first, then product name
    if (nafdacNumber) {
      try {
        results = await queryGreenbook(nafdacNumber);
        if (results.length > 0) searchMethod = "NAFDAC Registration Number";
      } catch (e) {
        console.warn("NRN search failed:", e);
      }
    }

    if (results.length === 0 && productName) {
      try {
        results = await queryGreenbook(productName);
        if (results.length > 0) searchMethod = "Product Name";
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
        searchedFor: { productName, nafdacNumber, manufacturer: "" },
      });
    }

    const mapped = results.map(mapProduct);
    const activeProducts = mapped.filter(
      (p) => !p.status || p.status.toLowerCase() === "active"
    );

    return NextResponse.json({
      status: activeProducts.length > 0 ? "approved" : "expired",
      searchMethod,
      message: activeProducts.length > 0
        ? "Product found and ACTIVE in the NAFDAC Greenbook."
        : "Product found but registration may be expired.",
      products: mapped.slice(0, 3),
      searchedFor: { productName, nafdacNumber, manufacturer: "" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}