"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          background: "#f3f0e8",
          color: "#1d2522",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <section style={{ maxWidth: 520, textAlign: "center" }}>
            <h1>Die Anwendung ist vorübergehend nicht verfügbar</h1>
            <p>Bitte versuchen Sie es erneut.</p>
            <button type="button" onClick={() => retry()}>
              Erneut versuchen
            </button>
            {error.digest ? <p>Fehler-ID: {error.digest}</p> : null}
          </section>
        </main>
      </body>
    </html>
  );
}
