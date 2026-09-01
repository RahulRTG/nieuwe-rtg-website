/* ============================================================================
   TWEEDE FACTOR VOOR LEDEN -- TOTP, met een set herstelcodes ernaast.

   WAT ER AL WAS EN WAT NIET. kern/totp.js rekent al goed: drie stappen
   vergelijken zonder vroege uitstap, en een code die eenmaal is gebruikt telt
   niet nog eens. Alleen hing hij aan EEN geheim uit een omgevingsvariabele
   (OFFICE_TOTP_SECRET) en was hij dus alleen voor de backoffice. Deze laag geeft
   elk lid zijn eigen geheim; de rekenkern blijft ongewijzigd.

   WAAR HET GEHEIM LIGT. In het LEDENDOSSIER (accounts/dossier.js), dat
   versleuteld de kolom in gaat. Niet in db.data: een TOTP-geheim is een
   inloggeheim, en dat hoort niet in de operationele opslag te liggen waar de
   codenaam-opzet juist alles vandaan houdt.

   DE HERSTELCODES LIGGEN GEHASHT, en alleen gehasht. Ze worden EEN keer
   getoond, bij het aanzetten, en daarna nooit meer -- want als wij ze konden
   tonen, konden wij ze ook lezen. Elke code werkt eenmaal; opgebruikte codes
   blijven als lege plek staan zodat het lid kan zien hoeveel er nog over zijn.

   DE EERLIJKHEID DIE DIT BLOK DUUR MAAKT: TOTP IS GEEN PASSKEY. Bij een passkey
   heeft dit huis de private helft nooit gezien; bij TOTP delen wij het geheim.
   Een code is dus door te vertellen aan wie erom vraagt -- precies waar phishing
   op drijft. Vandaar dat de vertrouwensstand (kern/identiteit/vertrouwen.js)
   voor wachtwoord + TOTP op `tweefactor` uitkomt en niet op `bezit`: twee
   factoren, allebei over te dragen. Dat is minder vleiend dan een groen vinkje
   en het is wat er waar is.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

const crypto = require('crypto');
const { totpOk } = require('../totp');

const CODES = 10;            // genoeg om er een paar te verliezen, weinig genoeg om te bewaren
const CODE_LENGTE = 10;
/* Zonder I, L, O, U en 0/1: een herstelcode wordt overgetypt van papier, en een
   nul die voor een O wordt aangezien is een lid dat denkt dat zijn laatste
   uitweg niet werkt. */
const ALFABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

const hashVan = (v) => crypto.createHash('sha256').update(String(v || '')).digest('hex');
const schoon = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function nieuweCode() {
  let uit = '';
  const bytes = crypto.randomBytes(CODE_LENGTE * 2);
  for (let i = 0; uit.length < CODE_LENGTE; i++) uit += ALFABET[bytes[i] % ALFABET.length];
  return uit;
}

/* Een base32-geheim voor de authenticator-app. 20 bytes is wat RFC 4226
   aanbeveelt en wat elke app aankan. */
