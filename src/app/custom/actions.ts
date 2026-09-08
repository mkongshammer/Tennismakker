"use server";

import { db } from "../../lib/db";
import { getSettings } from "../../lib/settings";
import { sendMail } from "../../lib/email";

export type CustomLeadState = { ok?: string; error?: string } | null;

export async function requestCustomMeeting(
  _prev: CustomLeadState,
  formData: FormData
): Promise<CustomLeadState> {
  const clubName = String(formData.get("clubName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const preferredTime = String(formData.get("preferredTime") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const services = formData.getAll("services").map(String).filter(Boolean);

  if (clubName.length < 2 || contactName.length < 2 || !email.includes("@")) {
    return { error: "Udfyld klub/virksomhed, navn og en gyldig e-mail." };
  }
  if (services.length === 0) {
    return { error: "Vælg mindst én ting, I gerne vil tale om." };
  }

  const notes = [
    "CUSTOM LØSNING / MØDE",
    `Interesseret i: ${services.join(", ")}`,
    preferredTime ? `Ønsket mødetid: ${preferredTime}` : "Ønsket mødetid: fleksibel",
    message ? `Besked: ${message}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.websiteOrder.create({
    data: {
      clubName,
      contactName,
      email,
      phone: phone || null,
      notes,
      status: "NEW",
      priceKr: 0,
    },
  });

  const settings = await getSettings();
  if (settings.ordersEmail) {
    await sendMail({
      to: settings.ordersEmail,
      subject: `Nyt møde: ${clubName} — custom løsning`,
      body: [
        `Kontakt: ${contactName}`,
        `Klub/virksomhed: ${clubName}`,
        `E-mail: ${email}`,
        phone ? `Telefon: ${phone}` : "",
        `Interesseret i: ${services.join(", ")}`,
        preferredTime ? `Ønsket mødetid: ${preferredTime}` : "Ønsket mødetid: fleksibel",
        message ? "" : "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return {
    ok: "Tak — vi har modtaget din forespørgsel og kontakter dig for at bekræfte mødet.",
  };
}
