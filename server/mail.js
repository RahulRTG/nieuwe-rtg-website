/* ============================================================================
   E-mailverzending.

   DRIE standen, in deze volgorde:

   1. SMTP_URL gezet -> afleveren bij een ingehuurde smarthost (server/smtp.js).
   2. MAIL_DIRECT=1  -> ZELF bezorgen bij de mailserver van de ontvanger
      (server/smtp-direct.js), ondertekend met DKIM (server/dkim.js). Dit is de
      eigen post: geen provider ertussen, en dus ook niemand die de reputatie
      voor ons regelt. Lees de kop van smtp-direct.js voordat u dit aanzet --
      poort 25 uit is bij de meeste hosters dicht, en zonder PTR, SPF en DMARC
      komt de post in de spammap.
   3. anders -> de outbox, zoals hieronder beschreven.

   Bij 1 en 2 valt een MISLUKTE verzending terug op de outbox, met de reden in
   het logboek. Een tijdelijke fout (4xx) en een permanente (5xx) worden apart
   gemeld: bij de eerste heeft opnieuw proberen zin, bij de tweede niet.

   De oude tekst hieronder gold voor de eerste twee standen:
   - Met SMTP_URL in de omgeving (bijv. smtp://user:pass@smtp.provider.nl:587)
     verstuurt de eigen SMTP-client (server/smtp.js) echte e-mail. MAIL_FROM
     bepaalt de afzender.
   - Zonder SMTP_URL worden berichten naar server/data/outbox geschreven en
     gelogd. De verificatie- en herstel-links zijn ook dan echt en werken.
   Zo is de hele mailstroom af voor livegang: alleen nog een SMTP-account
   koppelen via twee omgevingsvariabelen.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const OUTBOX = path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'outbox');
const SMTP_URL = process.env.SMTP_URL || '';
const FROM = process.env.MAIL_FROM || 'Rahul Travel Group <no-reply@rahultravelgroup.example>';
const DIRECT = process.env.MAIL_DIRECT === '1';
const DKIM_SLEUTEL = process.env.DKIM_PRIVATE_KEY || '';
const DKIM_SELECTOR = process.env.DKIM_SELECTOR || 'rtg';
const MAIL_DOMEIN = process.env.MAIL_DOMEIN || (/@([^>\s]+)/.exec(FROM) || [])[1] || '';

let transporter = null;
if (SMTP_URL) {
  try {
    transporter = require('./smtp').createTransport(SMTP_URL);
    console.log('[mail] SMTP-transport actief.');
  } catch (e) {
    console.warn('[mail] SMTP_URL gezet maar ongeldig (' + (e && e.message) + '); e-mail gaat naar de outbox.');
  }
}
const CONFIGURED = !!transporter;

/* De outbox is niet alleen de ontwikkelstand: hij vangt ook mail op als een
   ECHTE verzending mislukt (zie send() hieronder). Dan liggen er dus op de
   productiemachine bestanden met het e-mailadres van een lid en een werkende
   bevestigings- of herstel-link erin. Daarom gaat de outbox door dezelfde kluis
   als de rest: staat RTG_ENC_KEY, dan versleuteld (.eml.enc), anders leesbaar
   (.txt) zodat lokaal ontwikkelen niet omslachtig wordt. Terugkijken kan met
   `npm run outbox`. */
