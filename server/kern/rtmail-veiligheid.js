/* Cryptografisch integriteitszegel voor ieder nieuw RTMAIL-bericht.

   De database-opslag is in productie al AES-256-GCM versleuteld. Dit zegel
   beantwoordt een andere vraag: is precies DIT bericht sinds de bezorging nog
   hetzelfde? Afzender, ontvanger, onderwerp, inhoud, herkomst, tijd en draad
   gaan in een HMAC met de RTG-sessiesleutel. Die sleutel staat in productie
   buiten de datamap; iemand met alleen een databasekopie kan dus geen geldige
   gewijzigde post maken.

   Oude berichten hebben geen zegel en heten expliciet `legacy`. Ze worden niet
   achteraf gezegeld: dan zouden we de huidige bytes ten onrechte als de
   oorspronkelijke waarheid bekrachtigen. */
'use strict';

module.exports = ({ crypto, sleutel }) => {
  const key = Buffer.isBuffer(sleutel) && sleutel.length >= 32 ? sleutel : null;
  const canon = m => JSON.stringify([
    'rtmail-zegel-v1', String(m.id || ''), String(m.van || ''), String(m.naar || ''),
    String(m.onderwerp || ''), String(m.tekst || ''), String(m.soort || ''),
    String(m.bron || ''), String(m.at || ''), String(m.draad || m.id || ''),
    String(m.antwoordOp || '')
  ]);
  const bereken = m => key ? crypto.createHmac('sha256', key).update(canon(m)).digest('base64url') : null;
  function zegel(m) {
    const waarde = bereken(m);
    if (waarde) m.integriteitsZegel = { versie:1, algoritme:'HMAC-SHA-256', waarde };
    return m;
  }
  function controleer(m) {
    const z = m && m.integriteitsZegel;
    if (!z || z.versie !== 1 || !z.waarde) return 'legacy';
    const verwacht = bereken(m);
    if (!verwacht) return 'oncontroleerbaar';
    const a = Buffer.from(String(z.waarde)), b = Buffer.from(verwacht);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'ongeschonden' : 'gewijzigd';
  }
  function publiek(m) {
    const integriteit = controleer(m);
    const z = m && m.integriteitsZegel;
    const extern = (m && m.bron) === 'extern';
    return {
      integriteit,
      inhoudGeblokkeerd:integriteit === 'gewijzigd',
      identiteit:extern ? 'extern-ongeverifieerd' : ((m && m.vertrouwd) ? 'rtg-geverifieerd' : 'onbekend'),
      links:extern ? 'geblokkeerd' : 'platte-tekst-controle',
      bijlagen:'scanner-verplicht',
      zegel:z && z.algoritme || null
    };
  }
  return { zegel, controleer, publiek };
};
