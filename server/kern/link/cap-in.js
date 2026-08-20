/* RTG Link: DE DEUR VAN DE CAPABILITY -- kijken en aanvaarden.

   ./cap.js gaat over het bezit (de kluis, uitgeven, intrekken). Dit gaat over
   wie er aan mag komen en wat er dan gebeurt. Twee onderwerpen, twee bestanden,
   en de scheiding is niet willekeurig: hier staat alles wat een aanvaller raakt
   -- precies dezelfde knip als bij de contactpin (pin.js tegenover pin-deur.js).

   DE VOLGORDE IS DE WEG VAN LINK.md par. 2: kijken (en niets doen), een mens
   laat bevestigen, uitvoeren, bon. Kijken en aanvaarden zijn met opzet twee
   loketten -- een gescande code die meteen afrekent, rekent af zonder dat iemand
   het vroeg. */
'use strict';

const rem = require('./rem');

module.exports = ({ losOp, kaartVan, idVan, verbruik, handelingen, bonSchrijf, WEG }) => {

/* Van token naar een code die er nog TOE DOET, in een stap, zodat kijken en
   aanvaarden hem niet ieder op hun eigen manier uitrekenen.

   `nog` is de vraag aan het domein: leeft datgene waar deze code aan hangt nog?
   De kassacode heeft dat nodig -- RTG Pay houdt per lid maar EEN code actief, dus
   wie een verse maakt, maakt zijn vorige waardeloos terwijl het token ervan nog
   prima ondertekend is. Zonder deze vraag ziet een kassa een keurige kaart, tikt
   het bedrag in, en krijgt pas dan te horen dat er niets meer is.

   Dat het antwoord dan hetzelfde `WEG` is als bij een verlopen code, is geen
   luiheid: voor wie ervoor staat is het hetzelfde geval -- laat een verse code
   zien. */
function openen(token) {
  const r = losOp(token);
  if (r.fout) return r;
  const def = handelingen.haal(r.cap.handeling);
  if (!def) return { fout: 'weg' };
  if (typeof def.nog === 'function' && !def.nog(r.cap.opdracht)) return { fout: 'weg' };
  return { ...r, def };
}

function capKijk(kijker, token) {
  const r = openen(token);
  if (r.fout === 'geen-codelaag') return { status: 503, error: 'De codelaag draait hier niet.' };
  if (r.fout) { if (r.mis) rem.misserGeteld(); return { status: 404, error: WEG }; }
  return { status: 200, kaart: kaartVan(r.cap),
    eigen: !!(idVan(kijker) && idVan(kijker) === r.cap.uitgeverId),
    /* Mag DEZE kijker hem ook aanvaarden? Dat hangt aan zijn rol en aan de
       handeling die hij vasthoudt, en het scherm heeft het nodig om geen knop te
       tonen die straks geweigerd wordt. */
    mag: r.def.aanvaarder.includes(kijker && kijker.soort) };
}

/* En dan pas uitvoeren. De volgorde is de weg van LINK.md par. 2: controleren,
   laten bevestigen (dat gebeurde op het scherm, voordat dit loket werd geroepen),
   uitvoeren, bon.

   DE CODE GAAT PAS OP ALS HET GELUKT IS. Zou hij bij het begin opgaan, dan is een
   vraag met te weinig saldo een vraag die je niet nog een keer kunt beantwoorden.
   Tegen dubbel indrukken staat de idempotentiesleutel: het domein krijgt de
   verwijzing mee en kan er zijn eigen "dit heb ik al gedaan" op zetten. */
async function capAanvaard(aanvaarder, token, sessie, ruw) {
  const r = openen(token);
  if (r.fout === 'geen-codelaag') return { status: 503, error: 'De codelaag draait hier niet.' };
  if (r.fout) { if (r.mis) rem.misserGeteld(); return { status: 404, error: WEG }; }
  const def = r.def;
  if (!def.aanvaarder.includes(aanvaarder.soort)) return { status: 403, error: 'Deze code is niet voor u bedoeld.' };
  const wie = idVan(aanvaarder);
  if (!wie) return { status: 403, error: 'Deze sessie kan hier niets mee.' };
  if (wie === r.cap.uitgeverId) return { status: 400, error: 'Dat is je eigen code.' };

  /* WAT DE AANVAARDER ZELF INVULT. Niet elke handeling heeft dat -- bij "betaal
     mij 18,50" ligt alles vast -- maar de kassacode is een BEGRENSDE opdracht:
     het lid geeft een maximum af en de kassa vult het werkelijke bedrag in. Dat
     is de reikwijdte uit LINK.md par. 0, en het keuren ervan hoort bij het
     domein: alleen dat weet wat "binnen het maximum" betekent. */
  let invoer = null;
  if (typeof def.neem === 'function') {
    invoer = def.neem(ruw, r.cap.opdracht);
    if (!invoer || invoer.error) return invoer || { status: 400, error: 'Deze invoer kan niet.' };
  }
  const kaart = kaartVan(r.cap);
  const uit = await def.doe({ opdracht: r.cap.opdracht, invoer, uitgeverKey: r.cap.uitgeverKey,
    aanvaarder, sessie, idem: 'cap:' + r.verwijzing });
  if (!uit || uit.error) return uit || { status: 500, error: 'De handeling gaf geen antwoord.' };
  if (def.eenmalig) verbruik(r.verwijzing);

  /* Twee bonnen, en dat is hier geen dubbeling. De aanvaarder deed iets (hij
     bevestigde); de uitgever zag zijn code gebruikt worden -- en dat tweede is
     precies het signaal waarmee hij merkt dat er een code van hem rondgaat.
     Dezelfde gedachte als de herkomst bij een verzoek via de contactpin. */
  bonSchrijf({ wie, type: 'capability', intentie: r.cap.handeling,
    vorm: 'levend', naar: r.cap.uitgeverId });
  bonSchrijf({ wie: r.cap.uitgeverId, type: 'capability', intentie: r.cap.handeling + '.gebruikt',
    vorm: 'levend', naar: wie });
  return { status: 200, ok: true, kaart, uitkomst: uit };
}

return { capKijk, capAanvaard };
};