function nieuwGeheim() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const b = crypto.randomBytes(20);
  let uit = '', bits = 0, waarde = 0;
  for (const byte of b) {
    waarde = (waarde << 8) | byte; bits += 8;
    while (bits >= 5) { uit += A[(waarde >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) uit += A[(waarde << (5 - bits)) & 31];
  return uit;
}

function maakTweefactor({ accounts }) {

  const dossier = (id) => accounts.getMemberState(id) || {};
  const bewaar = (id, md) => accounts.saveMemberState(id, md);

  function standVan(user) {
    const md = dossier(user.id);
    const t = md.tweefactor;
    if (!t || !t.aan) {
      return { aan: false, inWachtkamer: !!(t && t.geheim && !t.aan),
        uitleg: 'Er is geen tweede factor ingesteld. Uw wachtwoord is dan het enige dat tussen een ander en uw account staat.' };
    }
    const over = (t.codes || []).filter(Boolean).length;
    return {
      aan: true, sinds: t.aanSinds || null,
      herstelcodesOver: over, herstelcodesTotaal: (t.codes || []).length,
      /* Bij weinig codes hoort een waarschuwing, en die hoort te zeggen wat er
         gebeurt als ze op zijn -- niet alleen dat het er weinig zijn. */
      let: over === 0
        ? 'Al uw herstelcodes zijn gebruikt. Raakt u uw authenticator kwijt, dan komt u er niet meer in zonder hulp van RTG. Maak een nieuwe set aan.'
        : (over <= 2 ? 'U heeft nog ' + over + ' herstelcode(s). Maak een nieuwe set aan zolang u nog kunt inloggen.' : null),
      uitleg: 'Naast uw wachtwoord vraagt RTG een code uit uw authenticator-app. Dat is twee factoren -- maar allebei van de soort die u kunt doorvertellen, dus het beschermt niet tegen phishing zoals een passkey dat doet.'
    };
  }

  /* AANZETTEN IS TWEE STAPPEN, en dat is geen omslachtigheid. Zou het geheim
     meteen actief worden, dan sluit een lid dat de QR verkeerd scant zichzelf
     buiten -- en dat merkt hij pas bij de volgende inlog. Nu wordt het pas
     actief nadat hij een code heeft ingetypt die uit ZIJN app komt. */
  function begin(user, uitgever, naam) {
    const md = dossier(user.id);
    if (md.tweefactor && md.tweefactor.aan) {
      return { status: 409, error: 'Er staat al een tweede factor aan. Zet die eerst uit als u opnieuw wilt beginnen.' };
    }
    const geheim = nieuwGeheim();
    md.tweefactor = { geheim, aan: false, begonnen: klok.datum().toISOString(), codes: [] };
    bewaar(user.id, md);
    const label = encodeURIComponent(String(uitgever || 'RTG') + ':' + String(naam || 'lid'));
    return { ok: true, geheim,
      /* De otpauth-URI is wat een app scant. Hij draagt het geheim, dus hij komt
         maar EEN keer over de lijn en wordt nergens bewaard buiten het dossier. */
      uri: 'otpauth://totp/' + label + '?secret=' + geheim + '&issuer=' + encodeURIComponent(uitgever || 'RTG') + '&digits=6&period=30',
      uitleg: 'Scan dit in uw authenticator-app en typ daarna de code die u ziet. Pas dan gaat de tweede factor aan.' };
  }

  function bevestig(user, code) {
    const md = dossier(user.id);
    const t = md.tweefactor;
    if (!t || !t.geheim) return { status: 400, error: 'Er staat geen instelling klaar. Begin opnieuw.' };
    if (t.aan) return { status: 409, error: 'De tweede factor staat al aan.' };
    if (!totpOk(t.geheim, code)) return { status: 403, error: 'Die code klopt niet. Let op dat de klok van uw telefoon gelijk loopt.' };
    const codes = [];
    const gehasht = [];
    for (let i = 0; i < CODES; i++) { const c = nieuweCode(); codes.push(c); gehasht.push(hashVan(c)); }
    t.aan = true; t.aanSinds = klok.datum().toISOString(); t.codes = gehasht;
    bewaar(user.id, md);
    return { ok: true, herstelcodes: codes,
      /* De enige keer dat deze codes bestaan buiten een hash. Dat hoort er te
         staan, want een lid dat denkt ze later terug te kunnen vinden, bewaart
         ze niet. */
      let: 'Bewaar deze codes nu. Zij worden nooit meer getoond: RTG bewaart alleen een afdruk en kan ze niet terughalen.' };
  }

  /* De controle bij het inloggen. Neemt een TOTP-code OF een herstelcode; een
     herstelcode wordt daarbij opgebruikt. */
  function toets(user, invoer) {
    const md = dossier(user.id);
    const t = md.tweefactor;
    if (!t || !t.aan) return { ok: true, nvt: true };
    const inv = String(invoer || '').trim();
    if (totpOk(t.geheim, inv)) return { ok: true, soort: 'totp' };

    const h = hashVan(schoon(inv));
    const i = (t.codes || []).indexOf(h);
    if (i < 0) return { ok: false, error: 'Die code klopt niet.' };
    /* Opgebruikt, en de plek blijft leeg staan: zo weet het lid hoeveel er nog
       over zijn zonder dat wij de codes zelf hoeven te kennen. */
    t.codes[i] = null;
    bewaar(user.id, md);
    const over = t.codes.filter(Boolean).length;
    return { ok: true, soort: 'herstelcode', herstelcodesOver: over,
      let: over === 0
        ? 'Dit was uw laatste herstelcode. Maak meteen een nieuwe set aan.'
        : 'U heeft nog ' + over + ' herstelcode(s).' };
  }

  function nieuweCodes(user) {
    const md = dossier(user.id);
    const t = md.tweefactor;
    if (!t || !t.aan) return { status: 400, error: 'Er staat geen tweede factor aan.' };
    const codes = [];
    t.codes = [];
    for (let i = 0; i < CODES; i++) { const c = nieuweCode(); codes.push(c); t.codes.push(hashVan(c)); }
    bewaar(user.id, md);
    return { ok: true, herstelcodes: codes,
      let: 'Uw oude herstelcodes werken vanaf nu niet meer. Bewaar deze set; zij wordt nooit meer getoond.' };
  }

  /* UITZETTEN VRAAGT EEN GELDIGE CODE, en niet alleen het wachtwoord. Wie een
     open sessie kaapt heeft het wachtwoord vaak al; als dat genoeg was om de
     tweede factor weg te halen, is die factor een drempel van een tik hoog. */
  function uit(user, code) {
    const md = dossier(user.id);
    const t = md.tweefactor;
    if (!t || !t.aan) return { status: 400, error: 'Er staat geen tweede factor aan.' };
    const r = toets(user, code);
    if (!r.ok) return { status: 403, error: 'Die code klopt niet. Zonder een geldige code of herstelcode blijft de tweede factor staan.' };
    delete md.tweefactor;
    bewaar(user.id, md);
    return { ok: true,
      gevolg: 'Uw wachtwoord is nu weer het enige dat tussen een ander en uw account staat. Uw herstelcodes zijn ongeldig geworden.' };
  }

  /* DE POORT BIJ HET INLOGGEN, hier en niet in de route.

     Geeft `null` terug als er niets te vragen valt -- dan loopt de inlog door
     zoals hij altijd liep, en dat is de meeste accounts. Staat er wel een
     factor aan, dan komt hier het ANTWOORD vandaan dat de route teruggeeft: een
     kort bewijs dat het wachtwoord klopte, en nadrukkelijk geen sessie. Er
     hangt niets aan vast wat een lid mag, en het verloopt in vijf minuten.

     Dit hoort hier omdat een route niet hoort te weten HOE zo'n bewijs wordt
     gemaakt; hij hoort alleen te weten dat hij nog niet klaar is. */
  function inlogPoort(user) {
    const s = standVan(user);
    if (!s.aan) return null;
    return { tweedeFactorNodig: true,
      bewijs: accounts.issueActionToken(user.id, 'inlog2', 5 * 60 * 1000),
      herstelcodesOver: s.herstelcodesOver,
      uitleg: 'Uw wachtwoord klopt. Typ nu de code uit uw authenticator, of een van uw herstelcodes.' };
  }

  return { standVan, begin, bevestig, toets, nieuweCodes, uit, inlogPoort, CODES };
}

module.exports = { maakTweefactor, nieuwGeheim, CODES };
