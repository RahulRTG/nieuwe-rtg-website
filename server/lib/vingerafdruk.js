/* ============================================================================
   DE TOESTANDSVINGERAFDRUK -- van buiten zien DAT er iets veranderde, zonder te
   zien WAT er staat.

   WAAROM DIT ER IS. Zeven van de elf kolommen in de bewijsmatrix stonden leeg,
   en vier daarvan om exact dezelfde reden: ze gaan over de TOESTAND en niet over
   het antwoord. De idempotentieproef liep er als eerste hard op vast -- hij kon
   106 van de 2.936 routes beoordelen, en de andere 2.830 kregen "het antwoord
   verandert niet per oproep". Een route die stil een rij toevoegt zonder dat in
   zijn antwoord te tonen, is van buitenaf niet te beoordelen.

   Met een vingerafdruk vóór en ná een verzoek wordt dat wel meetbaar:

     STATE         veranderde er iets, en hoorde dat bij dit antwoord
     SIDE_EFFECT   veranderde er iets BUITEN de collectie van deze route
     ROLLBACK      na een geweigerd verzoek: is alles gelijk gebleven
     IDEMPOTENCY   beweegt de tweede oproep de toestand nog een keer

   WAT ERIN STAAT, EN WAT NADRUKKELIJK NIET. Per collectie een AANTAL en een
   HASH. Geen sleutels, geen waarden, geen namen uit de kluis, geen bedragen.
   Dat is geen beleefdheid maar de kern van het ontwerp: een meetinstrument dat
   gegevens meedraagt, is zelf een lek -- en dan heeft het instrument dat lekken
   moest vinden er een gemaakt.

   DE HASH IS GEZOUTEN MET EEN ZOUT DAT PER PROCES WORDT GETROKKEN. Daardoor is
   hij binnen één draaiende server te vergelijken (voor tegen na, en dat is
   precies waar hij voor bestaat) en daarbuiten nergens goed voor. Twee servers
   geven verschillende hashes over dezelfde data; een hash uit een logregel van
   vorige week zegt niets meer. Een ongezouten hash over een klein waardebereik
   -- een bedrag, een status, een ja/nee -- is namelijk gewoon terug te rekenen
   met een woordenboek, en dan draagt de vingerafdruk alsnog inhoud.

   DE HASH IS ORDE-ONGEVOELIG binnen een collectie: hij telt de rij-hashes bij
   elkaar op (XOR). Twee rijen omwisselen is geen wijziging, en dat hoort ook zo
   -- anders slaat elke sortering aan als een schrijfactie en meet je ruis.

   WAT HIJ NIET ZIET, en dat hoort er eerlijk bij:
   - een wijziging die zichzelf opheft binnen één verzoek (twee keer omgezet);
   - een effect buiten de database (een mail, een push, een betaling bij een
     derde). SIDE_EFFECT is hier dus "buiten de eigen collectie", niet "buiten
     het huis";
   - een collectie die boven de grens uitkomt: die geeft `h: null` met een reden
     in plaats van een verzonnen hash.
   ========================================================================== */
'use strict';
const crypto = require('crypto');

/* Het zout, één keer per proces. Niet uit een omgevingsvariabele en niet uit de
   database: een zout dat een herstart overleeft, maakt hashes vergelijkbaar
   over de tijd -- en dat is precies wat we niet willen. */
const ZOUT = crypto.randomBytes(16);

/* Boven deze grens hashen we een collectie niet meer rij voor rij. Een
   vingerafdruk die een halve seconde kost, wordt niet gebruikt; en een
   vingerafdruk die daarom stilletjes iets overslaat, liegt. Dus: een grens met
   een reden in de uitslag. */
const MAX_RIJEN = 20000;

function rijHash(waarde) {
  const h = crypto.createHash('sha256');
  h.update(ZOUT);
  try { h.update(JSON.stringify(waarde)); } catch (e) { h.update('<niet-serialiseerbaar>'); }
  return h.digest();
}

/* XOR van de rij-hashes: orde-ongevoelig, en gevoelig voor ELKE wijziging in
   een rij. Twee gelijke rijen heffen elkaar op -- dat is de bekende zwakte van
   XOR, en hier onschadelijk: als er twee identieke rijen bij komen verandert
   het AANTAL, en dat staat er los naast. */
function combineer(hashes) {
  const uit = Buffer.alloc(32);
  for (const h of hashes) for (let i = 0; i < 32; i++) uit[i] ^= h[i];
  return uit.toString('hex').slice(0, 16);
}

/* Een collectie is een array (rijen) of een object (sleutel-waardeparen). Voor
   een object telt elke sleutel als een rij, mét zijn sleutelnaam in de hash --
   anders is "de vlag van lid A" niet te onderscheiden van "de vlag van lid B". */
