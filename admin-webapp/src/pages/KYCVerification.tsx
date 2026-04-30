import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import snsWebSdk from "@sumsub/websdk";
import heTranslations from "../assets/sumsub-i18n-he.json";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type DriverType = "rideshare" | "licensed_taxi";

interface TokenResponse {
  token: string;
  level_name: string;
}

// ------------------------------------------------------------------
// KYCVerification page
// ------------------------------------------------------------------
export default function KYCVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // driver_type can come from query-param ?type=licensed_taxi, default rideshare
  const driverType: DriverType =
    searchParams.get("type") === "licensed_taxi" ? "licensed_taxi" : "rideshare";

  // ------------------------------------------------------------------
  // Fetch SDK token from backend
  // ------------------------------------------------------------------
  const fetchToken = useCallback(async (): Promise<string> => {
    const jwt = localStorage.getItem("access_token");
    const resp = await fetch("/api/sumsub/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify({ driver_type: driverType }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.detail ?? "שגיאה בקבלת טוקן אימות");
    }

    const data: TokenResponse = await resp.json();
    return data.token;
  }, [driverType]);

  // ------------------------------------------------------------------
  // Launch WebSDK
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const launch = async () => {
      if (!containerRef.current) return;

      try {
        const token = await fetchToken();
        if (cancelled) return;

        setStatus("ready");

        snsWebSdk
          .init(token, () => fetchToken())
          .withConf({
            lang: "he",
            i18n: heTranslations,
            uiConf: {
              customCssStr: `
                .step-name { font-family: 'Rubik', sans-serif; }
                body { direction: rtl; }
              `,
            },
          })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onError", (error: unknown) => {
            console.error("[Sumsub] SDK error:", error);
            if (!cancelled) setStatus("error");
          })
          .onMessage((type: string, payload: unknown) => {
            console.log("[Sumsub] message:", type, payload);
            if (type === "idCheck.applicantReviewComplete") {
              if (!cancelled) setStatus("success");
              setTimeout(() => navigate("/driver/status"), 2500);
            }
          })
          .build()
          .launch("#sumsub-container");
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "שגיאה בלתי צפויה");
        }
      }
    };

    launch();
    return () => {
      cancelled = true;
    };
  }, [fetchToken, navigate]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        fontFamily: "'Rubik', 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🚕</div>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>
          אימות זהות נהג
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>
          {driverType === "licensed_taxi"
            ? "אימות לרישיון נהג מונית"
            : "אימות לנהג שיתופי"}
        </p>
      </div>

      {/* Status overlays */}
      {status === "loading" && (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid #334155",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p>טוען מערכת אימות...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #ef4444",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ color: "#ef4444", margin: "0 0 12px" }}>שגיאה בטעינה</h2>
          <p style={{ color: "#94a3b8", margin: "0 0 20px" }}>
            {errorMsg || "לא ניתן לטעון את מערכת האימות"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            נסה שוב
          </button>
        </div>
      )}

      {status === "success" && (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #22c55e",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "#22c55e", margin: "0 0 12px" }}>האימות הושלם!</h2>
          <p style={{ color: "#94a3b8" }}>מעביר אותך לדף הסטטוס...</p>
        </div>
      )}

      {/* Sumsub iframe container — shown when ready or in flight */}
      <div
        id="sumsub-container"
        ref={containerRef}
        style={{
          width: "100%",
          maxWidth: 680,
          minHeight: 500,
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          display: status === "loading" || status === "error" || status === "success"
            ? "none"
            : "block",
        }}
      />
    </div>
  );
}
