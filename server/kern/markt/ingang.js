/* De Marktplaats (deelbestand): DE INGANGSCONTROLE.

   Twee van de vier pijlers uit de kop van ../markt.js komen hier samen, en ze
   doen iets anders dan de rest van die motor. Plaatsen, zoeken en chatten gaan
   over wat een advertentie IS; dit gaat over wat er NIET in mag en waar een
   koper voor gewaarschuwd hoort te worden.

   HET VERSCHIL TUSSEN WEIGEREN EN WAARSCHUWEN, en dat is de hele reden dat deze
   twee functies naast elkaar staan:

     keurTekst      een NEE. Verboden waren (wapens, drugs, namaak, dieren,
                    leeftijdsgebonden waar) en kwetsende taal komen er niet in.
                    De advertentie bestaat niet.
     scanVeiligheid een WAARSCHUWING. Betalen vooraf, contact buiten de app, een
                    prijs die te mooi is om waar te zijn. De advertentie mag er
                    staan, met de reden erbij, want dit zijn signalen en geen
                    bewijzen -- een tweedehands fiets kan echt goedkoop zijn.

   Die twee door elkaar halen kost het allebei: weigeren op een signaal maakt de
   markt onbruikbaar, en waarschuwen bij verboden waar laat hem staan.

   De woordenlijsten zelf staan in ./regels.js, als pure data. Hier staat wat
   ermee gebeurt. */
'use strict';

const { RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN, RICHTPRIJS, STAAT_FACTOR } = require('./regels');

/* Een NEE, met de reden uit de lijst. De reden reist mee zodat het scherm kan
   zeggen WAAROM iets niet mag; "dit mag niet" zonder grond laat iemand het
   twintig keer opnieuw proberen met andere woorden. */
function keurTekst(titel, beschrijving) {
  const t = (titel + ' ' + beschrijving).toLowerCase();
  for (const v of VERBODEN) if (v.rx.test(t)) return { ok: false, code: 'verboden', waarom: v.waarom };
  if (RESPECTLOOS.test(t)) return { ok: false, code: 'respect' };
  return { ok: true };
}

/* Oplichting-signalen; geeft een lijst redenen en of de advertentie gemarkeerd
   moet worden. Elke reden is geschreven om aan een MENS te tonen, niet als
   code: wie hier iets bijzet, schrijft de zin die de koper straks leest. */
function scanVeiligheid(ad) {
  const tekst = (ad.titel + ' ' + ad.beschrijving);
  const redenen = [];
  if (SCAM_WOORDEN.test(tekst)) redenen.push('Er wordt om een betaling vooraf of buiten de app gevraagd. Betaal nooit vooruit aan iemand die je niet kent.');
  if (CONTACT_BUITEN.test(ad.beschrijving)) redenen.push('Er staan contactgegevens of een link in de tekst. Houd het gesprek in de app; zo blijf je beschermd.');
  const richt = (RICHTPRIJS[ad.categorie] || 20) * (STAAT_FACTOR[ad.staat] || 1);
  if (ad.prijs > 0 && ad.prijs < richt * 0.2) redenen.push('De prijs is opvallend laag voor deze categorie. Een te mooi aanbod is vaak niet echt; kijk goed uit.');
  return { gemarkeerd: redenen.length > 0, redenen };
}

module.exports = { keurTekst, scanVeiligheid };
