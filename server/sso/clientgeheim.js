/* Het OIDC-clientgeheim van een klant, VERSLEUTELD PER TENANT (besluit B16).

   Het geheim is een wachtwoord van ons bij de provider van de klant en moet
   omkeerbaar bewaard blijven: bij elke tokenruil gaat het mee. Hash-only kan
   hier dus per definitie niet. Wat wel kan, en wat hier staat:

   1. EEN SLEUTEL PER TENANT, geen tweede cryptolaag. De sleutel is een
      HKDF-afleiding (kluis.afleidSleutel) van de kluisring met de org in het
      label. Wie een blob naar een andere org verplaatst, krijgt niets open: de
      sleutel en de AAD horen bij de org. Een rotatie van de kluisring werkt
      vanzelf mee, want openen probeert de hele ring.
   2. NOOIT TERUG TE LEZEN VIA EEN ROUTE. stand() geeft een vingerafdruk (HMAC
      met een eigen afgeleide sleutel, dus niet te raden uit een kort geheim),
      wanneer gezet, wanneer het vervalt en de overlap. Alleen geldige() levert
      de tekst, en die heeft precies een lezer: de tokenruil.
   3. ROTATIE MET OVERLAP. Een nieuw geheim wordt het eerste slot; het vorige
      blijft een begrensde tijd (standaard 3, hoogstens 30 dagen) geldig, zodat
      een klant zonder uitval kan wisselen. De ruil probeert het oude alleen
      als de provider het nieuwe weigert met invalid_client.
   4. EEN VERVALDATUM op elk slot (B22: standaard 30 dagen -- het
      rotatieadvies -- en hoogstens 90). De tijden zitten in de AAD: wie in de
      database een datum oprekt, maakt het slot onleesbaar in plaats van langer
      geldig. Een slot van voor B22 met een langere vervaldatum wordt bij het
      LEZEN afgekapt op 90 dagen na `gezet` (vervaltOp); de opgeslagen datum
      blijft staan, want hij zit in de AAD, en er wordt niets verlengd.
   5. FAIL-CLOSED. Zonder bruikbare sleutel (in productie: zonder RTG_VAULT_KEY)
      weigert zetten met de reden; een slot dat niet opengaat of verlopen is
      maakt de inlog dicht met de reden, en er gaat nooit een lege of halve
      tokenruil naar de provider.

   Een geheim uit de oude opslag (kluis.enc zonder merk) wordt bij het laden
   herzegeld door migreer(); het krijgt een vervaldatum over 90 dagen, zodat
   de eigenaar het binnen die tijd roteert. */
'use strict';
const crypto = require('crypto');
const S = require('../accounts/state');
const kluis = require('../accounts/kluis');
const gebonden = require('../accounts/gebonden');

const MERK = 'RTGSSO2:';
const DAG = 86400000;
const GRENS = Object.freeze({ standaardDagen: 30, maxDagen: 90, standaardOverlap: 3, maxOverlap: 30,
  gemigreerdDagen: 90, maxLengte: 2048 });

const REDEN = Object.freeze({
  GEEN_GEHEIM: 'er is voor deze koppeling geen clientgeheim gezet',
  VERLOPEN: 'het clientgeheim van deze koppeling is verlopen',
  ONLEESBAAR: 'het clientgeheim van deze koppeling gaat met geen enkele kluissleutel open',
  SLEUTEL_ONTBREEKT: 'de sleutel om het clientgeheim te versleutelen ontbreekt'
});

function fout(code, bericht, status) {
  const e = new Error(bericht); e.code = code; e.status = status || 400; return e;
}

/* Is er een sleutel om mee te versleutelen? In productie MOET hij uit de
   omgeving komen: een vault.key naast de database is geen scheiding. */
function sleutelProbleem(env) {
  const e = env || process.env;
  if (!Buffer.isBuffer(S.VAULT) || !gebonden.ring().every(Buffer.isBuffer))
    return REDEN.SLEUTEL_ONTBREEKT + ': de kluis is niet geladen';
  if (String(e.NODE_ENV || '') === 'production' && !String(e.RTG_VAULT_KEY || ''))
    return REDEN.SLEUTEL_ONTBREEKT + ': RTG_VAULT_KEY staat niet in de omgeving van deze productieserver';
  return null;
}

const tenantSleutel = (basis, org) => kluis.afleidSleutel(basis, 'sso-clientgeheim-v1:' + org);
const aad = (org, s) => Buffer.from(['rtg-sso-geheim-v2', org, s.gezet || '', s.vervalt, s.tot || '',
  s.gemigreerd ? '1' : ''].join('|'), 'utf8');

function vingerafdruk(org, tekst) {
  const k = kluis.afleidSleutel(S.VAULT, 'sso-vingerafdruk-v1:' + org);
  return 'hmac:' + crypto.createHmac('sha256', k).update(String(tekst)).digest('hex').slice(0, 16);
}

function zegelSlot(org, tekst, meta) {
  const s = { gezet: meta.gezet || null, vervalt: meta.vervalt, tot: meta.tot || null,
    gemigreerd: !!meta.gemigreerd, vf: vingerafdruk(org, tekst) };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', tenantSleutel(gebonden.ring()[0], org), iv);
  c.setAAD(aad(org, s));
  const ct = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
  s.c = Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
  return s;
}

