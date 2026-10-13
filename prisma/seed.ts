// Kører ved hver udrulning. Filnavnet er arvet fra dengang, den lagde
// demo-data ind; nu sikrer den de få konti og produktionsrettelser, der skal
// eksistere efter enhver deploy.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { provisionPrivateClub } from "../src/lib/deploy-club-provision";

const db = new PrismaClient();
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
const APPLE_REVIEW_EMAIL = (process.env.APPLE_REVIEW_EMAIL ?? "").trim().toLowerCase();
const APPLE_REVIEW_PASSWORD = process.env.APPLE_REVIEW_PASSWORD ?? "";
const SHARDING_ACTIVE=String(process.env.REGIONAL_SHARDING_ACTIVE??'false').toLowerCase()==='true';
const REGION=String(process.env.RACKETBUDDY_REGION??'GLOBAL').toUpperCase();

async function wipe() {
  await db.payment.deleteMany({});
  await db.booking.deleteMany({});
  await db.message.deleteMany({});
  await db.matchRequest.deleteMany({});
  await db.swipe.deleteMany({});
  await db.review.deleteMany({});
  await db.coachPackage.deleteMany({});
  await db.coachProfile.deleteMany({});
  await db.loginChallenge.deleteMany({});
  await db.guestSlot.deleteMany({});
  await db.externalBusy.deleteMany({});
  await db.guestRule.deleteMany({});
  await db.court.deleteMany({});
  await db.clubPost.deleteMany({});
  await db.image.deleteMany({});
  await db.clubLead.deleteMany({});
  await db.websiteOrder.deleteMany({});
  await db.user.deleteMany({ where: OWNER_EMAIL ? { email: { not: OWNER_EMAIL } } : {} });
  await db.club.deleteMany({});
}

async function ensureOwner() {
  if (!OWNER_EMAIL.includes("@")) { console.log("OWNER_EMAIL er ikke sat — springer ejerkontoen over."); return; }
  const existing = await db.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!existing) {
    await db.user.create({ data: { email: OWNER_EMAIL,name:"RacketBuddy",role:"SUPERADMIN",passwordHash:await bcrypt.hash(crypto.randomBytes(32).toString("hex"),10),level:3,countryChosen:true } });
    console.log(`Ejerkonto oprettet: ${OWNER_EMAIL}. Brug "Glemt adgangskode".`); return;
  }
  if (existing.role !== "SUPERADMIN") { await db.user.update({ where:{id:existing.id},data:{role:"SUPERADMIN"} }); console.log(`Ejerkonto fik superadmin: ${OWNER_EMAIL}`); }
}

async function ensureAppleReview() {
  // Once true sharding is active, the US review account belongs only on the
  // Virginia shard. Frankfurt must not recreate or mutate it on every deploy.
  if(SHARDING_ACTIVE&&REGION==='EU'){console.log('Apple Review-login belongs to the US shard — skipped in EU.');return;}
  if (!APPLE_REVIEW_EMAIL.includes("@") || APPLE_REVIEW_PASSWORD.length < 8) { console.log("Apple Review-login er ikke konfigureret — springer review-kontoen over."); return; }
  const existing = await db.user.findUnique({ where: { email: APPLE_REVIEW_EMAIL } });
  const passwordMatches = existing ? await bcrypt.compare(APPLE_REVIEW_PASSWORD, existing.passwordHash) : false;
  const common = {name:"Apple App Review",role:"PLAYER",level:4,area:"Boston",country:"US",countryChosen:true,locale:"en",sports:"TENNIS,PADEL,PICKLEBALL",termsAcceptedAt:existing?.termsAcceptedAt??new Date()};
  if (!existing) { await db.user.create({data:{email:APPLE_REVIEW_EMAIL,passwordHash:await bcrypt.hash(APPLE_REVIEW_PASSWORD,10),...common}}); console.log(`Apple App Review-konto oprettet: ${APPLE_REVIEW_EMAIL}`); return; }
  await db.user.update({where:{id:existing.id},data:{...common,...(passwordMatches?{}:{passwordHash:await bcrypt.hash(APPLE_REVIEW_PASSWORD,10)})}});
  console.log(`Apple App Review-konto er klar: ${APPLE_REVIEW_EMAIL}`);
}

async function ensureMadsCoachSport() {
  const candidates = await db.user.findMany({where:{AND:[{name:{contains:"Mads",mode:"insensitive"}},{name:{contains:"Stjerne",mode:"insensitive"}},{name:{contains:"Pedersen",mode:"insensitive"}}]},include:{coachProfile:true}});
  const mads = candidates.find(candidate=>candidate.coachProfile);
  if (!mads?.coachProfile) { console.log(`Mads Stjerne Pedersen: ingen trænerprofil fundet (${candidates.length} navnematch).`); return; }
  await db.coachProfile.update({where:{id:mads.coachProfile.id},data:{sports:"BORDTENNIS"}});
  console.log(`Mads Stjerne Pedersen: trænerprofil ${mads.coachProfile.id} er sat til BORDTENNIS (var ${mads.coachProfile.sports}).`);
}

async function logCoachSummary() {
  const coaches=await db.coachProfile.findMany({include:{user:{select:{name:true}}},orderBy:{user:{name:"asc"}}});
  console.log(`Trænerprofiler i produktion (${coaches.length}): ${coaches.map(coach=>`${coach.user.name}=${coach.sports}`).join(" | ")}`);
}

async function logRegionalSummary(){
  const [usUsers,usClubs,usCoaches]=await Promise.all([
    db.user.count({where:{country:'US'}}),
    db.club.count({where:{country:'US'}}),
    db.coachProfile.count({where:{country:'US'}}),
  ]);
  console.log(`Regional data summary: region=${REGION}, sharding=${SHARDING_ACTIVE?'active':'staged'}, US users=${usUsers}, US clubs=${usClubs}, US coaches=${usCoaches}.`);
}

async function main() {
  if (process.env.RESET_TO_PRODUCTION === "1") { console.log("RESET_TO_PRODUCTION er sat — tømmer databasen for demo-data."); await wipe(); console.log("Databasen er tom. Fjern RESET_TO_PRODUCTION igen."); }
  await ensureOwner();
  await ensureAppleReview();
  try { console.log("Private club provisioning:", await provisionPrivateClub(db, process.env.PRIVATE_CLUB_PROVISION)); }
  catch { console.error("Private club provisioning failed; existing accounts were not changed."); }
  await ensureMadsCoachSport();
  await logCoachSummary();
  await logRegionalSummary();
}

main().catch(err=>{console.error("Opstartsscriptet fejlede:",err);}).finally(()=>db.$disconnect());
