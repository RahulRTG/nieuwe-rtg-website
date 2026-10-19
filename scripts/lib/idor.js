/* Het oordeel van de IDOR-proef, apart en puur -- los toetsbaar. IDOR staat
   voor Insecure Direct Object Reference: een ingelogde die met de JUISTE rol
   maar als de VERKEERDE persoon bij het object van een ander kan. De rolproef
   legt precies deze foutklasse buiten zijn grens ("twee leden met DEZELFDE
   rol"); dit is het instrument dat de grens oppakt.

   DE UITKOMSTEN, en de eerlijkheid zit in het onderscheid:

     gescheiden   B kreeg 401/403/404 op het object van A. Het huis zegt dat
                  het object niet van B is (of niet bestaat voor B). Dit is het
                  BEWIJS van scheiding waar de proef naar zoekt.
     doorbraak    B kreeg 2xx op een object dat uit A's antwoord kwam. Dat is
                  een BEVINDING, geen zekerheid: het object kan publiek zijn
                  (een productenlijst die iedereen mag zien). Elke doorbraak
                  hoort met de hand nagekeken -- is dit object echt van A? Een
                  proef die dat verzwijgt, meldt lekken die er niet zijn.
     onbereikbaar B kwam niet tot de eigenaarschapsvraag: een 400 (validatie
                  strandde eerder), of geen id van A om mee te proberen. Geen
                  uitspraak over scheiding.

   WAT DIT NIET IS: een bewering dat elke 2xx een lek is. De scherpte zit in de
   controle: alleen objecten die A ZELF terugkreeg, en een doorbraak is een
   vraag en geen vonnis. */
'use strict';

/* Boodschappen die verraden dat een weigering iets prijsgeeft (dezelfde
   familie als de rolproef, hier smal gehouden op het IDOR-geval: een naam of
   adres in een 403 zegt "het object bestaat en zo heet de eigenaar"). */
const VERRAADT = /("(naam|name|email|adres|address|iban|telefoon|phone)"\s*:\s*"[^"]+")/i;

function oordeelIdor(status, lijf) {
  const s = Number(status) || 0;
  if (s >= 200 && s < 300) {
    return { staat: 'doorbraak',
      reden: 'B kreeg ' + s + ' op een object uit A\'s antwoord; NAKIJKEN of dat object echt van A is ' +
        'of publiek (een 2xx op een gedeeld object is geen lek)' };
  }
  /* EEN DEUR DIE EEN TOESTEL VRAAGT, IS GEEN SCHEIDING (18 oktober 2026). Een
     zwaar pad (kern/identiteit/bezitsbewijs.js) weigert elk verzoek zonder
     een toestel dat zijn sleutel aantoont, met `bezitsbewijs: 'vereist'` in het
     antwoord -- ook als het object WEL van B was. Die 401/403 als "gescheiden"
     tellen is een geldige uitslag op het verkeerde experiment (BEWIJSMACHINE.md
     par. 6a): negen zware routes stonden zo als bewijs in IDOR.json zonder dat
     de eigenaarschapsvraag ooit was gesteld. */
  if ((s === 401 || s === 403) && /"bezitsbewijs"\s*:\s*"vereist"/.test(String(lijf || ''))) {
    return { staat: 'onbereikbaar',
      reden: 'B kreeg ' + s + ' aan de toesteldeur (bezitsbewijs vereist): de eigenaarschapsvraag is niet gesteld' };
  }
  if (s === 401 || s === 403 || s === 404) {
    const verraadt = VERRAADT.test(String(lijf || ''));
    return { staat: 'gescheiden',
      reden: 'B kreeg ' + s + ': het object is niet van B' + (verraadt ? ' -- maar de weigering LEKT een persoonsveld' : ''),
      lek: verraadt };
  }
  return { staat: 'onbereikbaar', reden: 'B kreeg ' + s + ': de eigenaarschapsvraag was niet aan de beurt' };
}

/* EEN IDEM-BOTSING IS GEEN EIGENDOMSBEWIJS (besluit 19 oktober 2026). De
   tegenpoging van de kruisproef (B stuurt hetzelfde lijf met een VERZONNEN id)
   mag niet dezelfde herhaalsleutel dragen als B's eerste poging: de idem-laag
   (server/middleware/idempotentie.js:140-150) geeft dan 409 IDEM_ANDER_VERZOEK
   -- zelfde sleutel, ander lijf -- en dat is een botsing met B's EIGEN eerste
   verzoek, geen weigering van het verzonnen id. Die 409 als doorbraak lezen
   zette tien geldapps ten onrechte op DEFECT (/api/wallet/munt/koop en familie).

   Twee regels, allebei puur:
   - verseHerhaalsleutel(lijf): elke poging krijgt een EIGEN sleutel, zodat de
     idem-laag niet meespreekt.
   - idemBotsing(status, lijf): herkent de 409 IDEM_ANDER_VERZOEK, die nooit als
     scheiding OF eigendom mag tellen. */
const IDEM_VELDEN = ['idem', 'idempotentieSleutel'];
let _teller = 0;
function verseHerhaalsleutel(lijf) {
  if (!lijf || typeof lijf !== 'object') return lijf;
  const uit = { ...lijf };
  for (const v of IDEM_VELDEN) {
    if (typeof uit[v] === 'string') uit[v] = 'idorproef-vers-' + (++_teller) + '-' + Math.random().toString(36).slice(2, 12);
  }
  return uit;
}
function idemBotsing(status, lijf) {
  if (Number(status) !== 409) return false;
  return /"code"\s*:\s*"IDEM_ANDER_VERZOEK"/.test(String(lijf || ''));
}

module.exports = { oordeelIdor, VERRAADT, IDEM_VELDEN, verseHerhaalsleutel, idemBotsing };
