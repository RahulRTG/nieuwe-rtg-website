/* OPZEGGEN DOOR HET LID ZELF.

   Afgesplitst van ./lidabonnement.js, dat LEEST en TOONT; dit bestand verandert
   een verbintenis. De naad lag er toch al en de keuring dwong hem af bij 11,7 kB.

   GEEN TWEEDE OPZEGKNOP. Het werk gebeurt in ./betaalschema.js
   (`zegOpLidmaatschap`), precies dezelfde functie die het kantoor aanroept. Hier
   staat alleen WIE hem mag aanroepen en WAT het lid daarbij te zien krijgt. Een
   eigen opzeglus ernaast zou een tweede waarheid zijn over of een lidmaatschap
   nog loopt (LAT regel 4).

   EN ER IS GEEN DARK PATTERN. CLAUDE.md verbiedt kunstmatige urgentie, en
   GRAMMATICA.md zegt dat twintig "weet u het zeker?"-vragen mensen leren op ja te
   drukken. Dus: EEN bevestiging, en het antwoord zegt wat er BLIJFT en niet alleen
   wat er weggaat -- tot wanneer de toegang loopt, hoeveel termijnen er nog vallen,
   en dat de facturen blijven. Vooraf kan het lid precies hetzelfde lezen zonder
   iets in gang te zetten (`opzegVoorbeeld`): een opzegging waarvan je de gevolgen
   pas NA de klik ziet, is zelf een dark pattern.

   EEN OPZEGGING TERUGDRAAIEN KAN NIET, en dat is een grens en geen gat. De
   standentabel in ../commercie/contract/vorm.js laat vanuit OPZEGGEND alleen
   GEEINDIGD toe, en `zegOpLidmaatschap` VERWIJDERT de termijnen na de einddatum
   in plaats van ze op 'vervallen' te zetten. Terugdraaien is dus geen schakelaar
   maar twee besluiten (een overgang toevoegen, en de termijnen opnieuw opwekken).
   Dat hoort een eigen stap te zijn; zie AFSPRAAK.md par. 14. Tot dan zegt het
   antwoord eerlijk dat terugkomen een nieuwe afspraak is. */
'use strict';

module.exports = ({ contracten, zegOpLidmaatschap, lezer }) => {
  const { aanmeldingVan, contractVan, komende, beeld, datum } = lezer;

  /* WAT OPZEGGEN GAAT DOEN, ZONDER DAT HET GEBEURT.

     Dit is de helft die de kantoorroute niet had en die een lid juist nodig
     heeft. De einddatum komt uit `contracten.opzegEinde` -- dezelfde functie die
     `zegOp` straks gebruikt -- dus wat het lid vooraf leest is per definitie wat
     hij krijgt. Hier wordt niets overgetypt.

     EN HIJ SCHRIJFT NIETS. Dat stond hier eerst anders: de datum kwam uit een
     PROEF, een `zegOp` op een wegwerpkopie van het contract. Dat leek veilig en
     was het niet -- `zet()` in ../commercie/contract.js roept `save()` aan, dus
     een voorbeeld dat niets verandert schreef wel de hele database naar schijf,
     met elke andere mutatie die op dat moment nog in het geheugen stond. Het
     kwam aan het licht bij het INDELEN van deze route (MUTATIECONTRACT.md eist
     voor `NOT_APPLICABLE` bewijs dat er niets verandert) en niet bij het
     schrijven ervan. */
  function opzegVoorbeeld(accountId) {
    const a = aanmeldingVan(accountId);
    if (!a) return { status: 404, error: 'Er is voor dit account geen lidmaatschapsafspraak vastgelegd.' };
    const c = contractVan(a.id);
    if (!c) return { status: 404, error: 'Er staat geen contract bij deze aanmelding.' };
    if (!contracten.LOPEND.has(c.status))
      return { status: 409, error: 'Dit lidmaatschap loopt niet meer; er is niets op te zeggen.' };
    if (c.status === contracten.STATUS.OPZEGGEND)
      return { ok: true, alOpgezegd: true, eindigtOp: c.eindigtOp,
        eindigtOpTekst: datum(c.eindigtOp) };

    const eind = contracten.opzegEinde(c);
    if (!eind) return { status: 400, error: 'De einddatum is niet te bepalen.' };

    const weg = komende(a.id).filter(t => new Date(t.vervalt) >= new Date(eind));
    const blijft = komende(a.id).filter(t => new Date(t.vervalt) < new Date(eind));
    return { ok: true, alOpgezegd: false,
      eindigtOp: eind, eindigtOpTekst: datum(eind),
      opzegMaanden: c.opzegMaanden,
      nogTeBetalen: blijft.length,
      nogTeBetalenBedrag: blijft.reduce((s, t) => s + (t.centen || 0), 0) / 100,
      vervallenTermijnen: weg.length,
      /* WAT ER BLIJFT. Dit staat er even groot bij als wat er weggaat, en niet
         uit vriendelijkheid: rechten na een opzegging hangen per onderdeel en
         nooit per account (AFSPRAAK.md grens 6). Facturen en bewijsstukken zijn
         precies het soort ding dat iemand NA het vertrek nodig heeft. */
      blijft: ['Je facturen en bewijsstukken blijven beschikbaar.',
        'Je account blijft bestaan; je houdt de gratis app.'] };
  }

  /* OPZEGGEN. Het werk doet ./betaalschema.js; hier staat wie mag en wat hij
     terugkrijgt.

     IDEMPOTENT OP STAND en niet op een sleutel, net als ../commercie/ronde.js:
     een tweede druk vindt een contract dat al OPZEGGEND is en geeft dezelfde
     einddatum terug in plaats van een fout. Twee tikken op een telefoon zijn
     geen twee opzeggingen, en een foutmelding op de tweede laat een lid denken
     dat de eerste niet is aangekomen. */
  function zegOpZelf(accountId) {
    const a = aanmeldingVan(accountId);
    if (!a) return { status: 404, error: 'Er is voor dit account geen lidmaatschapsafspraak vastgelegd.' };
    const c = contractVan(a.id);
    if (!c) return { status: 404, error: 'Er staat geen contract bij deze aanmelding.' };
    if (c.status === contracten.STATUS.OPZEGGEND)
      return { ok: true, alOpgezegd: true, eindigtOp: c.eindigtOp,
        eindigtOpTekst: datum(c.eindigtOp), abonnement: beeld(a, c) };
    if (!contracten.LOPEND.has(c.status))
      return { status: 409, error: 'Dit lidmaatschap loopt niet meer; er is niets op te zeggen.' };

    const r = zegOpLidmaatschap(a.id);
    if (r.error) return r;
    const na = contractVan(a.id);
    return { ok: true, alOpgezegd: false,
      eindigtOp: r.eindigtOp, eindigtOpTekst: datum(r.eindigtOp),
      vervallenTermijnen: r.vervallen,
      /* Een nieuw lidmaatschap is een NIEUWE afspraak en geen terugdraaiing.
         Dat staat er omdat het waar is en niet om iemand tegen te houden: zie
         de kop, punt 2. */
      terug: 'Wil je later terug? Dan sluit je een nieuw lidmaatschap af; deze afspraak wordt niet heropend.',
      abonnement: na ? beeld(a, na) : null };
  }

  return { opzegVoorbeeld, zegOpZelf };
};
