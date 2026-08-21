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
const smsSandbox = require('./sms-sandbox');

const SMTP_URL = process.env.SMTP_URL || '';
const SMTP_SANDBOX_GEVRAAGD = process.env.SMTP_SANDBOX === '1';
const SMTP_SANDBOX = SMTP_SANDBOX_GEVRAAGD && process.env.NODE_ENV !== 'production';
const FROM = process.env.MAIL_FROM || 'Rahul Travel Group <no-reply@rahultravelgroup.example>';
const DIRECT = process.env.MAIL_DIRECT === '1';
const DKIM_SLEUTEL = process.env.DKIM_PRIVATE_KEY || '';
const DKIM_SELECTOR = process.env.DKIM_SELECTOR || 'rtg';
const PROVIDER_DKIM = process.env.MAIL_PROVIDER_DKIM === '1';
const MAIL_DOMEIN = process.env.MAIL_DOMEIN || (/@([^>\s]+)/.exec(FROM) || [])[1] || '';
const mailPubliek = require('./kern/mail-publiek')({});
const smtpDkim = () => DKIM_SLEUTEL && MAIL_DOMEIN ? {
  priveSleutel: DKIM_SLEUTEL, domein: MAIL_DOMEIN, selector: DKIM_SELECTOR
} : undefined;

let transporter = null;
if (SMTP_URL) {
  try {
    const host = new URL(SMTP_URL).hostname.toLowerCase();
    const lokaal = host === '127.0.0.1' || host === 'localhost' || host === '::1';
    if (SMTP_SANDBOX && !lokaal) throw new Error('SMTP_SANDBOX accepteert alleen localhost/loopback');
    transporter = require('./smtp').createTransport(SMTP_URL);
    console.log('[mail] SMTP-transport actief' + (SMTP_SANDBOX ? ' (lokale sandbox).' : '.'));
  } catch (e) {
    console.warn('[mail] SMTP_URL gezet maar ongeldig (' + (e && e.message) + '); e-mail gaat naar de outbox.');
  }
}
const CONFIGURED = !!transporter;

/* Het vangnet -- de outbox waar alles op terugvalt -- staat in
   ./mail-outbox.js, samen met het pad waar hij woont. Drie modules schrijven
   erin (dit bestand, de eigen bezorging en de SMS-kant), dus hij is geen
   detail van een van die drie. */
const { toOutbox } = require('./mail-outbox')({ FROM });

/* De SMS-kant en de sandbox-zekering staan in ./mail-lokaal.js. Daar woont ook
   de STAND van de twee sandboxen: die werd hier op vier plekken gelezen en op
   twee geschreven zonder dat iets aanwees wie erover ging. */
/* `kanalen` en niet `lokaal`: een paar regels hierboven heet een blokvariabele
   in de SMTP-controle al zo ("de host is loopback"), en twee dingen met dezelfde
   naam in een bestand leest niemand twee keer goed. */
const kanalen = require('./mail-lokaal')({ CONFIGURED, SMTP_SANDBOX, DIRECT, toOutbox });
const { sendSms, zetSandbox, sandboxStand } = kanalen;

/* Het OPSTELLEN van een bericht -- de RFC-koppen, de codering en de
   DKIM-handtekening -- staat in ./mail-opstellen.js. Zelfde soort knip als
   ./mail-bezorgen.js hieronder: daar staat HOE het over de lijn gaat, hier
   staat WAT er over de lijn gaat, en in dit bestand blijft WAARHEEN en wat
   er gebeurt als dat niet lukt. */
const { bouwBericht } = require('./mail-opstellen')({ FROM, MAIL_DOMEIN, DKIM_SLEUTEL, DKIM_SELECTOR });
/* Zelf bezorgen staat in ./mail-bezorgen.js. Afgesplitst omdat dit bestand over
   de 10 KB ging, en de knip loopt langs een echte grens: hierboven staat WAT er
   verstuurd wordt en waar het blijft als dat niet lukt, daar staat HOE het over
   de lijn gaat (MX opzoeken, SMTP praten, de meldingen van de andere kant
   lezen). Twee onderwerpen, twee lezers. */
const stuurDirect = (to, subject, text, opties) =>
  require('./mail-bezorgen').stuurDirect({ to, subject, text, FROM, bouwBericht, toOutbox, opties });

