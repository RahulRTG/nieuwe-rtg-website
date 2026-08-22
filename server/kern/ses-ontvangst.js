/* De vertrouwensgrens tussen AWS SES en RTG Mail.

   SES bewaart het ongewijzigde bericht kort in S3. De Lambda-brug haalt die
   bytes op en POST ze als message/rfc822. Vier koppen worden ondertekend met
   een gedeeld geheim: tijd, SES-message-id, de echte envelop-ontvanger en de
   SHA-256 van de bytes. De zichtbare To-kop beslist dus nooit waar post komt.

   Een SES/Lambda-bezorging is at-least-once. Daarom wordt de combinatie van
   message-id en ontvanger geclaimd voordat de asynchrone mailketen begint.
   Een vastgelopen claim mag na tien minuten opnieuw; een voltooide blijft
   zeven dagen herkenbaar. Alleen hashes worden bewaard, geen adressen. */
'use strict';

const crypto = require('node:crypto');
const { MAX_BYTES } = require('../smtp-in-data');
const { nu: klokNu } = require('../lib/klok');

const KLOK_MARGE_MS = 5 * 60 * 1000;
const CLAIM_TTL_MS = 10 * 60 * 1000;
const BEWAAR_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLAIMS = 10000;

const tekst = v => String(v == null ? '' : v).trim();
const veiligAdres = v => {
  const a = tekst(v).toLowerCase();
  return a.length <= 254 && /^[^\s<>@]+@[^\s<>@]+$/.test(a) ? a : '';
};
const veiligId = v => {
  const id = tekst(v);
  return id.length <= 200 && /^[A-Za-z0-9._@+=:/-]+$/.test(id) ? id : '';
};
const UITSLAGEN = new Set(['PASS', 'FAIL', 'GRAY', 'PROCESSING_FAILED']);
const uitslag = v => { const s=tekst(v).toUpperCase(); return UITSLAGEN.has(s) ? s : ''; };
const controlesVan = c => ({ spf:uitslag(c && c.spf), dkim:uitslag(c && c.dkim),
  dmarc:uitslag(c && c.dmarc), spam:uitslag(c && c.spam), virus:uitslag(c && c.virus) });
const controleTekst = c => [c.spf, c.dkim, c.dmarc, c.spam, c.virus].join('|');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const grondtekst = ({ tijd, berichtId, ontvanger, bytes, controles }) =>
  String(tijd) + '\n' + berichtId + '\n' + ontvanger + '\n' + sha256(bytes) + '\n' +
  controleTekst(controlesVan(controles));
const teken = (geheim, velden) => crypto.createHmac('sha256', geheim)
  .update(grondtekst(velden)).digest('hex');

