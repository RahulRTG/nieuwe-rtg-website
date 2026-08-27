/* RTG Pay, deelbestand "inkomsten": WAT HEB IK ONTVANGEN, EN WAARVOOR.

   WAAROM DIT BESTAAT. RTG's positie bij een verkoop tussen leden is: de
   particulier is zelf verantwoordelijk voor zijn belasting, en RTG geeft de
   TOOLS. Dat tweede is een belofte, en een belofte in tekst is een belofte in
   code (LAT.md regel 6). Tot dit bestand er was, kon een lid precies dertig
   grootboekregels en zijn saldo zien -- en daar valt geen aangifte mee te doen.

   Dit is dus het gereedschap dat bij die positie hoort: alles wat er in een
   periode BINNENKWAM, per soort, met aantallen, en uit te draaien voor wie het
   moet invullen.

   VIER DINGEN DIE DIT MET OPZET NIET IS, en ze staan alle vier ook in het
   antwoord zelf. Een overzicht dat zich groter voordoet dan het is, laat iemand
   een verkeerde aangifte doen -- en dat is erger dan geen overzicht.

   1. HET IS GEEN AANGIFTE EN GEEN ADVIES. Het is wat RTG heeft geboekt.
   2. HET IS NIET COMPLEET. Alleen wat door RTG Pay ging. Contant geld, een
      bankoverschrijving buiten RTG om, en betalingen die via de betaalprovider
      liepen (zoals in de marktplaats) staan er NIET in.
   3. HET IS GEEN WINST. Wat u ervoor betaald of gemaakt heeft, weet RTG niet.
   4. OPLADEN IS GEEN INKOMEN. Uw eigen geld op uw wallet zetten is geen
      ontvangst van een ander, en telt hier dus niet mee. Zonder die uitsluiting
      zou iemand zijn eigen stortingen als omzet opgeven.

   DE SPIEGEL VAN `besteedDoor`. De vraag "wat kwam er binnen" is precies de
   omgekeerde van "wat gaf dit lid uit" in ./poort.js, en de regel is dezelfde:
   een boeking tussen twee EIGEN posities (van een budget naar de wallet) is geen
   uitgave en ook geen inkomst -- het is geld verplaatsen. */
'use strict';

/* Wat een soort in gewone woorden is. Een gesloten lijst en geen vrije tekst,
   om dezelfde reden als de doelen in kern/appstore/machtigingen.js: hiermee kan
   een boekhouder twee regels naast elkaar leggen. Een onbekende soort valt
   NIET weg maar houdt zijn eigen naam -- verdwijnen is hier de ergste fout. */
const SOORTNAAM = {
  p2p: 'Van een ander lid gekregen of betaald gekregen',
  uitvoering: 'Verkoop van eigen werk (uitvoerende media)',
  podium: 'Podium: cadeaus, abonnementen en verkoop',
  appstore: 'App Store: verkoop van een app',
  kassa: 'Afgerekend bij u als zaak',
  verkoop: 'Verkoop via een partnerrekening',
  boeking: 'Overige boeking'
};

