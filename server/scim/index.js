/* ============================================================================
   SCIM: wat de IdP van een klant met accounts mag doen.

   Dit is provisioning-beheer met een sleutel die in een ander bedrijf wordt
   bewaard. Twee dingen bepalen daarom alles hieronder:

   1. EEN SLEUTEL ZIET ALLEEN ZIJN EIGEN ORGANISATIE. Elke bewerking gaat door
      binnenOrg(): het account moet via sso_identiteiten aan DEZE organisatie
      hangen, of het adres moet in een domein van deze koppeling vallen. Zonder
      die grens kan de sleutel van de kleinste klant het account van de grootste
      uitzetten -- en een SCIM-sleutel ligt bij de klant, niet bij ons.

   2. UITZETTEN, NIET WISSEN. Een DELETE van de IdP zet het account op non-actief
      en laat de gegevens staan. Dat is bewust en het is geen halve maatregel:
      - de persoon is er in hetzelfde moment uit (zie verifyToken);
      - facturen en boekingen blijven bestaan, en dat MOET (Art. 52 AWR, zeven
        jaar);
      - een verkeerd gesynchroniseerde IdP kan anders in een middag de halve
        ledenadministratie wissen, en dat is niet terug te draaien.
      Echt wissen blijft de AVG-route (accounts.deleteUser), met een mens erbij.

   En de merkregel die overal geldt: SCIM geeft NOOIT een betaalde pas. Een via
   SCIM aangemaakt account krijgt hooguit RTG, net als zelf-registreren en net
   als SSO. Er staat hier geen setTier.
   ========================================================================== */
'use strict';
const S = require('../accounts/state');
const sso = require('../sso');
const koppelingen = require('../sso/koppelingen');
const sleutels = require('./sleutels');

function zorgTabel(db) {
  sleutels.zorgTabel(db);
}

/* Hoort dit account bij deze organisatie? Twee wegen, allebei geldig:
   - het is al eens via SSO van deze organisatie binnengekomen, of
   - het e-mailadres valt in een domein van deze koppeling (dan mag de IdP het
     overnemen -- dat is precies wat de domeinlijst bevestigt). */
function binnenOrg(accounts, org, user) {
  if (!user) return false;
  const viaSso = S.db.prepare('SELECT 1 AS x FROM sso_identiteiten WHERE org = ? AND user_id = ?').get(org, user.id);
  if (viaSso) return true;
  const k = koppelingen.vind(org);
  if (!k) return false;
  const domein = koppelingen.domeinVan(accounts.emailOf(user));
  return !!domein && k.domeinen.includes(domein);
}

/* Alle accounts van een organisatie. Voor het overzicht en de synchronisatie.

   We lopen over sso_identiteiten en niet over alle users: dat is meteen de
   juiste afbakening en het schaalt met het aantal medewerkers van de klant in
   plaats van met het ledenbestand. */
function accountsVan(accounts, org) {
  const rijen = sso.identiteitenVan(org);
  const gezien = new Set();
  const uit = [];
  for (const r of rijen) {
    if (gezien.has(r.user_id)) continue;
    gezien.add(r.user_id);
    const u = accounts.getUserById(r.user_id);
    if (u) uit.push(u);
  }
  return uit;
}

function zoekOpEmail(accounts, org, email) {
  const u = accounts.findByLogin(String(email || '').trim().toLowerCase());
  return u && binnenOrg(accounts, org, u) ? u : null;
}

/* Aanmaken. De IdP stuurt userName (het e-mailadres) en meestal een naam.

   Bestaat het adres al binnen deze organisatie, dan is dat GEEN fout maar de
   normale gang van zaken bij een eerste synchronisatie: we geven het bestaande
   account terug met de vlag `bestond`. De routelaag maakt daar een 409 van als
   SCIM dat eist, maar de aanroeper heeft de gegevens dan al. */
