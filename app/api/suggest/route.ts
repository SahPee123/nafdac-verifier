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

  const cookies = homeRes.headers.get("set-cookie") || "";
  const cookieStr = cookies.split(",").map((c: string) => c.split(";")[0].trim()).join("; ");

  // Step 2: Query the products endpoint
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
    "length": "10",
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

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const results = await queryGreenbook(query.trim());

    const seen = new Set<string>();
    const suggestions = results
      .map((item: Record<string, string>) => ({
        productName: item.ProductName || item.productName || "",
        nrn: item.NRN || item.nrn || "",
        activeIngredients: item.ActiveIngredients || item.activeIngredients || "",
        applicantName: item.ApplicantName || item.applicantName || "",
        productCategory: item.ProductCategory || item.productCategory || "",
        status: item.Status || item.status || "Active",
        form: item.Form || item.form || "",
        strengths: item.Strengths || item.strengths || "",
      }))
      .filter((s: { productName: string }) => {
        const key = s.productName.toLowerCase();
        if (!s.productName || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}