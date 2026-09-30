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

module.exports = ({ lees, bak, kaartVan, idVan, handelingen, bonSchrijf, WEG }) => {

/* Van token naar een code die er nog TOE DOET, in een stap, zodat kijken en
   aanvaarden hem niet ieder op hun eigen manier uitrekenen.

   `nog` is de vraag aan het domein: leeft datgene waar deze code aan hangt nog?
   De kassacode heeft dat nodig -- RTG Pay houdt per lid maar EEN code actief, dus
   wie een verse maakt, maakt zijn vorige waardeloos terwijl het token ervan nog
   prima ondertekend is. Dat het antwoord dan hetzelfde `WEG` is als bij een
   verlopen code, is geen luiheid: voor wie ervoor staat is het hetzelfde geval. */
async function openen(token) {
  const t = lees(token);
  if (t.fout) return t;
  const h = await bak.haal(t.code);
  if (!h) return { fout: 'weg', code: t.code };
  const def = handelingen.haal(h.handeling);
  if (!def) return { fout: 'weg' };
  if (typeof def.nog === 'function' && !def.nog(h.opdracht)) return { fout: 'weg' };
  return { code: t.code, cap: h, def };
}
const weg = (r) => {
  if (r.fout === 'geen-codelaag') return { status: 503, error: 'De codelaag draait hier niet.' };
  if (r.mis) rem.misserGeteld();
  return { status: 404, error: WEG };
};

async function capKijk(kijker, token) {
  const r = await openen(token);
  if (r.fout) return weg(r);
  return { status: 200, kaart: kaartVan(r.cap),
    eigen: !!(idVan(kijker) && idVan(kijker) === r.cap.uitgeverId),
    /* Mag DEZE kijker hem ook aanvaarden? Dat hangt aan zijn rol en aan de
       handeling, en het scherm heeft het nodig om geen knop te tonen die straks
       geweigerd wordt. */
    mag: r.def.aanvaarder.includes(kijker && kijker.soort) };
}

/* En dan pas uitvoeren. De volgorde is de weg van LINK.md par. 2: controleren,
   laten bevestigen (op het scherm, voordat dit loket werd geroepen), uitvoeren,
   bon.

   DE CLAIM IS EENMALIG EN ATOMAIR (./cap-bak.js): in EEN collectietransactie gaat
   de code van open naar geclaimd, op naam van deze aanvaarder. Een tweede
   aanvaarder -- op deze instance of een andere -- krijgt `WEG`. Weigert het
   domein (4xx, bijvoorbeeld te weinig saldo), dan gaat de code TERUG: een vraag
   die je niet nog een keer kunt beantwoorden is erger dan een herhaling. Een
   crash laat de claim staan; dezelfde aanvaarder maakt hem na de lease af, met
   de invoer die bij de claim bevroren werd en dezelfde idempotentiesleutel. */
async function capAanvaard(aanvaarder, token, sessie, ruw) {
  const wie = idVan(aanvaarder);
  const r = await openen(token);
  let invoer = null, geclaimd;
  if (r.fout && !(r.code && wie)) return weg(r);
  if (r.fout) {
    geclaimd = await bak.claim(r.code, { door: wie, alleenHervat: true });
  } else {
    const def = r.def;
    if (!def.aanvaarder.includes(aanvaarder.soort)) return { status: 403, error: 'Deze code is niet voor u bedoeld.' };
    if (!wie) return { status: 403, error: 'Deze sessie kan hier niets mee.' };
    if (wie === r.cap.uitgeverId) return { status: 400, error: 'Dat is je eigen code.' };
    /* WAT DE AANVAARDER ZELF INVULT -- bij de kassacode het werkelijke bedrag
       binnen het maximum van het lid. Keuren doet het domein. */
    if (typeof def.neem === 'function') {
      invoer = def.neem(ruw, r.cap.opdracht);
      if (!invoer || invoer.error) return invoer || { status: 400, error: 'Deze invoer kan niet.' };
    }
    geclaimd = await bak.claim(r.code, { door: wie, invoer });
  }
  if (geclaimd.fout === 'bezig') return { status: 409, code: 'CAPABILITY_BEZIG',
    error: 'Deze code wordt nog verwerkt. Probeer het zo opnieuw.' };
  if (geclaimd.fout === 'eigen') return { status: 400, error: 'Dat is je eigen code.' };
  if (geclaimd.fout) return weg({});
  const def = handelingen.haal(geclaimd.handeling);
  if (!def || !def.aanvaarder.includes(aanvaarder.soort)) return { status: 403, error: 'Deze code is niet voor u bedoeld.' };
  const uit = await def.doe({ opdracht: geclaimd.opdracht, invoer: geclaimd.invoer, uitgeverKey: geclaimd.uitgeverKey,
    aanvaarder, sessie, idem: 'cap:' + geclaimd.id });
  if (!uit || uit.error) {
    if (uit && Number(uit.status) >= 400 && Number(uit.status) < 500) await bak.teruggeven(geclaimd);
    return uit || { status: 500, error: 'De handeling gaf geen antwoord.' };
  }
  await bak.afronden(geclaimd, def.eenmalig);

  /* Twee bonnen, en dat is hier geen dubbeling. De aanvaarder deed iets (hij
     bevestigde); de uitgever zag zijn code gebruikt worden -- en dat tweede is
     precies het signaal waarmee hij merkt dat er een code van hem rondgaat. */
  bonSchrijf({ wie, type: 'capability', intentie: geclaimd.handeling,
    vorm: 'levend', naar: geclaimd.uitgeverId });
  bonSchrijf({ wie: geclaimd.uitgeverId, type: 'capability', intentie: geclaimd.handeling + '.gebruikt',
    vorm: 'levend', naar: wie });
  return { status: 200, ok: true, kaart: kaartVan(geclaimd), uitkomst: uit };
}

return { capKijk, capAanvaard };
};
