/* Aanmeldingen-deel "betaalschema" (kern/aanmeldingen): na het menselijke akkoord
   loopt de lidmaatschapsbetaling automatisch -- 12 maanden lang de maandbijdrage
   (uit het contract van het lid als de pas contractueel is, anders uit de
   prijslijst),
   met van elke termijn 30% naar de RTFoundation (20% lokaal, 10% de foundation
   zelf). Dit is een grootboek van geplande termijnen; er wordt nooit geclaimd dat
   een echte betaling is verwerkt -- een betaalprovider zou het schema uitvoeren.
   Draait op de gedeelde context die kern/aanmeldingen.js opbouwt. */
module.exports = (ctx) => {
  const { B, geldPasprijzen, rid, nu, eur, PASSEN } = ctx;
  const { maandCentenUit } = require('../pasprijs');

  /* De maandbijdrage van DEZE aanmelding in centen.

     Twee bronnen, in deze volgorde, en de volgorde is het punt:

     1. HET CONTRACT van het lid zelf. Business en Lifestyle staan niet in de
        prijslijst (kern/pasladder.js): hun bedrag is per klant afgesproken en
        vastgelegd bij het besluit. Dat bedrag wint dus altijd -- een lijstprijs
        die over een afspraak heen valt, is precies hoe een factuur een bedrag
        gaat noemen dat niemand heeft afgesproken.
     2. DE PRIJSLIJST uit de geld-regie, via ../pasprijs.js. Hier stond een eigen
        kopie met eigen terugvalwaarden; ledenregister.js had er nog een, en
        lid.js had er geen en verzon zijn eigen bedragen.

     Is er geen van beide, dan null: geen bedrag is een antwoord, nul zou
     "gratis" betekenen. */
  function maandCentenVan(a) {
    const c = a && a.contract && a.contract.maandCenten;
    if (Number.isFinite(c)) return c;
    return maandCentenUit(geldPasprijzen, a && a.pas);
  }
  // een maand erbij op een ISO-datum (voor het 12-maands-schema)
  function plusMaanden(iso, n) { const d = new Date(iso); d.setMonth(d.getMonth() + n); return d.toISOString(); }

  function startBetalingen(a) {
    const centen = maandCentenVan(a);
    const termijnen = [];
    for (let m = 1; m <= 12; m++) {
      const bedrag = centen; // null bij Business (op maat)
      termijnen.push({ id: rid(), aanmeldingId: a.id, pas: a.pas, naam: a.naam, maand: m,
        opMaat: centen == null,
        centen: bedrag, foundationCenten: bedrag == null ? null : Math.round(bedrag * 0.30),
        lokaalCenten: bedrag == null ? null : Math.round(bedrag * 0.20),
        rtfCenten: bedrag == null ? null : Math.round(bedrag * 0.10),
        vervalt: plusMaanden(a.besluit.at, m - 1), status: 'gepland', at: nu() });
    }
    const b = B();
    b.unshift({ aanmeldingId: a.id, pas: a.pas, naam: a.naam, gestart: nu(), termijnen });
    if (b.length > 5000) b.pop();
  }

  function betalingBeeld(rij) {
    return { aanmeldingId: rij.aanmeldingId, pas: rij.pas, pasNaam: (PASSEN[rij.pas] || {}).naam || rij.pas,
      naam: rij.naam, gestart: rij.gestart,
      termijnen: (rij.termijnen || []).map(t => ({ maand: t.maand, opMaat: !!t.opMaat, status: t.status,
        bedrag: t.centen == null ? null : eur(t.centen), foundation: t.foundationCenten == null ? null : eur(t.foundationCenten),
        lokaal: t.lokaalCenten == null ? null : eur(t.lokaalCenten), rtf: t.rtfCenten == null ? null : eur(t.rtfCenten),
        vervalt: t.vervalt })) };
  }

  /* Het overzicht van de lopende lidmaatschapsbetalingen (kantoor), met het
     totaal dat over 12 maanden naar de foundation stroomt. */
  function betalingen(filter) {
    filter = filter || {};
    let rijen = B();
    if (filter.aanmeldingId) rijen = rijen.filter(r => r.aanmeldingId === String(filter.aanmeldingId));
    const alleTermijnen = B().flatMap(r => r.termijnen || []);
    const som = veld => alleTermijnen.reduce((s, t) => s + (t[veld] || 0), 0);
    return { ok: true, aantalLeden: B().length,
      totaal: { jaaromzet: eur(som('centen')), foundation: eur(som('foundationCenten')),
        lokaal: eur(som('lokaalCenten')), rtf: eur(som('rtfCenten')) },
      lidmaatschappen: rijen.slice(0, 200).map(betalingBeeld) };
  }

  return { startBetalingen, betalingen };
};
