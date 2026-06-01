"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ExtractedInfo {
  productName: string | null;
  nafdacNumber: string | null;
  manufacturer: string | null;
  activeIngredients: string | null;
  productCategory: string | null;
  confidence: string;
  notes: string | null;
}

interface VerifyProduct {
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

interface VerifyResult {
  status: "approved" | "not_found" | "expired" | "error";
  searchMethod: string;
  message: string;
  products: VerifyProduct[];
  searchedFor: { productName: string; nafdacNumber: string; manufacturer: string };
  error?: string;
}

interface Suggestion {
  productName: string;
  nrn: string;
  activeIngredients: string;
  applicantName: string;
  productCategory: string;
  status: string;
  form: string;
  strengths: string;
}

type Step = "idle" | "extracting" | "verifying" | "done";
type InputMode = "photo" | "text";

export default function Home() {
  // Shared
  const [inputMode, setInputMode] = useState<InputMode>("photo");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInfo | null>(null);

  // Photo mode
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Text mode
  const [textQuery, setTextQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Suggestion fetch with debounce ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (textQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(textQuery.trim())}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions((data.suggestions || []).length > 0);
        setActiveSuggestionIdx(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [textQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSuggestionSelect = (s: Suggestion) => {
    setSelectedSuggestion(s);
    setTextQuery(s.productName);
    setShowSuggestions(false);
    setStep("idle");
    setResult(null);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeSuggestionIdx >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[activeSuggestionIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // ── Photo mode ───────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    const mime = file.type || "image/jpeg";
    setImageMime(mime);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setStep("idle");
      setExtracted(null);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processFile(file);
  };

  // ── Verify (photo) ───────────────────────────────────────────────────────
  const handleVerifyPhoto = async () => {
    if (!imageBase64) return;
    setStep("extracting");
    setExtracted(null);
    setResult(null);

    let info: ExtractedInfo | null = null;
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      info = data.extracted;
      setExtracted(info);
    } catch {
      setResult({ status: "error", message: "Could not read product details from image.", products: [], searchedFor: { productName: "", nafdacNumber: "", manufacturer: "" }, searchMethod: "" });
      setStep("done");
      return;
    }

    setStep("verifying");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: info?.productName, nafdacNumber: info?.nafdacNumber, manufacturer: info?.manufacturer }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Could not reach NAFDAC Greenbook. Please try again.", products: [], searchedFor: { productName: "", nafdacNumber: "", manufacturer: "" }, searchMethod: "" });
    }
    setStep("done");
  };

  // ── Verify (text) ────────────────────────────────────────────────────────
  const handleVerifyText = async () => {
    if (!textQuery.trim()) return;
    setStep("verifying");
    setResult(null);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: textQuery.trim(),
          nafdacNumber: selectedSuggestion?.nrn || null,
          manufacturer: null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch {
      setResult({ status: "error", message: "Could not reach NAFDAC Greenbook. Please try again.", products: [], searchedFor: { productName: "", nafdacNumber: "", manufacturer: "" }, searchMethod: "" });
    }
    setStep("done");
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setStep("idle");
    setExtracted(null);
    setResult(null);
    setTextQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestion(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const switchMode = (mode: InputMode) => {
    setInputMode(mode);
    reset();
  };

  const statusConfig = {
    approved: { icon: "✅", label: "NAFDAC Approved", className: "approved" },
    not_found: { icon: "❌", label: "Not Found", className: "not-found" },
    expired: { icon: "⚠️", label: "Registration Expired", className: "partial" },
    error: { icon: "⚠️", label: "Error", className: "partial" },
  };

  const isLoading = step === "extracting" || step === "verifying";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-mark">NF<br />AC</div>
          <div>
            <div className="header-title">NAFDAC Verify</div>
            <div className="header-sub">Greenbook Checker</div>
          </div>
        </div>
        <div className="header-badge">🇳🇬 Nigeria</div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">AI-Powered Product Verification</div>
        <h1>Is This Product<br />NAFDAC Approved?</h1>
        <p>Check any product against Nigeria&apos;s official NAFDAC Greenbook — by photo or product name.</p>
      </section>

      {/* Main */}
      <main className="main">

        {/* ── Mode Tabs ── */}
        {step === "idle" && !imagePreview && (
          <div className="mode-tabs">
            <button
              className={`mode-tab ${inputMode === "photo" ? "active" : ""}`}
              onClick={() => switchMode("photo")}
            >
              <span className="mode-tab-icon">📷</span>
              <span>Photo / Upload</span>
            </button>
            <button
              className={`mode-tab ${inputMode === "text" ? "active" : ""}`}
              onClick={() => switchMode("text")}
            >
              <span className="mode-tab-icon">🔤</span>
              <span>Type Product Name</span>
            </button>
          </div>
        )}

        {/* ══════════════ PHOTO MODE ══════════════ */}
        {inputMode === "photo" && (
          <>
            {!imagePreview ? (
              <>
                <div
                  className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                  <div className="upload-icon">📷</div>
                  <h3>Upload Product Photo</h3>
                  <p>Drag &amp; drop, or tap to choose from gallery</p>
                  <div className="hint">JPEG · PNG · WEBP · HEIC</div>
                </div>
                <div className="camera-row" style={{ marginTop: "1rem" }}>
                  <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                    📸 Use Camera
                  </button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: "none" }} />
                </div>
              </>
            ) : (
              <>
                <div className="preview-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Product label" />
                  <button className="preview-change" onClick={reset}>✕ Clear</button>
                </div>
                {step === "idle" && (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleVerifyPhoto}>
                    🔍 Verify with NAFDAC Greenbook
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════ TEXT MODE ══════════════ */}
        {inputMode === "text" && step !== "done" && (
          <div className="text-search-wrap">
            <div className="search-field-wrap">
              <div className="search-icon">🔍</div>
              <input
                ref={searchInputRef}
                className="search-input"
                type="text"
                placeholder="e.g. Paracetamol, Lifepack, Robb…"
                value={textQuery}
                onChange={(e) => {
                  setTextQuery(e.target.value);
                  setSelectedSuggestion(null);
                  setResult(null);
                  setStep("idle");
                }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onKeyDown={handleSearchKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              {suggestLoading && <div className="search-spinner" />}
              {textQuery && !suggestLoading && (
                <button className="search-clear" onClick={() => { setTextQuery(""); setSuggestions([]); setShowSuggestions(false); setSelectedSuggestion(null); }}>✕</button>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown" ref={suggestionsRef}>
                  <div className="suggestions-header">
                    <span>Suggestions from NAFDAC Greenbook</span>
                    <span className="suggestions-count">{suggestions.length} found</span>
                  </div>
                  {suggestions.map((s, i) => (
                    <div
                      key={s.nrn || i}
                      className={`suggestion-item ${i === activeSuggestionIdx ? "active" : ""}`}
                      onMouseDown={() => handleSuggestionSelect(s)}
                      onMouseEnter={() => setActiveSuggestionIdx(i)}
                    >
                      <div className="suggestion-main">
                        <span className="suggestion-name">{s.productName}</span>
                        {s.status && (
                          <span className={`suggestion-status-dot ${s.status?.toLowerCase() === "active" ? "active" : "inactive"}`} />
                        )}
                      </div>
                      <div className="suggestion-meta">
                        {s.nrn && <span className="suggestion-nrn">{s.nrn}</span>}
                        {s.activeIngredients && <span className="suggestion-ingredient">{s.activeIngredients}</span>}
                        {s.applicantName && <span className="suggestion-applicant">{s.applicantName}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No results message */}
              {!suggestLoading && textQuery.trim().length >= 2 && suggestions.length === 0 && showSuggestions === false && (
                <div className="no-suggestions">No matches in database — you can still search</div>
              )}
            </div>

            {selectedSuggestion && (
              <div className="selected-suggestion-card">
                <div className="selected-label">Selected product</div>
                <div className="selected-name">{selectedSuggestion.productName}</div>
                <div className="selected-meta">
                  {selectedSuggestion.nrn && <span className="nrn-badge" style={{ fontSize: "0.7rem" }}>🏷️ {selectedSuggestion.nrn}</span>}
                  {selectedSuggestion.activeIngredients && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{selectedSuggestion.activeIngredients}</span>}
                </div>
              </div>
            )}

            {textQuery.trim().length >= 2 && step === "idle" && (
              <button className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }} onClick={handleVerifyText}>
                🔍 Verify with NAFDAC Greenbook
              </button>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="loading-wrap">
            <div className="spinner" />
            <div className="loading-step">
              {step === "extracting" ? "Reading product label with AI…" : "Checking NAFDAC Greenbook…"}
            </div>
          </div>
        )}

        {/* ── Extracted info (photo mode) ── */}
        {extracted && step === "done" && (
          <div className="extracted-section" style={{ marginTop: "1.5rem" }}>
            <div className="extracted-section-title">Extracted from image</div>
            {[
              ["Product Name", extracted.productName],
              ["NAFDAC Reg. No.", extracted.nafdacNumber],
              ["Manufacturer", extracted.manufacturer],
              ["Active Ingredients", extracted.activeIngredients],
              ["Category", extracted.productCategory],
              ["Image Clarity", extracted.confidence],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div className="extracted-item" key={k as string}>
                <span className="extracted-key">{k}</span>
                <span className="extracted-val">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Result Card ── */}
        {result && step === "done" && (
          <div className="result-card" style={{ marginTop: "1.5rem" }}>
            <div className={`result-header ${statusConfig[result.status]?.className}`}>
              <div className={`result-icon ${statusConfig[result.status]?.className}`}>
                {statusConfig[result.status]?.icon}
              </div>
              <div>
                <div className={`result-status ${statusConfig[result.status]?.className}`}>
                  {statusConfig[result.status]?.label}
                </div>
                <div className="result-title">{result.message}</div>
              </div>
            </div>

            <div className="result-body">
              {result.products && result.products.length > 0 && (
                <div className="result-section">
                  <div className="result-section-label">Product Details from Greenbook</div>
                  {result.products.slice(0, 1).map((p, i) => (
                    <div key={i}>
                      {p.nrn && (
                        <div style={{ marginBottom: "1rem" }}>
                          <span className="nrn-badge">🏷️ NRN: {p.nrn}</span>
                        </div>
                      )}
                      <div className="result-grid">
                        {[
                          ["Product Name", p.productName],
                          ["Status", p.status],
                          ["Applicant", p.applicantName],
                          ["Category", p.productCategory],
                          ["Approval Date", p.approvalDate],
                          ["Expiry Date", p.expiryDate],
                          ["Ingredients", p.activeIngredients],
                          ["Form", p.form],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div className="result-field" key={k as string}>
                            <div className="result-field-label">{k}</div>
                            <div className="result-field-value">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.searchMethod && (
                <div style={{ marginBottom: "1rem" }}>
                  <div className="result-section-label">Search Method</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Matched by: {result.searchMethod}
                  </div>
                </div>
              )}

              <a
                href={`https://greenbook.nafdac.gov.ng${result.searchedFor?.nafdacNumber ? `?nrn=${encodeURIComponent(result.searchedFor.nafdacNumber)}` : result.searchedFor?.productName ? `?name=${encodeURIComponent(result.searchedFor.productName)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="greenbook-link"
              >
                🌐 Open NAFDAC Greenbook →
              </a>

              <button className="again-btn" onClick={reset}>
                ↩ Check another product
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Data sourced from NAFDAC Greenbook · greenbook.nafdac.gov.ng · Not an official NAFDAC service
      </footer>
    </div>
  );
}
