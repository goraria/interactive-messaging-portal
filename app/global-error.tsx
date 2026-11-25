"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Chat
          </button>
        </main>
      </body>
    </html>
  );
}
