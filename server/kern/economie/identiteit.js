/* Economic Control Plane: identiteiten die een EIGEN wereld zijn.

   DE AANLEIDING IS EEN ECHTE FOUT DIE OP HET PUNT STOND TE GEBEUREN. De
   RTFoundation krijgt een wallet zoals een leverancier er een heeft -- dat is
   het besluit van de eigenaar, en het is een goed besluit, want er komt geen
   tweede betaalweg bij. Maar een leverancierswallet is in deze laag een
   `zaak:<code>`, en ./werelden.js leidt de wereld af uit de DRAGERSOORT: zaak
   hoort bij `commercieel`. De stichting zou dus in de Commercial Economy
   landen -- een wereld die WEL factureert -- terwijl ECONOMIE.md vastlegt dat
   zij een eigen rechtspersoon met een eigen vermogen is en dat de firewall
   ertussen standaard weigert.

   Niemand zou dat gemerkt hebben. De firewall had gewoon `ok` gezegd, want een
   commerciele klant mag een rekening krijgen. Precies de vorm waar dit huis
   eerder een prijs voor betaalde: een grens die groen kijkt omdat hij de
   verkeerde vraag stelt.

   DE REGEL DIE DIT OPLOST STAAT AL IN ECONOMIE.md: de wereld is een eigenschap
   van de IDENTITEIT en niet van de transactie. Dit register is die eigenschap.
   Het is standaard LEEG -- net als het relatieregister -- en elke regel draagt
   een grond en een naam.

   DRIE GRENDELS:

   1. ALLEEN NAAR EEN WERELD DIE NIET FACTUREERT. Dat is de hele reden dat dit
      register bestaat: "deze identiteit is een entiteit van zichzelf, geen
      klant". De andere richting -- iets in een factureerbare wereld zetten --
      is precies hoe je een gezin een rekening zou sturen, en die kant gaat
      hier dus dicht. Een grens die beide kanten op werkt, is geen grens.

   2. EEN GROND IS VERPLICHT, en hij wordt bewaard. Zonder grond is dit een
      lijstje uitzonderingen, en dan weet over een jaar niemand meer waarom een
      zaakcode niet meetelt in de commerciele omzet.

   3. DIT VERPLAATST GEEN GELD EN GEEN KOSTEN. Het zegt alleen in welke wereld
      een identiteit woont. Wat er dan wel of niet gefactureerd mag worden,
      blijft het oordeel van ./firewall.js. */
'use strict';

const { wereld, factureerbaar, wereldVan } = require('./werelden');

module.exports = (ctx) => {
  const { d, save, nu } = ctx;

  const R = () => {
    const s = d();
    if (!s.identiteiten || typeof s.identiteiten !== 'object') s.identiteiten = {};
    return s.identiteiten;
  };

  const sleutel = x => String(x || '').trim().slice(0, 140);

  /* De vervanger van werelden.wereldVan. Geen regel in het register betekent:
     de gewone afleiding uit de dragersoort. */
  function wereldVanDrager(drager) {
    const r = R()[sleutel(drager)];
    return (r && r.wereld) || wereldVan(drager);
  }

  function zet({ drager, wereld: naar, grond, door }) {
    const k = sleutel(drager);
    if (!k || k.indexOf(':') < 1) {
      return { status: 400, error: 'Welke identiteit? Een drager ziet eruit als soort:code, bijvoorbeeld zaak:RTF-1234.' };
    }
    const w = wereld(naar);
    if (!w) return { status: 400, error: 'Die economische wereld bestaat niet.' };
    if (factureerbaar(w.id)) {
      /* GRENDEL 1, en de weigering zegt hoe het wel kan -- zoals elke weigering
         in deze laag. */
      return { status: 409,
        error: 'Een identiteit kan hier alleen naar een wereld die haar gebruikers geen rekeningen stuurt. ' +
          w.naam + ' factureert wel, en dan is dit geen eigen entiteit maar een klant. Wilt u dat er tussen ' +
          'twee werelden geld stroomt, leg dan een relatie vast met een grondslag en een plafond.' };
    }
    const g = String(grond || '').trim().slice(0, 300);
    if (g.length < 5) return { status: 400, error: 'Waarom hoort deze identiteit in een eigen wereld? Zonder grond is dit een uitzondering zonder uitleg.' };
    const eerder = R()[k] || null;
    R()[k] = { drager: k, wereld: w.id, grond: g,
      door: String(door || 'boardroom').slice(0, 60), op: nu() };
    save();
    return { ok: true, identiteit: R()[k], eerder };
  }

  function weg(drager, door) {
    const k = sleutel(drager);
    const r = R()[k];
    if (!r) return { status: 404, error: 'Deze identiteit staat niet in het register.' };
    delete R()[k];
    save();
    return { ok: true, weg: r, door: String(door || 'boardroom').slice(0, 60),
      /* Wat er NA het weghalen geldt, en niet "gelukt": de identiteit valt terug
         op de afleiding uit haar dragersoort, en die kan wel factureren. */
      valtTerugOp: wereldVan(k) };
  }

  const alle = () => Object.values(R());

  return { wereldVanDrager, zet, weg, alle };
};