async function maak(accounts, org, gegevens) {
  const k = koppelingen.vind(org);
  if (!k) throw Object.assign(new Error('Onbekende organisatie.'), { status: 404 });

  const email = String(gegevens.userName || (gegevens.emails && gegevens.emails[0] && gegevens.emails[0].value) || '')
    .trim().toLowerCase();
  if (!email) throw Object.assign(new Error('userName is verplicht en moet het e-mailadres zijn.'), { status: 400, scimType: 'invalidValue' });

  const domein = koppelingen.domeinVan(email);
  if (!domein || !k.domeinen.includes(domein))
    throw Object.assign(new Error('Het adres ' + email + ' valt buiten de domeinen van deze organisatie.'), { status: 400, scimType: 'invalidValue' });

  const bestaand = accounts.findByLogin(email);
  if (bestaand) {
    // binnen de eigen domeinen mag de organisatie dit account beheren
    if (!binnenOrg(accounts, org, bestaand))
      throw Object.assign(new Error('Dit account bestaat al en hoort niet bij deze organisatie.'), { status: 409, scimType: 'uniqueness' });
    if (gegevens.active === false) accounts.zetActief(bestaand.id, false);
    return { user: accounts.getUserById(bestaand.id), bestond: true };
  }

  const naam = String((gegevens.name && (gegevens.name.formatted ||
    [gegevens.name.givenName, gegevens.name.familyName].filter(Boolean).join(' '))) ||
    gegevens.displayName || '').trim() || email.split('@')[0];

  const user = await accounts.createUser({
    email, username: null, password: sso.onbruikbaarWachtwoord(),
    tier: 'rtg', realName: naam, phone: null   // nooit een betaalde pas -- zie de kop
  });
  if (typeof accounts.setEmailVerified === 'function') accounts.setEmailVerified(user.id);
  /* Vastleggen dat dit account van deze organisatie is. Het subject is hier de
     e-mail-hash: de IdP heeft nog geen SSO-sub afgegeven (die komt pas bij de
     eerste inlog), en bij die inlog wordt het account op adres teruggevonden. */
  sso.legVast(org, 'scim:' + email, user.id);
  if (gegevens.active === false) accounts.zetActief(user.id, false);
  return { user: accounts.getUserById(user.id), bestond: false };
}

/* De enige eigenschap die via SCIM te wijzigen is: aan of uit.

   Bewust smal. Een naam of adres wijzigen via SCIM zou betekenen dat de IdP van
   een klant de identiteitskluis kan overschrijven, en dat is precies het soort
   sleutel waarmee je een account stilletjes naar een ander adres verhuist. */
function zetActief(accounts, org, id, aan) {
  const u = accounts.getUserById(Number(id));
  if (!u || !binnenOrg(accounts, org, u))
    throw Object.assign(new Error('Onbekende gebruiker binnen deze organisatie.'), { status: 404 });
  return accounts.zetActief(u.id, !!aan);
}

function lees(accounts, org, id) {
  const u = accounts.getUserById(Number(id));
  if (!u || !binnenOrg(accounts, org, u))
    throw Object.assign(new Error('Onbekende gebruiker binnen deze organisatie.'), { status: 404 });
  return u;
}

/* Een PATCH van SCIM uitpakken tot "aan" of "uit".

   IdP's sturen dit in drie vormen, en ze doen het alle drie:
     { op:'replace', path:'active', value:false }
     { op:'replace', value:{ active:false } }
     { op:'Replace', path:'active', value:'False' }   (hoofdletters, string!)
   Wat we niet herkennen, negeren we -- maar we geven het aantal herkende
   bewerkingen terug, zodat de routelaag kan zien of er iets is gebeurd. */
function uitPatch(body) {
  const ops = body && Array.isArray(body.Operations) ? body.Operations : [];
  let actief;
  let herkend = 0;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const soort = String(op.op || '').toLowerCase();
    if (soort !== 'replace' && soort !== 'add') continue;
    const pad = String(op.path || '').toLowerCase();
    let waarde;
    if (pad === 'active') waarde = op.value;
    else if (!op.path && op.value && typeof op.value === 'object' && 'active' in op.value) waarde = op.value.active;
    else continue;
    if (typeof waarde === 'string') waarde = waarde.toLowerCase() === 'true';
    actief = !!waarde;
    herkend++;
  }
  return { actief, herkend };
}

module.exports = { zorgTabel, binnenOrg, accountsVan, zoekOpEmail, maak, zetActief, lees, uitPatch, sleutels };