function openSlot(org, s) {
  if (!s || typeof s.c !== 'string') return null;
  const buf = Buffer.from(s.c, 'base64');
  for (const basis of gebonden.ring()) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', tenantSleutel(basis, org), buf.subarray(0, 12));
      d.setAAD(aad(org, s));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { /* volgende sleutel in de ring */ }
  }
  return null;
}

function lees(waarde) {
  if (waarde == null || waarde === '') return { soort: 'leeg', sloten: [] };
  const t = String(waarde);
  if (!t.startsWith(MERK)) return { soort: 'oud', sloten: [] };
  try {
    const j = JSON.parse(t.slice(MERK.length));
    return { soort: 'v2', sloten: Array.isArray(j.sloten) ? j.sloten : [] };
  } catch (e) { return { soort: 'kapot', sloten: [] }; }
}
const schrijf = (sloten) => MERK + JSON.stringify({ sloten });
/* Het echte verval van een slot: zijn eigen datum, maar nooit later dan maxDagen
   na uitgifte (B22). Zonder `gezet` (gemigreerd) geldt de eigen datum. */
function vervaltOp(s) {
  const v = Date.parse(s.vervalt), g = s.gezet ? Date.parse(s.gezet) : NaN;
  return Number.isFinite(g) ? Math.min(v, g + GRENS.maxDagen * DAG) : v;
}
const inTijd = (s, nu) => vervaltOp(s) > nu && (!s.tot || Date.parse(s.tot) > nu);

/* De oude opslag herzegelen. null = er valt niets te migreren (al nieuw, leeg,
   of onleesbaar -- dat laatste blijft staan en maakt de inlog dicht). */
function migreer(org, waarde, nu) {
  if (lees(waarde).soort !== 'oud' || sleutelProbleem()) return null;
  const tekst = kluis.dec(String(waarde));
  if (tekst == null) return null;
  const t = nu == null ? Date.now() : nu;
  return schrijf([zegelSlot(org, tekst, { vervalt: new Date(t + GRENS.gemigreerdDagen * DAG).toISOString(),
    gemigreerd: true })]);
}

/* De geheimen voor de tokenruil, nieuwste eerst, of een reden waarom niet. */
function geldige(org, waarde, nu) {
  const t = nu == null ? Date.now() : nu;
  const l = lees(waarde);
  if (l.soort === 'leeg') return { geheimen: [], code: 'GEEN_GEHEIM', reden: REDEN.GEEN_GEHEIM };
  const probleem = sleutelProbleem();
  if (probleem) return { geheimen: [], code: 'SLEUTEL_ONTBREEKT', reden: probleem };
  if (l.soort !== 'v2') return { geheimen: [], code: 'ONLEESBAAR', reden: REDEN.ONLEESBAAR };
  const levend = l.sloten.filter(s => inTijd(s, t));
  if (!levend.length) {
    return l.sloten.length ? { geheimen: [], code: 'VERLOPEN', reden: REDEN.VERLOPEN }
      : { geheimen: [], code: 'GEEN_GEHEIM', reden: REDEN.GEEN_GEHEIM };
  }
  const geheimen = [];
  for (const s of levend) {
    const tekst = openSlot(org, s);
    // een slot dat hoort te gelden maar niet opengaat: dicht, niet stil het volgende nemen
    if (tekst == null || vingerafdruk(org, tekst) !== s.vf)
      return { geheimen: [], code: 'ONLEESBAAR', reden: REDEN.ONLEESBAAR };
    geheimen.push(tekst);
  }
  return { geheimen, code: null, reden: null };
}

/* Wat een scherm mag weten. Nooit de tekst, nooit het blob. */
function stand(org, waarde, nu) {
  const t = nu == null ? Date.now() : nu;
  const l = lees(waarde);
  const g = geldige(org, waarde, t);
  const kop = l.sloten[0] || null;
  const oud = l.sloten.filter(s => inTijd(s, t))[1] || null;
  return {
    gezet: l.soort !== 'leeg', bruikbaar: g.geheimen.length > 0, code: g.code, reden: g.reden,
    vingerafdruk: kop ? kop.vf : null, gezetOp: kop ? kop.gezet : null,
    vervalt: kop ? new Date(vervaltOp(kop)).toISOString() : null,
    afgekapt: !!(kop && vervaltOp(kop) < Date.parse(kop.vervalt)),
    dagenOver: kop ? Math.floor((vervaltOp(kop) - t) / DAG) : null,
    gemigreerd: !!(kop && kop.gemigreerd),
    overlap: oud ? { vingerafdruk: oud.vf, tot: oud.tot } : null
  };
}

/* Probeer de ruil met het nieuwste geheim; alleen bij invalid_client het
   volgende. Elke andere fout is geen reden om een ander geheim te proberen. */
async function probeer(geheimen, ruil) {
  for (let i = 0; i < geheimen.length; i++) {
    try { return await ruil(geheimen[i]); }
    catch (e) {
      if (i < geheimen.length - 1 && /\(invalid_client\b/.test(String(e && e.message))) continue;
      throw e;
    }
  }
  throw fout('GEEN_GEHEIM', REDEN.GEEN_GEHEIM, 503);
}

module.exports = { MERK, GRENS, REDEN, DAG, fout, sleutelProbleem, vingerafdruk, zegelSlot, migreer, geldige,
  stand, probeer, lees, schrijf, inTijd, vervaltOp, tenantSleutel, aad };
// zetten, roteren en de overlap sluiten: ./clientgeheim-rotatie.js
