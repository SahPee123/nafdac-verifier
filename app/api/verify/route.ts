import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { productName, nafdacNumber } = await req.json();

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": "https://greenbook.nafdac.gov.ng/",
    };

    let results: Record<string, string>[] = [];
    let searchMethod = "";

    // Try NRN search first
    if (nafdacNumber) {
      try {
        const url = `https://greenbook.nafdac.gov.ng/products?draw=1&columns[0][data]=ProductName&columns[1][data]=ActiveIngredients&columns[2][data]=ProductCategory&columns[3][data]=NRN&columns[4][data]=ApplicantName&columns[5][data]=ApprovalDate&columns[6][data]=Status&order[0][column]=0&order[0][dir]=asc&start=0&length=10&search[value]=${encodeURIComponent(nafdacNumber)}&search[regex]=false`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const json = await res.json();
            const data = json.data || json.aaData || [];
            if (data.length > 0) {
              results = data;
              searchMethod = "NAFDAC Registration Number";
            }
          }
        }
      } catch (e) {
        console.warn("NRN search failed", e);
      }
    }

    // Try product name search
    if (results.length === 0 && productName) {
      try {
        const url = `https://greenbook.nafdac.gov.ng/products?draw=1&columns[0][data]=ProductName&columns[1][data]=ActiveIngredients&columns[2][data]=ProductCategory&columns[3][data]=NRN&columns[4][data]=ApplicantName&columns[5][data]=ApprovalDate&columns[6][data]=Status&order[0][column]=0&order[0][dir]=asc&start=0&length=10&search[value]=${encodeURIComponent(productName)}&search[regex]=false`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const json = await res.json();
            const data = json.data || json.aaData || [];
            if (data.length > 0) {
              results = data;
              searchMethod = "Product Name";
            }
          }
        }
      } catch (e) {
        console.warn("Name search failed", e);
      }
    }

    // Try the main page search as fallback
    if (results.length === 0) {
      try {
        const query = nafdacNumber || productName;
        const url = `https://greenbook.nafdac.gov.ng/?search=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const html = await res.text();
          // Check if product name appears in the page
          if (productName && html.toLowerCase().includes(productName.toLowerCase())) {
            return NextResponse.json({
              status: "approved",
              searchMethod: "Page Search",
              message: "Product found in the NAFDAC Greenbook.",
              products: [{ productName: productName, nrn: nafdacNumber || "", status: "Active", applicantName: "", approvalDate: "", expiryDate: "", productCategory: "", activeIngredients: "", manufacturer: "", form: "", strengths: "" }],
              searchedFor: { productName, nafdacNumber, manufacturer: "" },
            });
          }
        }
      } catch (e) {
        console.warn("Page search failed", e);
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

    const mapped = results.map((item) => ({
      productName: item.ProductName || item.productName || item[0] || "",
      nrn: item.NRN || item.nrn || item[3] || "",
      status: item.Status || item.status || item[6] || "Active",
      applicantName: item.ApplicantName || item.applicantName || item[4] || "",
      approvalDate: item.ApprovalDate || item.approvalDate || item[5] || "",
      expiryDate: "",
      productCategory: item.ProductCategory || item.productCategory || item[2] || "",
      activeIngredients: item.ActiveIngredients || item.activeIngredients || item[1] || "",
      manufacturer: "",
      form: item.Form || item.form || "",
      strengths: item.Strengths || item.strengths || "",
    }));

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