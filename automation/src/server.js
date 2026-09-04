// Automatisering af klubbens eget bookingsystem.
//
// Egen service, ikke en del af hovedappen. To grunde:
//
// 1. Playwright kræver et browserbillede på ~1 GB og et snes
//    systembiblioteker. Lægger man det i hovedappens byggetrin, bliver hver
//    udrulning af hjemmesiden afhængig af, at et browserbillede kan hentes.
//    Fejler det, er hele siden nede — for en funktion, der kun bruges af
//    nogle klubber.
//
// 2. En browser, der hænger, tager hukommelsen med sig. Her kan den kun
//    tage denne service ned.
//
// Kommunikationen er en delt hemmelighed i en header. Servicen skal ikke
// være offentligt tilgængelig: den logger ind i klubbers bookingsystemer.

import http from "node:http";
import { chromium } from "playwright";
import { HALBOOKING } from "./selectors.js";

const PORT = Number(process.env.PORT ?? 10000);
const SECRET = process.env.AUTOMATION_SECRET ?? "";

/** Hver forespørgsel får sin egen browser. Delt tilstand mellem klubber er ikke værd at spare på. */
async function withBrowser(fn) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      locale: "da-DK",
      timezoneId: "Europe/Copenhagen",
      viewport: { width: 1400, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    return await fn(page);
  } finally {
    await browser.close().catch(() => {});
  }
}

function normaliseBase(baseUrl) {
  const withScheme = /^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
  return withScheme.replace(/\/$/, "");
}

/**
 * Logger ind. Kaster, hvis beviset på at være logget ind ikke findes.
 *
 * Uden det tjek går resten af koden videre og klikker rundt på en
 * login-side, og fejlen dukker først op som "banen blev ikke reserveret"
 * længe efter.
 */
async function login(page, { baseUrl, username, password }) {
  const base = normaliseBase(baseUrl);
  await page.goto(base + HALBOOKING.loginPath, { waitUntil: "domcontentloaded" });

  await page.fill(HALBOOKING.usernameField, username);
  await page.fill(HALBOOKING.passwordField, password);
  await page.click(HALBOOKING.submitButton);
  await page.waitForLoadState("domcontentloaded");

  const marker = await page.$(HALBOOKING.loggedInMarker);
  if (!marker) {
    throw new Error(
      "Login mislykkedes: kunne ikke finde beviset på at være logget ind. " +
        "Tjek brugernavn og adgangskode, eller kør /inspect og ret selectors.js."
    );
  }
  return base;
}

/**
 * Fortæller hvad automatiseringen ser.
 *
 * Det er dette endepunkt, selektorerne findes med: den lister alle
 * inputfelter, knapper og links på siden, med de attributter man vælger dem
 * ud fra. Uden det skulle man gætte, og et gæt på en selektor er kode, der
 * ser rigtig ud og ikke virker.
 */
async function inspect({ baseUrl, username, password, path }) {
  return withBrowser(async (page) => {
    const base = normaliseBase(baseUrl);
    const out = { steps: [] };

    await page.goto(base + HALBOOKING.loginPath, { waitUntil: "domcontentloaded" });
    out.steps.push({ step: "åbnede loginsiden", url: page.url(), title: await page.title() });
    out.loginPageFields = await describeFields(page);

    // Forsøg login, men lad det ikke vælte gennemgangen: fejler det, er
    // felterne ovenfor netop det, man skal se på.
    try {
      await page.fill(HALBOOKING.usernameField, username);
      await page.fill(HALBOOKING.passwordField, password);
      await page.click(HALBOOKING.submitButton);
      await page.waitForLoadState("domcontentloaded");
      out.steps.push({ step: "sendte login", url: page.url(), title: await page.title() });
      out.loggedIn = Boolean(await page.$(HALBOOKING.loggedInMarker));
    } catch (err) {
      out.steps.push({ step: "login fejlede", error: String(err.message ?? err) });
      out.loggedIn = false;
    }

    out.afterLoginFields = await describeFields(page);

    if (out.loggedIn) {
      const target = path || HALBOOKING.bookingPath;
      try {
        await page.goto(base + target, { waitUntil: "domcontentloaded" });
        out.steps.push({ step: `åbnede ${target}`, url: page.url(), title: await page.title() });
        out.bookingPageFields = await describeFields(page);
        out.bookingPageTables = await describeTables(page);
      } catch (err) {
        out.steps.push({ step: `kunne ikke åbne ${target}`, error: String(err.message ?? err) });
      }
    }

    out.screenshot = (await page.screenshot({ fullPage: false })).toString("base64");
    return out;
  });
}