function send(to, subject, text, opties) {
  if (!to) return;
  /* EEN BERICHT DAT NERGENS HEEN KAN, MOET JE KUNNEN ZIEN.

     Hier stond `if (!/@/.test(to)) return;` -- alles zonder apenstaartje viel
     stil op de grond. Dat raakt precies een ding: de tweede stap van het
     wachtwoordherstel, want die gaat als 'sms:<nummer>' de deur uit. Zonder
     SMS-kanaal verdween die code dus spoorloos, terwijl het antwoord aan de
     gebruiker vrolijk `tweestaps: true` meldde. Het herstel was daarmee voor
     IEDEREEN onmogelijk, en niets in het systeem zei dat.

     Een sms-kanaal maken we hier niet; wat we wel doen is het bericht bewaren
     zoals elk ander onbestelbaar bericht, in de outbox. Dan is een storing te
     zien in plaats van te raden, en kan de eigenaar de code desnoods zelf
     voorlezen tot er een echt kanaal staat. */
  /* Elk bericht dat de deur uitgaat komt in het doorgeefjournaal: WAT, WAARHEEN
     (alleen de soort of het domein, nooit de persoon) en of het lukte. Dat is de
     kant die vandaag ontbrak toen een sms spoorloos verdween. */
  const journaal = (gelukt, hoe, reden) => {
    try { require('./journaalhaak').meld({ richting: 'uit', wat: 'post/' + hoe, naar: to, mislukt: !gelukt, reden }); } catch (e) {}
  };
  const isMail = /@/.test(String(to));
  if (!isMail) return sendSms(String(to).replace(/^sms:/i, ''), subject, text);
  if (transporter && (!SMTP_SANDBOX || kanalen.smtpAan())) {
    transporter.sendMail({ from: opties && opties.from || FROM,
      envelopeFrom: opties && opties.envelopeFrom || FROM,
      to, subject, text, dkim: smtpDkim() })
      .then(() => { console.log(`[mail] verzonden naar ${to}: ${subject}`); journaal(true, 'smtp'); })
      .catch(e => { console.warn('[mail] verzenden mislukt, naar outbox:', e.message); journaal(false, 'smtp', e.message); try { toOutbox(to, subject, text, opties); } catch (e2) {} });
    return;
  }
  if (DIRECT) return stuurDirect(to, subject, text, opties);
  try { toOutbox(to, subject, text, opties); journaal(true, 'outbox'); } catch (e) { console.warn('[mail] mislukt:', e.message); journaal(false, 'outbox', e.message); }
}

/* Alleen een alias die door de server uit een intern postvak is afgeleid, mag
   als zichtbare afzender naar buiten. De envelope-afzender blijft MAIL_FROM,
   zodat SPF, retourpost en reputatie op één gecontroleerd domein rusten. */
function sendAls(internVan, to, subject, text) {
  const publiekVan = mailPubliek.publiek(internVan);
  if (!publiekVan) return send(to, subject, text);
  return send(to, subject, text, { from: publiekVan, envelopeFrom: FROM });
}

async function bezorgNu(to, subject, text) {
  if (!to || !/@/.test(String(to))) return { ok: false, soort: 'permanent', waarom: 'dat is geen e-mailadres' };
  if (transporter && (!SMTP_SANDBOX || kanalen.smtpAan())) {
    try {
      await transporter.sendMail({ from: FROM, to, subject, text, dkim: smtpDkim() });
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

/* Er is nog bewust geen extern SMS-kanaal aangesloten. Dit expliciete veld
   laat herstel en het techniekbord fail-closed beslissen; een sms:...-bericht
   in de outbox is zichtbaar, maar is géén bezorgde tweede factor. */
module.exports = {
  send, sendAls, sendSms, bezorgNu, configured: CONFIGURED || DIRECT,
  publiekMailActief: mailPubliek.actief, publiekMailBasis: mailPubliek.basis,
  providerDkim: PROVIDER_DKIM && CONFIGURED,
  liveConfigured: (CONFIGURED && !SMTP_SANDBOX) || DIRECT,
  sandboxConfigured: CONFIGURED && SMTP_SANDBOX,
  smsConfigured: false, smsSandboxConfigured: smsSandbox.enabled,
  smsMode: smsSandbox.mode, direct: DIRECT, bouwBericht, zetSandbox, sandboxStand
};
