/* RTG Reizen: de samenhanglaag over de reiswereld (laag 2 uit PLATFORM.md).

   Wat dit WEL is: één plek waar uw komende reis bij elkaar staat -- de vlucht,
   het verblijf, de aangevraagde reis, de charter -- ongeacht in welke app u hem
   geboekt heeft.

   Wat dit NIET is, en niet mag worden: een eigen reisadministratie. Deze module
   heeft geen eigen collectie, schrijft nooit, en bewaart niets. Elke regel wordt
   bij het opvragen uit het domein zelf gehaald, via de functie die dat domein
   al had (LAT.md regel 4, en de super-app-regel in PLATFORM.md: een super app
   orkestreert domeinsoftware, hij vervangt haar niet). Boeken, wijzigen en
   annuleren blijft daarom in de gespecialiseerde app; hier staat een link
   erheen en verder niets.

   De kern wordt LAAT gelezen (kern.reisbureau, kern.lucht, ...) en niet bij het
   opzetten uitgepakt: deze module wordt samengesteld in dezelfde ronde als de
   domeinen die hij leest, en welke laag als eerste klaar is, is geen eigenschap
   waar je op wilt bouwen. */
module.exports.maakReiswereld = ({ kern }) => {

  /* De grammatica van een wereld staat op EEN plek (kern/wereldkern.js): de
     vier signalen, hun volgorde, en het vangnet dat een stukke bron meldt
     zonder de rest mee te nemen. Die stonden hier als eigen kopie -- in alle
     vier de werelden letterlijk hetzelfde -- en dan bedoelt de eerste die er
     een verandert iets anders met hetzelfde woord (LAT.md regel 4).

     Het WOORDENBOEK blijft hier: welke statussen deze wereld kent, weet
     alleen deze wereld. En het sorteren en tellen ook, want die VERSCHILLEN
     per wereld met reden; ze samenvoegen zou van vier werelden een grijze
     middelmaat maken (zie het waarom in wereldkern.js). */
  const { RANG, bron, betekenisVan } = require('./wereldkern');

  const dag = (d) => String(d || '').slice(0, 10);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Elke bron levert zijn eigen vorm; dit maakt er één regel van. `app` en
     `link` wijzen naar de specialist, want daar hoort het echte werk te
     gebeuren. */
  /* Wat een status BETEKENT hoort op één plek te wonen. Zou elk scherm zelf
     beslissen dat "aangevraagd" geel is en "bevestigd" groen, dan lopen Reizen,
     Office en Command binnen een maand uit elkaar op precies de vraag waar een
     gebruiker op stuurt (LAT.md regel 4, en ONTWERP.md par. 3 en 5).

     Drie dingen per regel, en met opzet niet alleen een kleur:
       sig    -- de toestand voor de Signal Rail (gezond/aandacht/incident/actief)
       teken  -- het teken naast het woord, want kleur alleen is niet genoeg
       wacht  -- waarop gewacht wordt, als er op iets gewacht wordt

     Een status die we NIET kennen krijgt geen kleur en geen teken. Raden zou
     hier het ergst mogelijke zijn: een onbekende toestand groen kleuren is
     precies hoe je iemand een vlucht laat missen. */
  const BETEKENIS = {
    bevestigd:   { sig: 'gezond', teken: '✓' },
    geboekt:     { sig: 'gezond', teken: '✓' },
    ingecheckt:  { sig: 'gezond', teken: '✓' },
    aangevraagd: { sig: 'actief', teken: '◷', wacht: 'reisadviseur' },
    afgewezen:   { sig: 'incident', teken: '!' },
    vertraagd:   { sig: 'aandacht', teken: '!' }
  };
  /* Door de poort: betekenisVan weigert een status die een signaal noemt
     dat niet bestaat. Zonder die controle gaf een onbekend signaal stil NaN
     in de vergelijking en sorteerde de hele rij gewoon niet. */
  const betekenis = betekenisVan(BETEKENIS);

  const regel = (soort, o) => {
    const st = String(o.status || '').toLowerCase();
    const b = betekenis(st);
    return {
      soort, titel: o.titel || '', bestemming: o.bestemming || '',
      van: dag(o.van), tot: dag(o.tot) || null, status: o.status || '',
      sig: b.sig || '', teken: b.teken || '', wacht: b.wacht || '',
      /* Alleen meesturen wat het domein ECHT weet. Een verblijf kent geen
         reizigersaantal en een vlucht kent een stoel en geen gezelschap; daar
         een 1 neerzetten zou een getal verzinnen dat er nooit stond. Het scherm
         laat de regel dan gewoon weg. */
      personen: Number(o.personen) > 0 ? Number(o.personen) : null,
      kenmerk: o.kenmerk || '', app: o.app, link: o.link
    };
  };

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Een reiswereld die na een storing drie in plaats van vier
     reizen toont, is erger dan een die zegt dat hij het niet weet: de eerste
     lijkt compleet. Vandaar per bron een eigen uitkomst, en een lijst `stil`
     met wat er niet opgehaald kon worden. */

  function komend(key) {
    const uit = [], stil = [];

    bron('verblijven', () => (kern.mijnVerblijven(key) || [])
      .filter(v => v.status !== 'geannuleerd')
      .map(v => regel('verblijf', {
        titel: v.roomName, bestemming: v.plaats || '', van: v.aankomst, tot: v.vertrek,
        status: v.status, kenmerk: v.id, app: 'Verblijven', link: '/apps/hotels.html'
      })), uit, stil);

    bron('reisbureau', () => (kern.reisbureau.mijn(key) || [])
      .filter(a => a.status !== 'geannuleerd')
      .map(a => regel('reis', {
        titel: a.titel, bestemming: a.bestemming, van: a.vertrek, personen: a.personen,
        status: a.status, kenmerk: a.ref, app: 'Reisbureau', link: '/apps/reisbureau.html'
      })), uit, stil);

    bron('vluchten', () => {
      const d = kern.lucht.mijn(key) || {};
      const b = (d.boekingen || []).filter(x => x.status !== 'geannuleerd').map(x => regel('vlucht', {
        titel: (x.vlucht || {}).nummer, bestemming: (x.vlucht || {}).bestemming,
        van: (x.vlucht || {}).datum, status: x.status, kenmerk: x.code,
        app: 'Vluchten', link: '/apps/vluchten.html'
      }));
      const c = (d.charters || []).filter(x => x.status !== 'geannuleerd').map(x => regel('charter', {
        titel: x.soort, bestemming: x.bestemming, van: x.datum, status: x.status,
        kenmerk: x.code, app: 'Hangar', link: '/apps/hangar.html'
      }));
      return b.concat(c);
    }, uit, stil);

    /* Alleen wat nog komt, en wat vandaag speelt. Een verblijf loopt door tot
       de vertrekdatum, dus dat telt zolang `tot` niet gepasseerd is; een vlucht
       is één dag. */
    const nu = vandaag();
    const komendeReizen = uit
      .filter(r => (r.tot || r.van) >= nu)
      .sort((a, b) => (a.van || '').localeCompare(b.van || ''));

    /* Uitzonderingsgestuurd (ONTWERP.md par. 3): het scherm hoort niet te
       roepen hoeveel het weet, maar of er iets aan de hand is. Deze telling
       maakt dat mogelijk zonder dat het scherm er zelf overheen hoeft te lopen
       -- en zonder dat de twee ooit uit elkaar lopen. */
    const telling = {
      komend: komendeReizen.length,
      aandacht: komendeReizen.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: komendeReizen.filter(r => !!r.wacht).length,
      /* Onbekende toestanden apart tellen en apart noemen. Ze verstoppen tussen
         "in orde" zou een raadsel als geruststelling verkopen. */
      onbekend: komendeReizen.filter(r => !r.sig).length
    };

    return {
      ok: true,
      komend: komendeReizen,
      telling,
      /* Eerlijk over wat er niet gemeten is: niet nul melden wat onbekend is.
         Het scherm zegt dit hardop, want een lege reiswereld die eigenlijk een
         storing is, laat iemand een vlucht missen. */
      stil,
      bronnen: ['verblijven', 'reisbureau', 'vluchten']
    };
  }

  return { reiswereld: { komend } };
};
