/* WAT EEN LID ZELF MET ZIJN EIGEN LIDMAATSCHAP MAG.

   HET GAT DAT DIT SLUIT. `/api/aanmelding/verleng`, `/opzeggen` en `/contracten`
   stonden alle drie achter `officeAuth`. Een lid kon zijn eigen abonnement dus
   niet zien, niet opzeggen en niet nalezen wat hij had afgesproken -- hij moest
   het kantoor vragen. Dat is geen ontbrekend scherm maar een ontbrekend RECHT:
   de motor eronder (../commercie/contract.js) kende opzeggen al, alleen niet
   voor de persoon die het aangaat.

   DE IDENTITEIT KOMT UIT DE SESSIE EN NOOIT UIT HET LICHAAM. Dat is dezelfde
   regel als bij ./aanvraag.js, en om een scherpere reden: de kantoorroute neemt
   een `aanmeldingId` uit de body aan, en die route achter een ledendeur hangen
   zou betekenen dat elk lid elk willekeurig lidmaatschap kan opzeggen. Hier
   wordt het aanmeldingId dus GEVONDEN uit het accountId en nooit aangenomen.

   GEEN TWEEDE OPZEGKNOP. Het werk gebeurt in ./betaalschema.js
   (`zegOpLidmaatschap`), precies dezelfde functie die het kantoor aanroept.
   Hier staat alleen WIE hem mag aanroepen en WAT het lid daarbij te zien krijgt.
   Een eigen opzeglus ernaast zou een tweede waarheid zijn over of een
   lidmaatschap nog loopt (LAT regel 4).

   WAT HET LID MET OPZET NIET KAN, en beide zijn een grens en geen gat:

   1. VERLENGEN. `contracten.verleng(c, nieuwCenten)` is het ENIGE moment waarop
      de afgesproken prijs mag veranderen. Een lid dat zijn eigen verlenging
      aanroept, zou dus zijn eigen prijs kunnen zetten. En hij hoeft het niet:
      een consumentenabonnement verlengt stilzwijgend, en dat doet de
      commerciele ronde (../commercie/ronde.js). Niet verlengen is hier dus
      hetzelfde als niets doen, en dat mag hij al.
   2. EEN OPZEGGING TERUGDRAAIEN. De standentabel in ../commercie/contract/vorm.js
      laat vanuit OPZEGGEND alleen GEEINDIGD toe, en `zegOpLidmaatschap`
      VERWIJDERT de termijnen na de einddatum in plaats van ze op 'vervallen' te
      zetten. Terugdraaien is dus geen schakelaar maar twee besluiten (een
      overgang toevoegen, en de termijnen opnieuw opwekken). Dat hoort een eigen
      stap te zijn; zie AFSPRAAK.md par. 14. Tot dan zegt het antwoord eerlijk
      dat een nieuw lidmaatschap een nieuwe afspraak is.

   TWEE BESTANDEN, TWEE SOORTEN WERK. Dit bestand LEEST en TOONT; het opzeggen
   zelf staat in ./lidabonnement-opzeg.js. De naad lag hier toch al -- de
   leeskant raakt niets aan en de opzegkant verandert een verbintenis -- en de
   keuring dwong hem af bij 11,7 kB. Het is dezelfde scheiding als bij
   ../commercie/contract.js (de winkel) en ../commercie/contract/vorm.js (de
   vorm). */
'use strict';

