/* Kantoren, deel "bank-incasso": DE GOUDEN WEG van dit huis (MACHINE.md).

   AFGESPLITST VAN ./bank-rekeningen.js omdat dat bestand over de 10 KB ging, en de
   keuringsregel had gelijk: dit IS een tweede onderwerp. De rest van dat bestand
   voert uit wat RTG Bank doet; dit bestand is de ene handeling die langs alle
   motoren gaat die dit huis voor geldhandelingen heeft gebouwd.

   `MACHINEDEKKING.json` meet waarom hij bestaat: geen enkele handeling had de keten
   gelopen -- de hoogst geintegreerde raakte DRIE van de negentien assen. Deze
   handeling had de twee duurste stukken al (een deur die een NAAM eist en een
   TWEEDE MENS) en beweegt echt geld; wat eromheen ontbrak staat in
   kern/kantoor/geldketen.js.

   DE UITVOERING STAAT HIER NIET. Zij hangt aan de tweede handtekening en dus aan
   ./bank-tweedehand.js, precies zoals de kop daar uitlegt: wat er gebeurt zodra de
   handtekening staat, hoort bij de HANDELING en niet bij de deur waar hij is
   aangevraagd.

   Gemount vanuit ./bank.js, met dezelfde context. */
'use strict';

module.exports = (ctx) => {
  const { app, officeAuth, kluisAuth, veilig, kern, naam, tweedeHand, zwaar, boardroomUser } = ctx;
  const bank = kern.bank;

  /* ------------------------------------------------------------------------
     DE INCASSORONDE -- de GOUDEN WEG van dit huis (MACHINE.md).

     Dit is de ene handeling die langs alle motoren gaat die dit huis voor
     geldhandelingen heeft gebouwd. Waarom juist hier: `MACHINEDEKKING.json` meet
     dat geen enkele handeling de keten had gelopen, en deze had de twee duurste
     stukken al -- een deur die een NAAM eist (kluisAuth) en een TWEEDE MENS
     (kern/kantoor/tweedehandtekening.js). Wat eromheen ontbrak, staat nu in
     kern/kantoor/geldketen.js: assurance, mandaat, streefstand, het voornemen met
     zijn besluit en bewijstoken, het tegenfeit, de frictie, de envelop, de
     hashketen en het gemeten gevolg.

     ER KOMT GEEN TWEEDE TWEEDE-HANDTEKENING BIJ. De deur blijft
     `tweedeHand.vraag`; de baan hangt ernaast en tekent bij diezelfde menselijke
     daad ook het voornemen af (zie ./bank-tweedehand.js). Twee mechanismen voor
     dezelfde garantie is de dubbeling die LAT.md regel 4 verbiedt.

     HET TEGENFEIT KOMT UIT HET DOMEIN: `bankIncassoVooruitblik` spiegelt de lus
     van de ronde zonder te boeken, en draagt zijn eigen bovengrens mee (wat er
     aan de beurt is, niet wat er zal lukken). Zonder dat getal kan het voornemen
     het totaal niet wegen, en dan is wegen te laat.

     DE ECONOMISCHE SLEUTEL hangt aan de KLOKGRENS van de ronde en niet aan iets
     dat de client stuurt: twee medewerkers die allebei op de knop drukken, sturen
     twee verschillende client-sleutels en innen twee keer. Op dezelfde grens is
     het hetzelfde voornemen.
     ---------------------------------------------------------------------- */
  app.post('/api/office/bank/incasso', kluisAuth, async (req, res) => {
    const ketenlaag = kern.geldketen;
    if (!ketenlaag) { veilig(res, () => ({ status: 503,
      error: 'De geldketen is niet gemount; een incassoronde gaat niet buiten de keten om.' })); return; }

    const tot = req.body && req.body.tot != null ? Number(req.body.tot) : Date.now();
    if (!Number.isFinite(tot)) { veilig(res, () => ({ status: 400, error: 'Die grens is geen tijdstip.' })); return; }

    /* ASSURANCE. De passkey hangt aan de HANDELING en aan de grens waarvoor hij
       geldt: een bevestiging voor gisteren dekt geen ronde van vandaag. */
    const sleutel = 'incasso:' + tot;
    /* `boardroomUser` lost de MENS achter deze sessie op; is er geen (de
       gedeelde code, of de eigenaar zonder gekoppeld account), dan weigert
       `eis` met zoveel woorden -- en dan begint de keten niet eens. Dat is de
       juiste plek voor die grens: de assurance-as is de as die een echt account
       eist, niet de baan eromheen. */
    const zw = await zwaar.eis(boardroomUser(req), 'bank.incasso', sleutel, req, 'De incassoronde');
    if (!zw.ok) { veilig(res, () => zw); return; }

    const blik = bank.bankIncassoVooruitblik({ tot });
    if (!blik.posten.length) { veilig(res, () => ({ status: 400,
      error: 'Er staat geen enkele vaste betaling aan de beurt; er is niets om te innen.' })); return; }

    const klaar = ketenlaag.klaarzet({
      klasse: 'geld-reeks', handeling: 'GELD_INNEN', pad: '/api/office/bank/incasso',
      doel: 'incassoronde tot ' + new Date(tot).toISOString(),
      mens: { naam: naam(req), sleutel: req.officeKey },
      assurance: zw,
      streefstand: 'elke vaste betaling die op ' + new Date(tot).toISOString() +
        ' aan de beurt was, is geind of staat met een mislukking bij zijn eigen post',
      tegenfeit: { graad: 'vermoed', uitslag: { aantal: blik.aantal, boekingen: blik.boekingen,
        bedragCenten: blik.bedragCenten }, reden: blik.grens },
      /* EEN STAP, en dat is geen armoede maar de waarheid: een incassoronde is
         economisch EEN handeling die N onafhankelijke boekingen doet. Per post een
         stap maken zou de lus van kern/bank/incasso.js nabouwen -- inclusief het
         vooruitzetten van `volgendeAt` en het tellen van mislukkingen -- en dat is
         de dubbeling die LAT.md regel 4 verbiedt. Wat een mens moet kunnen LEZEN
         voordat hij tekent, staat in `gegevens`. */
      stappen: [{ wat: 'incassoronde', doel: 'tot ' + tot, centen: blik.bedragCenten,
        gegevens: { tot, posten: blik.posten.slice(0, 200), aantal: blik.aantal, boekingen: blik.boekingen } }],
      totaalCenten: blik.bedragCenten,
      sleutel,
      /* DE BELOFTE VAN DE UITVOERING, en voor deze klasse is dat HERVATBAAR en niet
         atomair -- zie KLASSEN in kern/kantoor/geldketen.js. */
      uitvoerbelofte: { graad: 'gemeten', uitslag: 'hervatbaar per post',
        reden: 'kern/bank/incasso.js#ronde zet `volgendeAt` per post vooruit en telt een mislukking ' +
          'bij die post; een tweede ronde op dezelfde grens boekt dus niet dubbel en pakt op waar ' +
          'de vorige stopte. Alles-of-niets zou hier de verkeerde garantie zijn: dat een lid te ' +
          'weinig saldo heeft, mag de inning bij de anderen niet tegenhouden.' },
    });
    if (!klaar.ok) { veilig(res, () => klaar); return; }

    /* En dan pas de deur van de tweede mens. De aanvraag draagt het voornemen mee,
       zodat de bevestiging weet welke baan zij afmaakt.

       EEN TWEEDE KLIK LEVERT EEN TWEEDE DEURTICKET EN GEEN TWEEDE INNING, en dat
       onderscheid is met opzet zo. Het voornemen is de economische identiteit: op
       dezelfde grens is het hetzelfde voornemen (zie `sleutel` hierboven), dus wie
       het tweede ticket tekent voert niets extra uit -- het voornemen staat dan op
       UITGEVOERD en kern/commercie/voornemen/uitvoeren.js weigert. Wat er overblijft
       is een openstaand ticket dat verloopt of wordt ingetrokken. Dat is rommel en
       geen risico; het opruimen ervan vraagt een zoekweg in
       kern/kantoor/tweedehandtekening.js (die laag geeft het lijf met opzet niet
       naar buiten) en dat is een eigen verandering. */
    const vraag = tweedeHand.vraag({
      actie: 'bank.incasso',
      lijf: { tot, voornemen: klaar.voornemen.id },
      onderwerp: 'alle vaste betalingen die aan de beurt zijn (' + blik.aantal + ' posten, € ' +
        (blik.bedragCenten / 100).toFixed(2) + ')',
      door: req.officeKey
    });
    veilig(res, () => (vraag.ok
      ? { ...vraag, voornemen: klaar.voornemen, dossier: klaar.dossier, vooruitblik: blik }
      : vraag));
  });

  /* HET DOSSIER: wat er per as gebeurde, en welke VERPLICHTE as nog open staat.
     Lezen mag achter de gedeelde code -- het dossier gaat over de HANDELING en
     niet over een mens, en de namen erin zijn kantoornamen die in het journaal al
     stonden. */
  app.post('/api/office/bank/incasso/dossier', officeAuth, (req, res) => veilig(res, () => {
    if (!kern.geldketen) return { status: 503, error: 'De geldketen is niet gemount.' };
    const id = String((req.body || {}).voornemen || '');
    if (id) return kern.geldketen.dossier(id);
    const l = kern.geldketen.lijst({ limit: (req.body || {}).limit });
    return { ...l, ketenTop: kern.geldketen.journaalTop(), ketenHeel: kern.geldketen.journaalVerifieer() };
  }));
};