function toOutbox(to, subject, text) {
  fs.mkdirSync(OUTBOX, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(OUTBOX, 0o700); } catch (e) {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bericht = `From: ${FROM}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`;
  const kluis = require('./kluis');
  const naam = stamp + (kluis.AAN ? '.eml.enc' : '.txt');
  fs.writeFileSync(path.join(OUTBOX, naam), kluis.versleutel(bericht), { mode: 0o600 });
  // het adres zelf hoort niet in het logboek als de inhoud wel beschermd is
  console.log(`[mail] (outbox) ${kluis.AAN ? 'versleuteld opgeslagen' : 'naar ' + to}: ${subject}`);
}

/* Het bericht zoals het over de lijn gaat. Bij directe bezorging bouwen wij
   het zelf op -- er is geen provider meer die koppen aanvult -- en dus hoort
   alles erin te staan wat een ontvanger verwacht: een datum, een uniek
   Message-ID, en de tekst als UTF-8. */
function bouwBericht(to, subject, text) {
  const crypto = require('crypto');
  /* De opmaak-hulpjes komen uit server/smtp.js en worden hier NIET nagemaakt:
     een onderwerp met een accent hoort in beide standen op dezelfde manier
     gecodeerd te worden, en twee kopieen van die regel lopen ooit uiteen. */
  const { _kopWaarde: kopWaarde, _rfcDatum: rfcDatum } = require('./smtp');
  const id = '<' + crypto.randomBytes(12).toString('hex') + '@' + (MAIL_DOMEIN || 'localhost') + '>';
  const koppen = {
    From: FROM, To: to, Subject: kopWaarde(subject), Date: rfcDatum(new Date()),
    'Message-ID': id, 'MIME-Version': '1.0',
    'Content-Type': 'text/plain; charset=utf-8', 'Content-Transfer-Encoding': 'base64'
  };
  /* Base64 en niet 8bit: wij onderhandelen bij directe bezorging geen 8BITMIME,
     en een ontvanger die dat niet aanbiedt mag hoge bytes weggooien -- dan komt
     de mail aan met kapotte accenten. Het lost meteen het punt-aan-het-begin-
     van-een-regel-probleem op. */
  const lijf = Buffer.from(String(text == null ? '' : text) + '\n', 'utf8')
    .toString('base64').replace(/(.{76})/g, '$1\r\n');
  let dkim = null;
  if (DKIM_SLEUTEL && MAIL_DOMEIN) {
    try {
      const uit = require('./dkim').onderteken({ koppen, lijf, domein: MAIL_DOMEIN,
        selector: DKIM_SELECTOR, priveSleutel: DKIM_SLEUTEL });
      if (uit.ok) dkim = uit.kop;
      else console.warn('[mail] niet ondertekend:', uit.waarom);
    } catch (e) { console.warn('[mail] DKIM mislukt:', e.message); }
  }
  const kop = (dkim ? dkim + '\r\n' : '') +
    Object.keys(koppen).map(k => k + ': ' + koppen[k]).join('\r\n');
  return { rauw: kop + '\r\n\r\n' + lijf, ondertekend: !!dkim, messageId: id };
}

/* Zelf bezorgen. Let op de meldingen: een PERMANENTE weigering (5xx) zegt dat
   het adres niet bestaat en opnieuw proberen zinloos is; een tijdelijke zegt
   het tegenovergestelde. Dat verschil hoort in het logboek te staan, anders
   blijft iemand dagen bonzen op een adres dat er niet is. */
function stuurDirect(to, subject, text) {
  const { rauw, ondertekend } = bouwBericht(to, subject, text);
  const van = (/<([^>]+)>/.exec(FROM) || [null, FROM])[1];
  require('./smtp-direct').bezorg({ van, naar: to, bericht: rauw })
    .then(uit => {
      if (uit.ok) {
        console.log('[mail] zelf bezorgd bij ' + uit.via + (ondertekend ? ' (ondertekend)' : ' (NIET ondertekend: zet DKIM_PRIVATE_KEY)'));
        return;
      }
      console.warn('[mail] ' + uit.soort + ' niet bezorgd (' + (uit.waarom || uit.code) + '); naar de outbox' +
        (uit.soort === 'permanent' ? ' -- opnieuw proberen heeft geen zin' : ' -- later opnieuw proberen kan wel'));
      try { toOutbox(to, subject, text); } catch (e) {}
    })
    .catch(e => { console.warn('[mail] eigen bezorging mislukt:', e.message); try { toOutbox(to, subject, text); } catch (e2) {} });
}

/* DEZELFDE VERZENDING, MAAR MET EEN ANTWOORD. `send()` hierboven is
   fire-and-forget: goed genoeg voor een bevestigingsmail, maar onbruikbaar voor
   een wachtrij, want die moet WETEN wat er gebeurde. Deze variant geeft
   { ok, soort } terug -- bezorgd, tijdelijk of permanent -- en dat onderscheid
   is waar kern/mailwachtrij.js zijn hele gedrag op baseert: bij tijdelijk
   opnieuw proberen, bij permanent nooit meer.

   De outbox telt hier als BEZORGD, met `via: 'outbox'` erbij. Dat is eerlijker
   dan hem als mislukking tellen: zonder SMTP-instellingen is de outbox de
   afgesproken bestemming, en een wachtrij die daar eindeloos op blijft
   herproberen doet alsof er iets stuk is. */
async function bezorgNu(to, subject, text) {
  if (!to || !/@/.test(String(to))) return { ok: false, soort: 'permanent', waarom: 'dat is geen e-mailadres' };
  if (transporter) {
    try {
      await transporter.sendMail({ from: FROM, to, subject, text });
      return { ok: true, soort: 'bezorgd', via: 'smarthost' };
    } catch (e) {
      const m = String((e && e.message) || '');
      // een 5xx van de smarthost is net zo permanent als een 5xx van de ontvanger
      return { ok: false, soort: /\b5\d\d\b/.test(m) ? 'permanent' : 'tijdelijk', waarom: m };
    }
  }
  if (DIRECT) {
    const { rauw } = bouwBericht(to, subject, text);
    const van = (/<([^>]+)>/.exec(FROM) || [null, FROM])[1];
    try { return await require('./smtp-direct').bezorg({ van, naar: to, bericht: rauw }); }
    catch (e) { return { ok: false, soort: 'tijdelijk', waarom: (e && e.message) || 'onbekende fout' }; }
  }
  try { toOutbox(to, subject, text); return { ok: true, soort: 'bezorgd', via: 'outbox' }; }
  catch (e) { return { ok: false, soort: 'tijdelijk', waarom: (e && e.message) || 'de outbox is niet te schrijven' }; }
}

function send(to, subject, text) {
  if (!to || !/@/.test(String(to))) return;
  if (transporter) {
    transporter.sendMail({ from: FROM, to, subject, text })
      .then(() => console.log(`[mail] verzonden naar ${to}: ${subject}`))
      .catch(e => { console.warn('[mail] verzenden mislukt, naar outbox:', e.message); try { toOutbox(to, subject, text); } catch (e2) {} });
    return;
  }
  if (DIRECT) return stuurDirect(to, subject, text);
  try { toOutbox(to, subject, text); } catch (e) { console.warn('[mail] mislukt:', e.message); }
}

module.exports = { send, bezorgNu, configured: CONFIGURED || DIRECT, direct: DIRECT, bouwBericht };
