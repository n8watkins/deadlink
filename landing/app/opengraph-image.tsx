import { ImageResponse } from "next/og";

export const alt = "Rewire: catch every 404 and send visitors where they meant to go";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#17161b",
          color: "#f1efe9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: "#ff8a4c",
            }}
          />
          Rewire
          <div
            style={{
              marginLeft: 16,
              fontSize: 22,
              fontWeight: 500,
              color: "#a6a3ae",
              border: "2px solid #3a3a43",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            open source · self-host first
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Catch every 404.
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: "#45d39c" }}>
            Send visitors where they meant to go.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 26,
            fontFamily: "monospace",
            color: "#ece9e2",
            background: "#0a0a0c",
            border: "2px solid #2a2a31",
            borderRadius: 16,
            padding: "20px 28px",
          }}
        >
          <span style={{ color: "#ff6b70" }}>404</span>
          <span>/blog/2021/website-pricing</span>
          <span style={{ color: "#8d8a96" }}>→</span>
          <span style={{ color: "#45d39c" }}>301</span>
          <span>/guides/website-pricing</span>
        </div>
      </div>
    ),
    size,
  );
}