/** Alle felter, knapper og links med det, man kan vælge dem ud fra. */
async function describeFields(page) {
  return page.evaluate(() => {
    const pick = (el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") ?? undefined,
      name: el.getAttribute("name") ?? undefined,
      id: el.id || undefined,
      className: el.className || undefined,
      placeholder: el.getAttribute("placeholder") ?? undefined,
      text: (el.textContent ?? "").trim().slice(0, 60) || undefined,
      href: el.getAttribute("href") ?? undefined,
    });
    const nodes = Array.from(
      document.querySelectorAll("input, select, textarea, button, a[href]")
    ).slice(0, 120);
    return nodes.map(pick);
  });
}

/**
 * Skemaet, bookingen skal klikkes i.
 *
 * Halbooking viser typisk banerne som en tabel. Cellernes attributter er
 * dét, freeSlotCell skal pege på, så de listes her.
 */
async function describeTables(page) {
  return page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table")).slice(0, 3);
    return tables.map((table) => ({
      headers: Array.from(table.querySelectorAll("th"))
        .slice(0, 20)
        .map((th) => (th.textContent ?? "").trim()),
      sampleCells: Array.from(table.querySelectorAll("td"))
        .slice(0, 20)
        .map((td) => ({
          text: (td.textContent ?? "").trim().slice(0, 30),
          className: td.className || undefined,
          attributes: Object.fromEntries(
            Array.from(td.attributes)
              .filter((a) => a.name.startsWith("data-") || a.name === "id")
              .map((a) => [a.name, a.value])
          ),
        })),
    }));
  });
}

function fill(template, vars) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template
  );
}

/**
 * Reserverer en tid i klubbens system og læser bagefter, om den står der.
 *
 * Verifikationen er ikke pynt. Den er hele grunden til, at dette kan
 * bruges: hovedappen trækker først penge, når dette endepunkt har svaret
 * `verified: true`. En automatisering, der fejler tavst, ville ellers
 * efterlade en betalt booking uden bane — og to hold på samme bane.
 */
async function book({ baseUrl, username, password, court, date, time }) {
  return withBrowser(async (page) => {
    const base = await login(page, { baseUrl, username, password });

    await page.goto(base + HALBOOKING.bookingPath, { waitUntil: "domcontentloaded" });

    const dateFieldExists = await page.$(HALBOOKING.dateField);
    if (dateFieldExists) {
      await page.fill(HALBOOKING.dateField, date);
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    const cellSelector = fill(HALBOOKING.freeSlotCell, { court, time });
    const cell = await page.$(cellSelector);
    if (!cell) {
      throw new Error(
        `Fandt ikke tiden ${time} på bane ${court} den ${date}. ` +
          "Enten er den allerede taget, eller freeSlotCell peger forkert."
      );
    }
    await cell.click();

    const confirm = await page.$(HALBOOKING.confirmButton);
    if (confirm) {
      await confirm.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }

    // Verifikation: læs siden igen og se, om tiden nu er optaget.
    await page.goto(base + HALBOOKING.bookingPath, { waitUntil: "domcontentloaded" });
    if (dateFieldExists) {
      await page.fill(HALBOOKING.dateField, date).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    const bookedSelector = fill(HALBOOKING.bookedMarker, { court, time });
    const verified = Boolean(await page.$(bookedSelector));

    return {
      verified,
      // Et skærmbillede med hver booking er billigt og uvurderligt, den dag
      // en klub siger "den tid blev aldrig reserveret".
      screenshot: (await page.screenshot({ fullPage: false })).toString("base64"),
    };
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") return json(res, 200, { ok: true });

  if (!SECRET) return json(res, 500, { error: "AUTOMATION_SECRET er ikke sat." });
  if (req.headers["x-automation-secret"] !== SECRET) {
    // Servicen logger ind i klubbers bookingsystemer. Den skal ikke svare
    // nogen, der ikke kender hemmeligheden.
    return json(res, 401, { error: "Ikke godkendt." });
  }
  if (req.method !== "POST") return json(res, 405, { error: "Kun POST." });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Ugyldig JSON." });
  }

  const required = ["baseUrl", "username", "password"];
  const missing = required.filter((k) => !body[k]);
  if (missing.length > 0) {
    return json(res, 400, { error: `Mangler: ${missing.join(", ")}` });
  }

  try {
    if (req.url === "/inspect") return json(res, 200, await inspect(body));
    if (req.url === "/book") {
      for (const k of ["court", "date", "time"]) {
        if (!body[k]) return json(res, 400, { error: `Mangler: ${k}` });
      }
      return json(res, 200, await book(body));
    }
    return json(res, 404, { error: "Ukendt endepunkt." });
  } catch (err) {
    // Fejlen sendes videre i klartekst. Hovedappen viser den til superadmin,
    // og det er sådan selektorerne rettes.
    return json(res, 200, { verified: false, error: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(`Automatisering lytter på ${PORT}`);
});
