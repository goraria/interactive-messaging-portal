/** @jsxImportSource hono/jsx */
/* This document is rendered by Hono, outside the Next React tree. */
/* eslint-disable @next/next/no-head-element, @next/next/no-css-tags, @next/next/no-html-link-for-pages */

const features = [
  [
    "Realtime messaging",
    "Keep every conversation moving without refreshing the page.",
  ],
  [
    "Focused conversations",
    "Find people and continue your discussions from one inbox.",
  ],
  [
    "Private by default",
    "Your account and conversations stay protected behind sign-in.",
  ],
];

export function Home() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Gorth Chat — Conversations that stay out of your way</title>
        <meta
          name="description"
          content="A focused place to talk, share, and keep in touch with the people who matter."
        />
        <link rel="stylesheet" href="/chat-landing.css" />
      </head>
      <body>
        <header class="shell header">
          <a class="brand" href="/" aria-label="Gorth Chat home">
            Gorth Chat
          </a>
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#security">Privacy</a>
            <a href="/auth/sign-in">Sign in</a>
          </nav>
        </header>
        <main class="shell">
          <section class="hero" id="top">
            <div>
              <span class="badge">Simple. Fast. Realtime.</span>
              <h1>
                Conversations that stay out of <em>your way.</em>
              </h1>
              <p class="lead">
                A focused place to talk, share, and keep in touch with the
                people who matter.
              </p>
              <div class="actions">
                <a class="button primary" href="/auth/sign-in">
                  Sign in to continue →
                </a>
                <a class="button" href="/auth/sign-up">
                  Create an account →
                </a>
              </div>
              <p class="muted">✓ Private by default · Ready in seconds</p>
            </div>
            <aside class="preview" aria-label="Illustration of a conversation">
              <div class="preview-title">
                <span class="avatar">JC</span>
                <div>
                  <strong>Japtor Community</strong>
                  <small>Conversation preview</small>
                </div>
              </div>
              <div class="messages">
                <p>Ready to keep the conversation moving?</p>
                <p class="outgoing">Always. No refresh required.</p>
              </div>
              <a class="button primary" href="/auth/sign-in">
                Open your inbox →
              </a>
            </aside>
          </section>
          <section
            class="features"
            id="how-it-works"
            aria-label="Built for conversation"
          >
            {features.map(([title, description]) => (
              <article key={title}>
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </section>
          <section class="security" id="security">
            <h2>Keep every conversation moving.</h2>
            <div>
              <p class="lead">
                Find people, continue discussions from one inbox, and stay in
                touch without letting the app get in your way.
              </p>
              <div class="badges">
                {["Realtime", "Focused", "Private", "Cross-device"].map(
                  (label) => (
                    <span class="badge" key={label}>
                      {label}
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>
        </main>
        <footer class="shell footer">
          <span>Gorth Chat</span>
          <a href="/privacy">Privacy policy</a>
        </footer>
      </body>
    </html>
  );
}

export function HomeError() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chat temporarily unavailable</title>
        <link rel="stylesheet" href="/chat-landing.css" />
      </head>
      <body>
        <main class="shell error">
          <h1>Temporarily unavailable</h1>
          <p>Please try again in a moment.</p>
          <a class="button" href="/">
            Try again
          </a>
        </main>
      </body>
    </html>
  );
}
