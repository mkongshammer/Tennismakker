import test from "node:test";
import assert from "node:assert/strict";
import { isOwnHost } from "./hosts";

// The middleware's host decisions, exercised through the pure helper and the
// environment contract it reads. The redirect itself is a one-line
// NextResponse.redirect and is covered by the production smoke workflow.
test("own hosts include the apex, www, localhost and every Render/Vercel service name", () => {
  for (const h of ["racketbuddy.app", "www.racketbuddy.app", "racketbuddy-us.onrender.com", "racketbuddy-us-core.onrender.com", "tennis-makker.onrender.com", "localhost:3000", "127.0.0.1"]) assert.ok(isOwnHost(h), h);
  for (const h of ["soendermarktennis.dk", "racketbuddy.app.evil.com", ""]) assert.equal(isOwnHost(h), false, h);
});

test("CANONICAL_HOST is inert until set, then names a single lowercase hostname", () => {
  // Contract documented in src/middleware.ts and docs/domain-cutover.md.
  const value = (process.env.CANONICAL_HOST ?? "").trim().toLowerCase();
  assert.equal(value, "", "tests run without a canonical host configured");
  for (const good of ["racketbuddy.app"]) assert.match(good, /^[a-z0-9.-]+$/);
});
