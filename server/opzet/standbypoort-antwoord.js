/* DE TWEEDE BLIK: BIJ HET ANTWOORD (N11 van de V1-audit, besluit (a) van de
   eigenaar, gebouwd op 6 oktober 2026). Hoort bij ./standbypoort.js.

   DE FOUT: de stand-bypoort keek alleen bij de INGANG naar db.writable. Een
   verzoek dat al voorbij de poort was toen de poortwachter de server afzette
   (POST /api/cluster/demote), deed zijn werk gewoon af. bewaar() keerde stil
   terug (../db/index.js), en het antwoord was 200. Nagedaan met
   /api/sleutelwoorden/zet: verstuurd, 0 tot 100 ms later de demote, en zes
   van de zes keer 200 met gezet:true en na een nieuwe promote gezet:false.

   DE REGEL: schreef het proces bij de ingang nog en bij het antwoord niet
   meer, dan wordt een SUCCESantwoord (status onder 400) een 503 met
   Retry-After. Een fout is al eerlijk en blijft staan. Dit is met opzet
   streng: ook een verzoek dat zijn save() nog net voor de afzetting deed,
   krijgt 503, want welke van de twee het was is hier niet te zien. Een te
   strenge weigering kost een herhaling; een stille 200 kost een schrijfactie.
   De tekst zegt daarom ook niet "mislukt" maar "staat niet vast".

   WAAROM end() EN write() EN NIET res.json. In ../web/verrijk.js lopen json,
   send en redirect allemaal uit op res.end, en sendFile op res.end of op een
   pipe, en een pipe begint met res.write. Dat zijn de twee punten waar elk
   antwoord langskomt terwijl het lijf nog te vervangen is. writeHead is wel
   lager, maar daar is het lijf van end(lijf) al onderweg en niet meer te
   ruilen. De haak wordt gezet in de poort, dus NA elke laag die eerder in de
   keten res.end omwikkelt (effectbon, effectmeter, staatlog en de
   PostgreSQL-grens) en is daarmee de buitenste: elke aanroep van res.end komt
   eerst hier. (Alleen de wikkel van ../lib/eindstatus.js komt later en zit er
   dus omheen, maar die geeft eerst door en kijkt pas daarna naar de status.)

   WAT HIJ NIET KAN, en dat blijft rest:
   - een antwoord waarvan de koppen al weg zijn (een stroom die al schreef,
     SSE, een expliciete writeHead of flushHeaders). Dat is niet meer terug te
     draaien en wordt met rust gelaten.
   - een afzetting EN een nieuwe promotie binnen een verzoek: bij het antwoord
     schrijft hij dan weer, en een save() in het gat is verloren.

   EN DE IDEMPOTENTIELAGEN KIJKEN NAAR WAT HIER UITKOMT. ../lib/idem-poort.js,
   ../lib/dubbeltik.js en ../middleware/idempotentie.js onthielden een 2xx al
   in res.json, dus VOOR deze haak, en de herhaling waar onze 503 om vraagt
   kreeg dan 200 herhaald:true over iets dat niet stond. Dat gold voor een
   sleutel van de client (de kop Idempotency-Key, `idem` of
   `idempotentieSleutel` in het lijf) EN voor een verklaarde route zonder
   sleutel: daar leidt de idem-poort er zelf een af (../lib/idemsleutels.js,
   venster van seconden). Sinds de herkeuring onthouden ze pas de status die
   werkelijk vertrok (../lib/eindstatus.js).

   EN IN POSTGRESQL-MODUS BETEKENT db.writable IETS ANDERS. Daar houdt het
   alleen save() tegen; de antwoordcommit in ../db/postgres-verzoeken.js kijkt
   naar write-health en niet naar db.writable, dus een save() van voor de
   afzetting werd daar gewoon gecommit en een save() erna viel om als
   PG_SAVE_ONTBREEKT. Omdat deze haak boven die grens hangt, ziet die grens een
   503 en commit hij niets: strenger dan nodig, nooit een stille 200. */
'use strict';

/* Koppen die over het OUDE lijf gaan. Een 503 met de Content-Encoding van een
   gecomprimeerd succesantwoord, of met de sessiecookie van een registratie die
   niet vaststaat, zou alsnog iets beloven. */
const OUDLIJF = ['content-encoding', 'content-length', 'content-range', 'content-disposition',
  'content-language', 'content-location', 'etag', 'last-modified', 'location', 'set-cookie',
  'transfer-encoding', 'accept-ranges'];
const TEKST = 'Deze server is tijdens het verzoek stand-by gezet. Of de wijziging is bewaard, ' +
  'staat daardoor niet vast. Kijk het na en probeer het over een paar seconden opnieuw.';

/* Een bron die in res pijpt (sendFile: een leesstroom op een bestand) blijft
   na de vervanging open: bij 'finish' koppelt hij los, maar hij sluit niet,
   en zijn bestandsdescriptor bleef staan (gemeten: 26 open na 30 vervangen
   verzoeken van 8 MB, ook na vijf seconden en een gc). Dus sluiten we hem. */
const sluit = (bron) => { if (bron && typeof bron.destroy === 'function') bron.destroy(); };

function bewaakAntwoord(res, db) {
  const echtEnd = res.end, echtWrite = res.write;
  const bronnen = new Set();
  let begonnen = false, vervangen = false;
  /* begonnen en niet alleen headersSent: de PostgreSQL-grens buffert de
     writes van een muterend verzoek tot zijn commit, en dan staan er al
     stukken klaar terwijl headersSent nog false is. */
  const moetWeg = () => !begonnen && !res.headersSent && !db.writable &&
    (res.statusCode || 200) < 400;
  if (typeof res.on === 'function') res.on('pipe', (bron) => { if (vervangen) sluit(bron); else bronnen.add(bron); });
  /* De vlag gaat pas om vlak voor het eigen end. Zou het omzetten van de
     koppen gooien (dat doet het alleen als ze al weg zijn, en moetWeg sluit
     dat uit), dan slikte een vroege vlag elke latere end() en hing het verzoek
     tot de time-out. Nu gaat dan het oorspronkelijke antwoord door: koppen die
     al weg zijn, waren toch niet meer te veranderen. */
  function vervang() {
    const oud = res.statusCode, oudBericht = res.statusMessage;
    try {
      for (const k of OUDLIJF) res.removeHeader(k);
      res.statusCode = 503;
      if (res.statusMessage) res.statusMessage = 'Service Unavailable';
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', '2');
    } catch (e) {
      res.statusCode = oud; res.statusMessage = oudBericht;
      require('../log').log.warn('[standbypoort] antwoord niet te vervangen (' + e.message + '); het gaat ongewijzigd door.');
      return false;
    }
    vervangen = true;
    echtEnd.call(res, JSON.stringify({ error: TEKST, code: 'STANDBY_TIJDENS_VERZOEK' }));
    for (const bron of bronnen) sluit(bron);
    bronnen.clear();
    return true;
  }
  // Na de vervanging slikken we de rest: een pipe schrijft gewoon door.
  res.write = function (...a) {
    if (vervangen) return true;
    if (moetWeg() && vervang()) return true;
    begonnen = true;
    return echtWrite.apply(res, a);
  };
  res.end = function (...a) {
    if (vervangen) return res;
    if (moetWeg() && vervang()) return res;
    return echtEnd.apply(res, a);
  };
}

module.exports = { bewaakAntwoord };
