/* Aanmeldingen-deel "betaalschema" (kern/aanmeldingen): na het menselijke akkoord
   loopt de lidmaatschapsbetaling automatisch -- de maandbijdrage uit het contract
   van het lid,
   met van elke termijn 30% naar de RTFoundation (20% lokaal, 10% de foundation
   zelf). Dit is een grootboek van geplande termijnen; er wordt nooit geclaimd dat
   een echte betaling is verwerkt -- een betaalprovider zou het schema uitvoeren.
   Draait op de gedeelde context die kern/aanmeldingen.js opbouwt. */
module.exports = (ctx) => {
  const { B, geldPasprijzen, rid, nu, eur, PASSEN, db, save } = ctx;
  const { maandCentenUit } = require('../pasprijs');
  const contracten = require('../commercie/contract').maakContracten({ db, save, nu });
  const allocatie = require('../commercie/allocatie');

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

  /* HET SCHEMA KOMT UIT HET CONTRACT, niet uit "maak er twaalf".

     Hier stond een lus van 1 tot en met 12. Dat leverde precies twaalf
     termijnen op en daarna niets: geen maand 13, geen verlenging, geen
     opzegging. Nu wordt er een CONTRACT geopend (../commercie/contract.js) en
     vraagt het schema welke termijnen daaruit voortvloeien tot het einde van de
     minimumtermijn. Bij een verse aanmelding zijn dat er nog steeds twaalf --
     maar nu omdat de verbintenis twaalf maanden duurt, en niet omdat het getal
     twaalf in een lus staat. Wordt het contract verlengd, dan komen de volgende
     termijnen er vanzelf bij; wordt het opgezegd, dan houdt het op.

     De prijs is een MOMENTOPNAME op het contract. Een latere wijziging in de
     boardroom raakt dit lidmaatschap niet meer -- besluit van 20 augustus 2026
     (COMMERCIE.md 3b). */
  function startBetalingen(a) {
    const centen = maandCentenVan(a);
    const c = contracten.open({
      pas: a.pas, aanmeldingId: a.id, naam: a.naam,
      startAt: a.besluit.at,
      afgesprokenCenten: centen,
      minimumMaanden: 12, frequentie: 'maand',
      door: (a.besluit || {}).door || null
    });
    contracten.bied(c);
    contracten.accepteer(c, centen);
    const actief = contracten.activeer(c);

    /* Geen bedrag? Dan blijft het contract op GEACCEPTEERD staan en komen er
       geen termijnen. Dat kan alleen bij een pas zonder lijstprijs waarvoor
       niets is afgesproken -- en dat weigert het besluit al. Blijft het toch
       gebeuren, dan is een leeg schema het eerlijke antwoord, geen rij met
       twaalf lege bedragen. */
    const termijnen = actief.error ? [] : vertaal(a, c);
    const b = B();
    b.unshift({ aanmeldingId: a.id, contractId: c.id, pas: a.pas, naam: a.naam,
      gestart: nu(), termijnen });
    if (b.length > 5000) b.pop();
    return c;
  }

  /* De termijnen van dit contract tot het einde van de huidige verbintenis, in
     de vorm die de rest van het huis kent (met de 30%-split erbij). */
  function vertaal(a, c) {
    return contracten.termijnenTussen(c, c.startAt, contracten.eindeVerbintenis(c))
      .map(t => ({ id: rid(), aanmeldingId: a.id, contractId: c.id, pas: a.pas, naam: a.naam,
        maand: t.termijn, periode: t.periode, opMaat: false,
        centen: t.centen,
        ...socialeSplit(t.centen),
        vervalt: t.vervalt, status: 'gepland', at: nu() }));
  }

  /* De 30%-split komt uit de REGEL en niet uit drie losse getallen. Hier stond
     `* 0.30`, `* 0.20` en `* 0.10` op vier plekken in dit bestand -- en die
     percentages stonden nergens onderbouwd behalve in GAMEHALL.md par. 12.5,
     over de spelwereld (PRIJZEN.md 4.8). Nu draagt elke termijn ook de
     regelversie, zodat een latere wijziging het verleden niet herschrijft. */
  function socialeSplit(centen) {
    const v = allocatie.verdeel(centen);
    const deel = id => (v.delen.find(d => d.id === id) || {}).centen || 0;
    return {
      foundationCenten: v.totaalCenten,
      lokaalCenten: deel('lokaal'),
      rtfCenten: deel('foundation'),
      socialeRegel: v.regelVersie
    };
  }

  /* VERLENGEN: hier ontstaat maand 13. De volgende periode wordt uitgerekend uit
     het contract en achter de bestaande termijnen geplakt -- de oude blijven
     staan, want die zijn gebeurd. */
  function verlengLidmaatschap(aanmeldingId, nieuwEuro) {
    const rijtje = B().find(r => r.aanmeldingId === String(aanmeldingId || ''));
    if (!rijtje || !rijtje.contractId) return { status: 404, error: 'Voor dit lidmaatschap loopt geen contract.' };
    const c = contracten.vind(rijtje.contractId);
    if (!c) return { status: 404, error: 'Dit contract bestaat niet meer.' };
    const voor = contracten.eindeVerbintenis(c);
    const r = contracten.verleng(c, Number.isFinite(Number(nieuwEuro)) ? Math.round(Number(nieuwEuro) * 100) : undefined);
    if (r.error) return { status: 400, error: r.error };
    const extra = contracten.termijnenTussen(c, voor, contracten.eindeVerbintenis(c))
      .map(t => ({ id: rid(), aanmeldingId: rijtje.aanmeldingId, contractId: c.id, pas: rijtje.pas,
        naam: rijtje.naam, maand: t.termijn, periode: t.periode, opMaat: false, centen: t.centen,
        ...socialeSplit(t.centen), vervalt: t.vervalt, status: 'gepland', at: nu() }));
    rijtje.termijnen = rijtje.termijnen.concat(extra);
    save();
    return { ok: true, contract: contracten.publiek(c), erbij: extra.length };
  }

  /* OPZEGGEN: de termijnen na de einddatum vervallen. Ze worden verwijderd en
     niet op 'vervallen' gezet -- een geplande termijn die nooit komt, is geen
     termijn met een andere status maar een termijn die er niet is. */
  function zegOpLidmaatschap(aanmeldingId) {
    const rijtje = B().find(r => r.aanmeldingId === String(aanmeldingId || ''));
    if (!rijtje || !rijtje.contractId) return { status: 404, error: 'Voor dit lidmaatschap loopt geen contract.' };
    const c = contracten.vind(rijtje.contractId);
    if (!c) return { status: 404, error: 'Dit contract bestaat niet meer.' };
    const r = contracten.zegOp(c);
    if (r.error) return { status: 400, error: r.error };
    const voor = rijtje.termijnen.length;
    rijtje.termijnen = rijtje.termijnen.filter(t => new Date(t.vervalt) < new Date(c.eindigtOp));
    save();
    return { ok: true, contract: contracten.publiek(c), eindigtOp: c.eindigtOp,
      vervallen: voor - rijtje.termijnen.length };
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

  return { startBetalingen, betalingen, verlengLidmaatschap, zegOpLidmaatschap, contracten };
};
