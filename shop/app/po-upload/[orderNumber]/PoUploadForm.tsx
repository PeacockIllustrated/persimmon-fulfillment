"use client";

import { useState, useRef } from "react";

export default function PoUploadForm({
  orderNumber,
  token,
  justRaised,
}: {
  orderNumber: string;
  token: string;
  justRaised: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setError(null);
    if (f.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(f.type)) {
      setError("Please upload a PDF or image file.");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/orders/${orderNumber}/upload-po?t=${token}`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setUploaded(true);
      } else {
        const data = await res.json();
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen m-0" style={{ background: "#f8faf9", fontFamily: "Arial, sans-serif" }}>
      <div className="text-center bg-white rounded-2xl shadow-lg max-w-[440px] w-full mx-4" style={{ padding: "40px" }}>

        {/* PO Raised confirmation */}
        {justRaised && !uploaded && (
          <>
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#3db28c" }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "#00474a" }}>PO Request Sent</h1>
            <p className="text-sm text-gray-500 mb-6">
              Order <strong>{orderNumber}</strong> has been sent for purchase order processing.
            </p>
            <hr className="border-gray-100 mb-6" />
          </>
        )}

        {/* Upload success */}
        {uploaded ? (
          <>
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#3db28c" }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "#00474a" }}>PO Uploaded</h1>
            <p className="text-sm text-gray-500">
              Your purchase order for <strong>{orderNumber}</strong> has been attached successfully. You can close this page.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-bold mb-1" style={{ color: "#00474a" }}>Upload Purchase Order</h2>
            <p className="text-xs text-gray-400 mb-5">
              Attach your PO document for order <strong>{orderNumber}</strong>
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className="rounded-xl cursor-pointer transition-all mb-4"
              style={{
                border: `2px dashed ${dragOver ? "#3db28c" : file ? "#3db28c" : "#ddd"}`,
                padding: "28px 16px",
                background: dragOver ? "#f0faf6" : file ? "#f8fdf9" : "#fafafa",
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
              />

              {file ? (
                <div>
                  <svg className="w-8 h-8 mx-auto mb-2" style={{ color: "#3db28c" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-semibold text-sm mb-0.5" style={{ color: "#00474a" }}>{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500 mb-0.5">
                    Drop your PO here or <span className="font-semibold" style={{ color: "#3db28c" }}>browse</span>
                  </p>
                  <p className="text-xs text-gray-300">PDF or image, max 5MB</p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full text-white rounded-xl font-bold text-sm transition-all"
              style={{
                background: file ? "#3db28c" : "#ccc",
                padding: "12px 24px",
                cursor: file ? "pointer" : "not-allowed",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading..." : "Upload PO"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
