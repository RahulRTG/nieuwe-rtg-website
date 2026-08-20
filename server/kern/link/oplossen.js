/* RTG Link: HET OPLOSSEN PER TYPE -- van een geduide code naar het onderwerp
   erachter, en niets meer.

   Staat los van ./index.js omdat het een eigen onderwerp is: index.js is de
   VOLGORDE (duiden, remmen, oplossen, intenties), dit zijn de TAKKEN. Elke tak
   leent de deur die er al is en bouwt er geen na -- pin->handle staat in
   sociaal/pin.js, wat je van een gevonden mens ziet in sociaal/pin-deur.js, de
   capability in ./cap.js.

   HET ENE ANTWOORD VOOR ALLES WAT NIETS OPLEVERT staat hier ook, want dit is de
   plek waar de vier gevallen samenkomen die met opzet niet uit elkaar te houden
   zijn (LINK.md par. 3.1): de code hoort bij niemand, bij een beschermd profiel,
   bij iemand die jou blokkeerde, of bij iemand die zijn pin uit heeft staan. */
'use strict';

const rem = require('./rem');

module.exports = ({ handleVanPin, pinKijk, liveKijk, zaakVan, cap, isMens }) => {

const NIETS = { status: 404, error: 'Deze code kennen we niet (meer).' };
const niets = () => { rem.misserGeteld(); return { ...NIETS }; };

/* Het oplossen zelf, per type -- en elke tak leent de bestaande deur in plaats van
   er een te bouwen. */
async function onderwerpVan(g, wie, mij, zaakcode) {
  if (g.type === 'persoon') {
    if (!isMens(wie)) return { status: 403, error: 'Deze code hoort bij een mens; alleen een lid kan daar iets mee.' };
    // zelfde geval en zelfde antwoord als in eigenRem hierboven: een demo-pas
    // heeft geen handle, en zonder handle is er geen band om te tonen
    if (!mij) return { status: 403, error: 'Hier heb je een eigen ledenaccount voor nodig.' };
    if (g.vorm === 'levend') {
      /* De levende code draagt zijn eigen bewijs, dus geeft pin-live met opzet
         GEEN sleutel terug: het scherm hoeft niet te weten hoe iemand in de
         database heet. Zijn eigen rem per lid staat daar al omheen. */
      const r = liveKijk(mij, g.sleutel);
      if (r.error) return { status: r.status, error: r.error };
      return { onderwerp: { codename: r.codename, tier: r.tier, status: r.st }, band: r.st };
    }
    const kaart = pinKijk(mij, handleVanPin(g.sleutel));
    if (!kaart) return niets();
    return { onderwerp: { key: kaart.key, codename: kaart.codename, tier: kaart.tier, status: kaart.st },
      band: kaart.st };
  }
  if (g.type === 'plaats' || g.type === 'zaak') {
    const z = typeof zaakVan === 'function' ? zaakVan(g.sleutel) : null;
    if (!z) return niets();
    /* De naam komt uit ONS register en niet uit de code (LINK.md par. 3.3): wie
       een sticker overplakt met een eigen QR, ziet hier niet zijn eigen naam
       verschijnen maar die van de zaak waar de code echt bij hoort. */
    const onderwerp = { code: z.code || g.sleutel, naam: z.name || z.naam || null };
    if (g.type === 'plaats') onderwerp.plek = g.tafel || '';
    return { onderwerp, band: null };
  }
  if (g.type === 'capability') {
    /* KIJKEN mag iedereen met een sessie van ons -- een lid, en sinds de
       kassacode ook een zaak. Wat de scanner ermee KAN, zegt `mag`: dat komt uit
       de handeling zelf (wie hem mag aanvaarden) en uit zijn eigen rol, en het
       bepaalt of er een knop verschijnt. Zo staat er nooit een regel die de deur
       daarna weigert. */
    const r = cap.capKijk({ soort: wie, key: mij, code: zaakcode }, g.sleutel);
    if (r.error) return { status: r.status, error: r.error };
    if (r.eigen) return { status: 400, error: 'Dat is je eigen code.' };
    return { onderwerp: r.kaart, band: null, mag: r.mag };
  }
  if (g.type === 'betaalcode') {
    /* Niet opzoeken, met opzet. Of deze code geldig is en van wie hij is, weet de
       kassadeur (/api/supplier/pay/in) -- die int hem ook. Een tweede plek die
       hetzelfde nakijkt, is een orakel waarmee je codes kunt aftasten zonder ooit
       te innen. */
    return { onderwerp: { code: g.sleutel }, band: null };
  }
  return niets();
}
return { onderwerpVan, niets };
};