module.exports = (ctx) => {
  const { grootboek, rekLid, waarde, nu } = ctx;

  /* DE TIJD IS HIER EEN GETAL, EN DAT IS DE VAL. In de mediamodules geeft `nu()`
     een ISO-string, maar RTG Pay gebruikt de huisklok (lib/klok.js) en die geeft
     MILLISECONDEN -- en het grootboek zet dat getal in `at`. Wie hier
     `String(at).slice(0, 4)` doet, leest "1787" als jaartal en een `.slice()` op
     een getal gooit een fout. Allebei is hier gebeurd voor deze regel er stond.

     Daarom een omzetting die allebei aankan: een getal is een tijdstempel, een
     string is een datum. Zo blijft dit bestand werken als het grootboek ooit ISO
     gaat opslaan, en nu ook. */
  const alsDatum = (v) => {
    if (v == null) return null;
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  };
  const isoVan = (v) => { const d = alsDatum(v); return d ? d.toISOString() : ''; };
  const jaarVan = (v) => isoVan(v).slice(0, 4);

  function inkomsten(codenaam, opties) {
    const o = opties || {};
    const jaar = /^\d{4}$/.test(String(o.jaar)) ? String(o.jaar) : jaarVan(nu());
    const rek = rekLid(codenaam);
    /* Alle posities van dit lid, niet alleen de wallet: een werkgeversbudget of
       een oormerk is ook van hem, en geld dat daartussen schuift is geen
       inkomst. Zonder waardelaag is er precies een positie. */
    const eigen = new Set(waarde ? waarde.positiesVan(codenaam) : [rek]);
    eigen.add(rek);

    const regels = [];
    for (const r of grootboek()) {
      if (jaarVan(r.at) !== jaar) continue;
      if (!eigen.has(r.naar)) continue;          // niet naar mij
      if (eigen.has(r.van)) continue;            // van mezelf naar mezelf
      if (r.van === 'extern:oplaad') continue;   // eigen geld erin zetten
      if (r.soort === 'terug') continue;         // een teruggeboekt deel is geen ontvangst
      regels.push({ at: isoVan(r.at), id: r.id, soort: r.soort || 'boeking', centen: r.centen,
        oms: r.oms || '', van: String(r.van).replace(/^lid:/, '').replace(/^partner:/, 'zaak ') });
    }

    const per = {};
    for (const r of regels) {
      const s = per[r.soort] || (per[r.soort] = { soort: r.soort, naam: SOORTNAAM[r.soort] || r.soort, aantal: 0, centen: 0 });
      s.aantal++; s.centen += r.centen;
    }
    const perSoort = Object.values(per).sort((a, b) => b.centen - a.centen);

    return {
      status: 200, codenaam, jaar,
      totaalCenten: regels.reduce((n, r) => n + r.centen, 0),
      aantal: regels.length,
      perSoort, regels,
      uitleg: 'Alles wat er in ' + jaar + ' via RTG Pay bij u binnenkwam, van iemand anders dan uzelf.',
      /* Dit blok staat er even groot bij als het bedrag, en niet in de kleine
         lettertjes. Wie hiermee een aangifte doet, moet weten wat er NIET in
         zit -- anders is dit overzicht een reden om iets verkeerd in te vullen. */
      nietInbegrepen: [
        'Geld dat niet via RTG Pay ging: contant, een bankoverschrijving, of een betaling die via de betaalprovider liep.',
        'Wat u zelf op uw wallet heeft gezet. Dat is geen ontvangst van een ander.',
        'Wat het u heeft gekost. Dit is wat er binnenkwam, niet wat u eraan heeft overgehouden.'
      ],
      let: 'Dit is een overzicht van wat RTG heeft geboekt. Het is geen belastingaangifte en geen advies. ' +
        'U bent zelf verantwoordelijk voor wat u aangeeft; RTG levert de cijfers die het kent.'
    };
  }

  /* Uitdraaien. Puntkomma's en een BOM, want dit gaat naar een boekhouder en
     die opent het in een programma dat daarop rekent. De bedragen staan in
     euro's met een komma: een csv die je moet omrekenen voor je hem kunt
     gebruiken, is geen gereedschap. */
  function inkomstenCsv(codenaam, opties) {
    const r = inkomsten(codenaam, opties);
    /* DE CSV-ONTSNAPPER VAN HET HUIS, en niet een eigen exemplaar. Die van
       kern/factuur.js doet iets wat een zelfgeschreven aanhalingsteken-versie
       vergeet: hij zet een cel die met =, +, - of @ begint achter een apostrof,
       zodat een boekhouder geen FORMULE opent uit een omschrijving die een
       vreemde heeft getypt. Hier stond eerst wel zo'n eigen versie; die is weg
       (LAT.md regel 4: geen tweede antwoord op dezelfde vraag). */
    const { csv, csvCel } = require('../factuur');
    const euro = (c) => (c / 100).toFixed(2).replace('.', ',');
    const rijen = [['datum', 'soort', 'omschrijving', 'van', 'bedrag']];
    for (const x of r.regels) {
      rijen.push([x.at.slice(0, 10), SOORTNAAM[x.soort] || x.soort, x.oms, x.van, euro(x.centen)]);
    }
    rijen.push([]);
    rijen.push(['TOTAAL ' + r.jaar, '', '', '', euro(r.totaalCenten)]);
    /* De grenzen reizen mee in het bestand zelf. Een csv die los van dit scherm
       op een bureau belandt, moet zichzelf kunnen uitleggen -- anders leest
       iemand hem als een jaaropgave. */
    rijen.push([]);
    rijen.push(['Dit is geen aangifte en geen advies; het is wat RTG heeft geboekt.']);
    for (const n of r.nietInbegrepen) rijen.push(['Niet inbegrepen: ' + n]);
    return { csv: '\ufeff' + csv(rijen), jaar: r.jaar, cel: csvCel };
  }

  return { inkomsten, inkomstenCsv, INKOMSTEN_SOORTEN: SOORTNAAM };
};
