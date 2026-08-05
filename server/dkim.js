/* ============================================================================
   DKIM: onze eigen post ondertekenen.

   WAAROM DIT ER MOET ZIJN. Zodra RTG zijn mail ZELF bezorgt (server/smtp-direct.js)
   in plaats van via een provider, is er niemand meer die de reputatie regelt.
   Een bericht van een onbekend IP zonder handtekening komt bij Gmail en Outlook
   in de spammap of wordt geweigerd. DKIM is het enige deel daarvan dat in CODE
   op te lossen is: een handtekening over de kop en het lijf, met een publieke
   sleutel in DNS zodat de ontvanger hem kan narekenen.

   GEEN EIGEN CRYPTOGRAFIE. Dezelfde regel als in server/smtp.js: het rekenwerk
   komt volledig uit node:crypto (RSA-SHA256). Wat hier staat is de
   CANONICALISATIE -- de afspraak hoe je een bericht platslaat voordat je het
   ondertekent -- en dat is tekstbewerking, geen crypto.

   WAT DIT NIET OPLOST, en dat hoort iemand te weten voordat hij hierop bouwt:
   een handtekening is een van de DRIE dingen die een ontvanger nakijkt. De
   andere twee staan niet in code maar in DNS en bij de hosting:

     - SPF   : een TXT-record dat zegt welk IP namens dit domein mag versturen;
     - DMARC : een TXT-record dat zegt wat een ontvanger moet doen als het
               misgaat;
     - PTR   : de omgekeerde naam van het verzendende IP moet kloppen met de
               naam waarmee we onszelf voorstellen.

   `dnsRegels()` hieronder schrijft die drie voor u uit. Ze publiceren is
   mensenwerk en gebeurt hier niet vanzelf.
   ========================================================================== */
'use strict';
const crypto = require('crypto');

/* ---------- canonicalisatie (relaxed) ----------
   De ontvanger slaat het bericht op precies dezelfde manier plat voordat hij
   narekent. Wijkt onze versie een spatie af, dan faalt de handtekening -- en
   dan is er niets aan te zien behalve dat de mail niet aankomt. */
function kopRelaxed(naam, waarde) {
  return naam.toLowerCase().trim() + ':' +
    String(waarde).replace(/\r?\n[ \t]+/g, ' ').replace(/[ \t]+/g, ' ').trim() + '\r\n';
}
function lijfRelaxed(lijf) {
  let s = String(lijf).replace(/\r?\n/g, '\r\n');
  s = s.split('\r\n').map(r => r.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, '')).join('\r\n');
  s = s.replace(/(\r\n)+$/, '');
  return s.length ? s + '\r\n' : '\r\n';
}

/* Een sleutelpaar. De private helft hoort in een secrets manager, niet in de
   repo -- vandaar dat dit een functie is en geen bestand dat we neerzetten. */
function maakSleutelpaar(bits) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: Math.max(1024, Math.min(4096, bits || 2048)),
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publiek: publicKey, prive: privateKey, p: publiekPlat(publicKey) };
}

// de publieke sleutel zoals hij in het DNS-record staat: base64, zonder kop
function publiekPlat(pem) {
  return String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
}

/* Ondertekenen. `koppen` is een object; alleen wat in ONDERTEKEND staat gaat
   mee, want een ontvanger mag koppen toevoegen en dan zou de handtekening
   breken op iets wat wij niet hebben geschreven. */
const ONDERTEKEND = ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type'];

function onderteken({ koppen, lijf, domein, selector, priveSleutel }) {
  if (!domein || !selector || !priveSleutel) return { ok: false, waarom: 'domein, selector en private sleutel zijn alle drie nodig' };
  const aanwezig = ONDERTEKEND.filter(h => Object.keys(koppen).some(k => k.toLowerCase() === h));
  if (!aanwezig.includes('from')) return { ok: false, waarom: 'een bericht zonder From is niet te ondertekenen' };

  const bh = crypto.createHash('sha256').update(lijfRelaxed(lijf), 'binary').digest('base64');
  const veld = 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=' + domein + '; s=' + selector +
    '; t=' + Math.floor(Date.now() / 1000) + '; h=' + aanwezig.join(':') + '; bh=' + bh + '; b=';

  let basis = '';
  for (const h of aanwezig) {
    const sleutel = Object.keys(koppen).find(k => k.toLowerCase() === h);
    basis += kopRelaxed(h, koppen[sleutel]);
  }
  basis += kopRelaxed('dkim-signature', veld).replace(/\r\n$/, '');

  const b = crypto.createSign('RSA-SHA256').update(basis, 'binary').sign(priveSleutel, 'base64');
  return { ok: true, kop: 'DKIM-Signature: ' + veld + b, veld: veld + b, bh, ondertekend: aanwezig };
}

/* Narekenen zoals een ontvanger het doet. Staat hier omdat een handtekening
   die je nooit hebt zien VERIFIEREN net zo goed onzin kan zijn -- de toets
   gebruikt dit, en dat is precies waarom het bestaat. */
function controleer({ koppen, lijf, veld, publiekeSleutel }) {
  const m = /(^|;)\s*b=([^;]+)/.exec(veld);
  const hm = /(^|;)\s*h=([^;]+)/.exec(veld);
  const bhm = /(^|;)\s*bh=([^;]+)/.exec(veld);
  if (!m || !hm || !bhm) return { ok: false, waarom: 'de handtekening mist b=, h= of bh=' };
  const b = m[2].replace(/\s+/g, '');
  const lijst = hm[2].split(':').map(x => x.trim().toLowerCase());

  const bh = crypto.createHash('sha256').update(lijfRelaxed(lijf), 'binary').digest('base64');
  if (bh !== bhm[2].replace(/\s+/g, '')) return { ok: false, waarom: 'het lijf is gewijzigd na ondertekening' };

  let basis = '';
  for (const h of lijst) {
    const sleutel = Object.keys(koppen).find(k => k.toLowerCase() === h);
    if (sleutel != null) basis += kopRelaxed(h, koppen[sleutel]);
  }
  basis += kopRelaxed('dkim-signature', veld.replace(/([;\s]b=)[^;]+/, '$1')).replace(/\r\n$/, '');
  const goed = crypto.createVerify('RSA-SHA256').update(basis, 'binary').verify(publiekeSleutel, b, 'base64');
  return goed ? { ok: true } : { ok: false, waarom: 'de handtekening klopt niet met de kop' };
}

/* De drie DNS-regels die een mens moet publiceren. Ze staan hier zodat het
   antwoord van het systeem concreet is in plaats van "regel uw DNS". */
function dnsRegels({ domein, selector, publiekeSleutel, ip }) {
  return [
    { naam: (selector || 'rtg') + '._domainkey.' + domein, soort: 'TXT',
      waarde: 'v=DKIM1; k=rsa; p=' + publiekPlat(publiekeSleutel || ''),
      wat: 'hiermee rekent de ontvanger onze handtekening na' },
    { naam: domein, soort: 'TXT',
      waarde: 'v=spf1' + (ip ? ' ip4:' + ip : ' ip4:UW-IP') + ' -all',
      wat: 'zegt welk IP namens dit domein mag versturen; -all betekent: en verder niemand' },
    { naam: '_dmarc.' + domein, soort: 'TXT',
      waarde: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domein,
      wat: 'zegt wat een ontvanger moet doen als SPF of DKIM faalt, en waar hij de rapporten stuurt' }
  ];
}

module.exports = { onderteken, controleer, maakSleutelpaar, dnsRegels, publiekPlat, lijfRelaxed, kopRelaxed };