function vanCollectie(waarde, opties) {
  const detail = !!(opties && opties.detail);
  if (Array.isArray(waarde)) {
    if (waarde.length > MAX_RIJEN) return { n: waarde.length, h: null, reden: 'boven de rijgrens' };
    const hs = waarde.map(rijHash);
    return { n: waarde.length, h: combineer(hs), ...(detail ? { rijen: hs.map(x => x.toString('hex').slice(0, 12)) } : {}) };
  }
  if (waarde && typeof waarde === 'object') {
    const sleutels = Object.keys(waarde);
    if (sleutels.length > MAX_RIJEN) return { n: sleutels.length, h: null, reden: 'boven de rijgrens' };
    const hs = sleutels.map(k => rijHash([k, waarde[k]]));
    return { n: sleutels.length, h: combineer(hs), ...(detail ? { rijen: hs.map(x => x.toString('hex').slice(0, 12)) } : {}) };
  }
  // een losse waarde (getal, tekst, vlag): één "rij"
  return { n: waarde === undefined ? 0 : 1, h: combineer([rijHash(waarde)]) };
}

/* De vingerafdruk van de hele opslag. `detail` geeft per genoemde collectie ook
   de losse rij-hashes terug -- dat is duurder en alleen nodig als je wilt weten
   WELKE rij bewoog, niet DAT er een bewoog. */
function vingerafdruk(data, opties) {
  const detailVoor = new Set((opties && opties.detail) || []);
  const collecties = {};
  for (const naam of Object.keys(data || {}).sort()) {
    if (naam.startsWith('__')) continue;              // interne velden (__schema)
    collecties[naam] = vanCollectie(data[naam], { detail: detailVoor.has(naam) });
  }
  return { collecties, aantalCollecties: Object.keys(collecties).length, zoutId: ZOUT.toString('hex').slice(0, 8) };
}

/* WAT ER VERANDERDE tussen twee vingerafdrukken. Puur, en daarom los toetsbaar
   zonder server (test/vingerafdruk.test.js).

   Het teruggegeven verschil noemt COLLECTIENAMEN en getallen, nooit inhoud --
   dezelfde regel als de vingerafdruk zelf. */
function verschil(voor, na) {
  const a = (voor && voor.collecties) || {};
  const b = (na && na.collecties) || {};
  const namen = new Set([...Object.keys(a), ...Object.keys(b)]);
  const gewijzigd = [];
  let onmeetbaar = 0;
  for (const naam of [...namen].sort()) {
    const x = a[naam], y = b[naam];
    if (!x && !y) continue;
    /* EEN LEGE COLLECTIE DIE VERSCHIJNT IS GEEN WIJZIGING, en dat kostte een
       ronde. Bijna elke kern begint met `if (!db.data.x) db.data.x = []` -- de
       collectie ontstaat dus zodra iemand hem voor het EERST aanraakt, ook als
       het verzoek daarna met 404 wordt afgewezen. De staatproef meldde daardoor
       "geweigerd en toch veranderd" over routes die niets deden behalve een lege
       la opentrekken.

       Materialisatie is het aanmaken van de la, niet het leggen van iets erin.
       Zodra er wél iets in ligt (n > 0), telt hij gewoon mee. */
    if (!x) {
      if (y.n === 0) continue;
      gewijzigd.push({ collectie: naam, wat: 'nieuw', n: y.n });
      continue;
    }
    if (!y) {
      if (x.n === 0) continue;
      gewijzigd.push({ collectie: naam, wat: 'weg', n: x.n });
      continue;
    }
    /* Een collectie die te groot was om te hashen kan alleen op zijn AANTAL
       worden beoordeeld. Dat zeggen we, in plaats van "geen wijziging". */
    if (x.h === null || y.h === null) {
      onmeetbaar++;
      if (x.n !== y.n) gewijzigd.push({ collectie: naam, wat: 'aantal', van: x.n, naar: y.n });
      continue;
    }
    if (x.n !== y.n) { gewijzigd.push({ collectie: naam, wat: 'aantal', van: x.n, naar: y.n }); continue; }
    if (x.h !== y.h) gewijzigd.push({ collectie: naam, wat: 'inhoud', n: y.n });
  }
  return { gewijzigd, aantal: gewijzigd.length, onmeetbareCollecties: onmeetbaar,
    collecties: gewijzigd.map(g => g.collectie) };
}

const gelijk = (voor, na) => verschil(voor, na).aantal === 0;

module.exports = { vingerafdruk, verschil, gelijk, MAX_RIJEN };