module.exports = ({ db, save, geheim, nu } = {}) => {
  const secret = tekst(geheim == null ? process.env.SES_INBOUND_SECRET : geheim);
  const klok = typeof nu === 'function' ? nu : klokNu;
  const actief = secret.length >= 32;

  function controleer({ tijd, berichtId, ontvanger, bytes, handtekening, controles } = {}) {
    /* NIET INGERICHT IS EEN ANTWOORD VOOR EEN BEVOEGDE, NIET VOOR EEN VREEMDE.

       Hier stond deze controle als EERSTE, en dan gaf een verzoek zonder enige
       handtekening een 503: "De SES-ontvangstbrug is niet ingericht." De ladder
       ving dat op de trede "de dwaler" -- een verzoek zonder token dat een
       serverfout uitlokt. Dat is twee dingen tegelijk fout. Het vertelt een
       willekeurige buitenstaander hoe dit huis is ingericht, en het laat een
       storing klinken waar een weigering hoort te staan.

       De volgorde is nu: eerst de envelop en de handtekening, en pas als die
       kloppen mag het antwoord verraden dat de brug niet is ingericht. Wie geen
       geldige handtekening heeft, krijgt 401 -- en kan dus niet uit het verschil
       aflezen of de brug aan staat. Wie er wel een heeft, krijgt de eerlijke
       503 die hij nodig heeft om het te repareren.

       Dit is het spiegelbeeld van de regel uit CONTROLPLANE.md dat ONBEKEND
       geen synoniem van WEIGEREN is: binnen het huis hoort een storing niet als
       overtreding te klinken, en naar buiten hoort hij helemaal niet te klinken. */
    const stamp = Number(tijd);
    const id = veiligId(berichtId);
    const naar = veiligAdres(ontvanger);
    /* ALLEEN EEN BUFFER OF EEN STRING IS BYTES. Hier stond `Buffer.from(bytes || '')`,
       en dat gooit een TypeError zodra `bytes` iets anders is -- bijvoorbeeld het
       lege object dat de globale JSON-parser achterlaat wanneer een aanroeper
       GEEN message/rfc822 stuurt. Dat is precies wat een vreemde doet die op de
       deur klopt, en het leverde een 500 op: een serverfout waar een nette
       weigering hoort. De ladder ving hem pas nadat de 503 hierboven naar
       achteren was verplaatst; daarvóór dekte die de crash af. Een lege buffer
       valt hieronder gewoon door de envelopcontrole. */
    const ruw = Buffer.isBuffer(bytes) ? bytes
      : Buffer.from(typeof bytes === 'string' ? bytes : '');
    if (!Number.isInteger(stamp) || !id || !naar || !ruw.length)
      return { status: 400, error: 'Ongeldige SES-envelop.' };
    if (ruw.length > MAX_BYTES)
      return { status: 413, error: 'Het bericht is groter dan de RTG-mailgrens.' };
    if (Math.abs(klok() - stamp * 1000) > KLOK_MARGE_MS)
      return { status: 401, error: 'Ongeldige SES-handtekening.' };
    const providerControles=controlesVan(controles);
    const gekregen = tekst(handtekening).toLowerCase();
    const verwacht = teken(secret, { tijd:stamp, berichtId:id, ontvanger:naar,
      bytes:ruw, controles:providerControles });
    if (!/^[a-f0-9]{64}$/.test(gekregen) ||
        !crypto.timingSafeEqual(Buffer.from(gekregen, 'hex'), Buffer.from(verwacht, 'hex')))
      return { status: 401, error: 'Ongeldige SES-handtekening.' };

    /* Pas hier: de handtekening klopt, dus dit is een bevoegde aanroeper. */
    if (!actief) return { status: 503, error: 'De SES-ontvangstbrug is niet ingericht.' };
    return { ok:true, tijd:stamp, berichtId:id, ontvanger:naar, bytes:ruw,
      controles:providerControles };
  }

  function kast() {
    if (!db.data.sesOntvangst || typeof db.data.sesOntvangst !== 'object')
      db.data.sesOntvangst = { claims:[] };
    if (!Array.isArray(db.data.sesOntvangst.claims)) db.data.sesOntvangst.claims = [];
    return db.data.sesOntvangst.claims;
  }
  const sleutelVan = v => sha256(Buffer.from(v.berichtId + '\n' + v.ontvanger));
  const bewaar = () => { if (typeof save === 'function') save(); };

  function claim(v) {
    const tijd = klok();
    const claims = kast();
    for (let i=claims.length - 1; i>=0; i--) {
      if (!claims[i] || tijd - Number(claims[i].at || 0) > BEWAAR_MS) claims.splice(i, 1);
    }
    const sleutel = sleutelVan(v);
    const bestaand = claims.find(x => x.sleutel === sleutel);
    if (bestaand && bestaand.status === 'klaar') return { dubbel:true, sleutel };
    if (bestaand && tijd - Number(bestaand.at || 0) < CLAIM_TTL_MS)
      return { bezig:true, sleutel };
    if (bestaand) { bestaand.status='bezig'; bestaand.at=tijd; }
    else claims.push({ sleutel, status:'bezig', at:tijd });
    if (claims.length > MAX_CLAIMS) claims.splice(0, claims.length - MAX_CLAIMS);
    bewaar();
    return { ok:true, sleutel };
  }
  function klaar(sleutel) {
    const c=kast().find(x => x.sleutel === sleutel);
    if (c) { c.status='klaar'; c.at=klok(); bewaar(); }
  }
  function vrij(sleutel) {
    const claims=kast();
    const i=claims.findIndex(x => x.sleutel === sleutel && x.status === 'bezig');
    if (i >= 0) { claims.splice(i, 1); bewaar(); }
  }

  return { actief, controleer, claim, klaar, vrij };
};

module.exports.teken = teken;
module.exports.grondtekst = grondtekst;
module.exports.KLOK_MARGE_MS = KLOK_MARGE_MS;
module.exports.MAX_BYTES = MAX_BYTES;