module.exports = ({ A, B, contracten, PASSEN, eur, zegOpLidmaatschap }) => {

  /* De geaccepteerde aanmelding van DIT account. Nooit op id uit een lichaam.

     Meerdere geaccepteerde aanmeldingen op een account horen niet te bestaan,
     maar als ze er zijn pakken we de JONGSTE met een lopend contract: dat is de
     afspraak die vandaag geldt. Stil de eerste uit de lijst pakken zou bij een
     oud, beeindigd lidmaatschap het verkeerde contract tonen. */
  function aanmeldingVan(accountId) {
    const id = accountId == null ? null : Number(accountId);
    if (!Number.isFinite(id)) return null;
    const mijn = A().filter(a => Number(a.accountId) === id && a.status === 'geaccepteerd');
    if (!mijn.length) return null;
    const metLopend = mijn.find(a => {
      const c = contractVan(a.id);
      return c && contracten.LOPEND.has(c.status);
    });
    return metLopend || mijn[0];
  }

  /* Het contract achter een aanmelding. Via de betaalschemarij, want die draagt
     het contractId; `contracten.lijst({aanmeldingId})` geeft een PUBLIEKE vorm
     terug en daar kan `zegOp` niet mee werken. */
  function contractVan(aanmeldingId) {
    const rij = B().find(r => r.aanmeldingId === String(aanmeldingId || ''));
    if (!rij || !rij.contractId) return null;
    return contracten.vind(rij.contractId) || null;
  }

  /* De termijnen die nog moeten komen, uit de betaalschemarij. Er wordt hier
     niets opnieuw gerekend: wat er staat, staat er. */
  function komende(aanmeldingId) {
    const rij = B().find(r => r.aanmeldingId === String(aanmeldingId || ''));
    if (!rij) return [];
    const nu = Date.now();
    return (rij.termijnen || [])
      .filter(t => t.status !== 'voldaan' && new Date(t.vervalt).getTime() >= nu)
      .sort((a, b) => new Date(a.vervalt) - new Date(b.vervalt));
  }

  /* WAT HET LID LEEST. In de stem van zijn eigen pas (CLAUDE.md: "je" bij de
     RTG Pass, "u" bij Lifestyle en Business).

     Geen contract is hier GEEN fout. Er zijn leden die hun pas langs een andere
     weg kregen -- een demo-persona, een geseed account, een aanmelding van voor
     de contractmotor -- en die hebben geen afspraak om te tonen. Een 404 zou dat
     als defect laten lezen; het is een eerlijke mededeling met de weg erbij. */
  function mijn(accountId) {
    const a = aanmeldingVan(accountId);
    if (!a) return { ok: true, abonnement: null,
      reden: 'Er is voor dit account geen lidmaatschapsafspraak vastgelegd. Vraag de ledenbalie wat er voor jou geldt.' };
    const c = contractVan(a.id);
    if (!c) return { ok: true, abonnement: null,
      reden: 'Je aanmelding is goedgekeurd, maar er staat geen contract bij. De ledenbalie kan dat aanvullen.' };
    return { ok: true, abonnement: beeld(a, c) };
  }

  function beeld(a, c) {
    const def = PASSEN[c.pas] || {};
    const u = def.stem === 'u';
    const k = komende(a.id);
    return {
      contractId: c.id,
      pas: c.pas,
      pasNaam: def.naam || c.pas,
      stem: def.stem || 'je',
      stand: c.status,
      standTekst: standTekst(c, u),
      /* HET BEDRAG KOMT VAN HET CONTRACT EN NIET VAN DE PRIJSLIJST. Zelfde
         regel als in ../lid/facturen.js sinds 11 september 2026: de prijs van
         het product mag bewegen, de prijs van de verplichting niet. Is er geen
         bedrag afgesproken (een contractuele trede zonder notering), dan staat
         er null en niet nul -- nul zou "gratis" betekenen. */
      maandBedrag: c.afgesprokenCenten == null ? null : eur(c.afgesprokenCenten),
      prijsVastTot: c.prijsVastTot || null,
      begonnenOp: c.startAt,
      minimumMaanden: c.minimumMaanden,
      eindeVerbintenis: contracten.eindeVerbintenis(c),
      verlenging: c.verlenging,
      opzegMaanden: c.opzegMaanden,
      eindigtOp: c.eindigtOp || null,
      volgendeTermijn: k.length ? { vervalt: k[0].vervalt,
        bedrag: k[0].centen == null ? null : eur(k[0].centen) } : null,
      termijnenTeGaan: k.length,
      /* WAT HET LID HIERNA KAN. Een gesloten lijstje, zodat een scherm geen knop
         hoeft te raden -- en zodat een knop die er niet mag zijn, er ook niet
         staat. Verlengen staat er met opzet nooit bij (zie de kop). */
      kan: { opzeggen: contracten.LOPEND.has(c.status) && c.status !== contracten.STATUS.OPZEGGEND }
    };
  }

  function datum(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const M = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }

  function standTekst(c, u) {
    const S = contracten.STATUS;
    if (c.status === S.OPZEGGEND)
      return (u ? 'Opgezegd. Uw lidmaatschap loopt tot ' : 'Opgezegd. Je lidmaatschap loopt tot ') + datum(c.eindigtOp) + '.';
    if (c.status === S.GEEINDIGD) return u ? 'Beeindigd.' : 'Beeindigd.';
    if (c.status === S.VERLENGBAAR)
      return u ? 'Actief. De minimumtermijn loopt af; er volgt bericht.' : 'Actief. De minimumtermijn loopt af; je hoort er nog van.';
    return u ? 'Actief.' : 'Actief.';
  }

  /* DE KALE STAND, voor de poortwachter en niet voor een scherm.

     `mijn()` hierboven geeft een BEELD: namen, bedragen in euro's, zinnen in de
     stem van de pas. Dat is precies wat `auth()` niet moet doen -- die draait op
     elk ledenverzoek, en een tekst opmaken om hem weg te gooien is werk voor
     niets. Hier staat dus alleen wat de poort nodig heeft, uit dezelfde twee
     functies: geen tweede weg naar het contract van een lid (LAT regel 4).

     GEEFT HET CONTRACT ZELF TERUG EN GEEN SAMENVATTING. Wie hier `loopt: true`
     zou afleiden, zet de vraag "wat is lopend" op een tweede plek naast
     ../commercie/contract/vorm.js. Het oordeel hoort in ../commercie/lidpoort.js
     en de stand daar; dit bestand ZOEKT alleen op. */
  function stand(accountId) {
    const a = aanmeldingVan(accountId);
    if (!a) return null;
    return contractVan(a.id);
  }

  return { aanmeldingVan, contractVan, komende, beeld, datum, mijn, stand };
};
