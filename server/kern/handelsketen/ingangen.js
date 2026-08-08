/* De handelsketen: de twee INGANGEN. Een aanvraag bij een heel genre, of een
   rechtstreekse bestelling bij een bekende zaak. Samen in een bestand, want ze
   delen alles behalve hun kop.

   WAAROM DIE ER MOET ZIJN

   Er zijn twee manieren waarop zaken bij elkaar kopen, en ze zijn echt
   verschillend:

   1. JE WEET NIET WIE, EN NIET VOOR HOEVEEL. Dan zet je een aanvraag uit bij een
      heel genre, vergelijk je de offertes en gun je er een. Dat is ../handelsketen.js.
   2. JE WEET HET ALLEBEI AL. Een vaste leverancier, een prijslijst, een
      contractprijs -- dan is een offerterondje een omweg langs iets wat vaststaat.

   Alleen de KOP verschilt. De STAART is identiek: inplannen, leveren met bewijs,
   factureren, betalen. Die staart hoort er dan ook maar een keer te zijn, en dat
   is precies wat deze ingang doet: een rechtstreekse bestelling landt in
   dezelfde handel, alleen meteen op "gegund". De afgesproken prijs staat als
   offerte van de leverancier zelf in het dossier, zodat de factuurcontrole
   verderop ("wijkt de factuur af van de afspraak?") woordelijk dezelfde is.

   DIT IS OOK HET ANTWOORD OP EEN PLAN DAT NIET KLOPTE. In PLATFORM.md stond dat
   de veertien oude aanvraagcollecties "op termijn" allemaal door deze keten
   vervangen worden. Bij het voorbereiden van de eerste migratie bleek dat niet
   te kloppen: bevAanvragen eindigt in een ROOSTER en heeft geen prijs of
   factuur, vakOffertes en reisAanvragen zijn lid-naar-zaak, en
   groothandelOrders draagt voorraadreservering en contractprijzen die deze
   keten niet heeft. Een migratie die functies kost is geen migratie. Wat ze wel
   delen is de staart -- en die kunnen ze nu krijgen zonder hun eigen kop op te
   geven. */
'use strict';

module.exports = (ctx) => {
  const { db, crypto, findSupplier, store, save, meld, scho, getal, nu, publiek, nieuweHandel, leesRegels } = ctx;


  /* ---------- ingang 1: een aanvraag uitzetten bij een heel genre ---------- */
  function nieuweAanvraag(s, body) {
    const genre = scho(body.genre, 40);
    if (!genre || !(db.data.supplierTypes || {})[genre])
      return { status: 400, error: 'Kies een geldig soort bedrijf.' };
    if (genre === s.type) return { status: 400, error: 'Een aanvraag aan uw eigen soort bedrijf zetten we niet uit.' };
    const titel = scho(body.titel, 80);
    if (!titel) return { status: 400, error: 'Geef kort aan wat u nodig heeft.' };
    const regels = leesRegels(body.regels);
    if (!regels.length) return { status: 400, error: 'Zet er minstens een regel in, met een aantal.' };

    const h = nieuweHandel(s, { genre, titel, regels,
      ophalen: scho(body.ophalen, 60), retour: scho(body.retour, 60) });
    store().push(h);
    save();
    // iedereen in het gevraagde genre krijgt hem te zien; de melding gaat mee
    for (const lev of db.data.suppliers || [])
      if (lev.type === genre && lev.code !== s.code)
        meld(h, lev.code, 'Nieuwe aanvraag', s.name + ' zoekt: ' + titel);
    save();
    return { handel: publiek(h, s) };
  }

  /* ---------- ingang 2: rechtstreeks bestellen ---------- */
  function bestellen(s, body) {
    const lev = findSupplier(String(body.leverancierCode || '').toUpperCase().trim());
    if (!lev) return { status: 404, error: 'Die zaak kennen we niet.' };
    if (lev.code === s.code) return { status: 400, error: 'Bij uzelf bestellen kan niet.' };
    const titel = scho(body.titel, 80);
    if (!titel) return { status: 400, error: 'Geef kort aan wat u bestelt.' };
    const regels = leesRegels(body.regels);
    if (!regels.length) return { status: 400, error: 'Zet er minstens een regel in, met een aantal.' };
    /* Zonder afgesproken bedrag is dit geen bestelling maar een aanvraag, en dan
       hoort de andere ingang erbij. Een bestelling op nul zou verderop een
       factuurcontrole opleveren die alles goedkeurt. */
    const prijs = getal(body.prijs, 1000000);
    if (prijs <= 0) return { status: 400, error: 'Noem het afgesproken bedrag.' };

    const h = nieuweHandel(s, { genre: lev.type, titel, regels,
      ophalen: scho(body.ophalen, 60), retour: scho(body.retour, 60) });
    const offerteId = 'o' + crypto.randomBytes(4).toString('hex');
    h.offertes.push({ id: offerteId, code: lev.code, naam: lev.name, prijs,
      opmerking: 'Rechtstreeks besteld, prijs vooraf afgesproken.', at: nu() });
    h.gegundAan = { code: lev.code, naam: lev.name, offerteId, prijs, at: nu() };
    h.status = 'gegund';
    h.bron = 'bestelling';
    store().push(h);
    save();
    meld(h, lev.code, 'Nieuwe bestelling',
      s.name + ' bestelt: ' + titel + ' (€ ' + prijs.toFixed(2) + ')');
    save();
    return { handel: publiek(h, s) };
  }

  return { nieuweAanvraag, bestellen };
};
