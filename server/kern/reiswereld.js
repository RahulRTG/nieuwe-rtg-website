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

  const dag = (d) => String(d || '').slice(0, 10);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Elke bron levert zijn eigen vorm; dit maakt er één regel van. `app` en
     `link` wijzen naar de specialist, want daar hoort het echte werk te
     gebeuren. */
  const regel = (soort, o) => ({
    soort, titel: o.titel || '', bestemming: o.bestemming || '',
    van: dag(o.van), tot: dag(o.tot) || null, status: o.status || '',
    kenmerk: o.kenmerk || '', app: o.app, link: o.link
  });

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Een reiswereld die na een storing drie in plaats van vier
     reizen toont, is erger dan een die zegt dat hij het niet weet: de eerste
     lijkt compleet. Vandaar per bron een eigen uitkomst, en een lijst `stil`
     met wat er niet opgehaald kon worden. */
  function bron(naam, fn, uit, stil) {
    try { for (const r of fn() || []) uit.push(r); }
    catch (e) { stil.push(naam); }
  }

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
        titel: a.titel, bestemming: a.bestemming, van: a.vertrek,
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

    return {
      ok: true,
      komend: komendeReizen,
      /* Eerlijk over wat er niet gemeten is: niet nul melden wat onbekend is.
         Het scherm zegt dit hardop, want een lege reiswereld die eigenlijk een
         storing is, laat iemand een vlucht missen. */
      stil,
      bronnen: ['verblijven', 'reisbureau', 'vluchten']
    };
  }

  return { reiswereld: { komend } };
};
