/* Payroll OS: DE BIJWERKLAAG -- nieuwe regelpakketten komen vanzelf binnen.

   WAAROM DIT BESTAAT. Loonbelastingtabellen, premies en het minimumuurloon
   veranderen elk jaar en soms halverwege. Ze met de hand in code nabouwen is de
   manier waarop een loonmotor stilletjes fout gaat: niemand merkt het, en het
   verschil komt pas boven bij de aangifte of bij de werknemer. Binnenhalen gaat
   daarom vanzelf.

   MAAR "VANZELF" IS NIET "ONGEZIEN". Deze laag haalt op en biedt aan; ./regelpakket.js
   keurt en zet klaar; een mens merkt aan. Een binnengehaald pakket draagt de
   stand `ongecontroleerd` en daar mag geen definitieve loonrun op. Dat is geen
   omslachtigheid maar de enige rem die er is: een verkeerd ingelezen tabel die
   automatisch in gebruik gaat, betaalt honderden mensen het verkeerde bedrag.

   DE BRON IS INWISSELBAAR, EN DAT IS EEN ONTWERPKEUZE. Deze module weet niet
   waar een pakket vandaan komt -- een URL, een bestand, een koppeling met de
   Belastingdienst, een medewerker die iets uploadt. Ze krijgt een `haal`-functie
   mee en werkt met wat daaruit komt. Zonder die scheiding zit de loonmotor vast
   aan de vorm van een website van een ander, en verandert er iets zodra die
   partij zijn pagina verbouwt.

   WAT HIER BEWUST NIET GEBEURT: parsen van pdf's of html. Een Handboek
   Loonheffingen omzetten naar tarieven is werk waar een mens naar hoort te
   kijken; deze laag neemt gestructureerde pakketten aan (JSON) en keurt ze. Wie
   een pdf wil inlezen, bouwt dat als een BRON die een pakket oplevert -- dan
   valt het onder dezelfde keuring als al het andere. */
'use strict';

/* Hoe vaak er gekeken wordt. Tarieven veranderen niet per uur; dagelijks is
   ruim genoeg en houdt de bron met rust. De ronde is bovendien stil als er
   niets nieuws is (zie `ongewijzigd` in regelpakket.neemOp). */
const RONDE_MS = 24 * 60 * 60 * 1000;

function maakBijwerken({ regelpakket, db, save, nu, log, dekking, fetchImpl }) {
  const tijd = nu || (() => new Date().toISOString());
  const meld = log || (() => {});

  function journaal() {
    if (!Array.isArray(db.data.payrollRegelJournaal)) db.data.payrollRegelJournaal = [];
    return db.data.payrollRegelJournaal;
  }
  /* Elke ronde komt in het journaal, ook een die niets vond. "Er is al drie
     maanden niets binnengekomen" is namelijk zelf een bevinding: het betekent
     of dat er niets veranderde, of dat de bron stuk is, en zonder journaal zie
     je het verschil pas als het te laat is. */
  function noteer(regel) {
    const j = journaal();
    j.unshift(Object.assign({ at: tijd() }, regel));
    if (j.length > 200) j.length = 200;
    save();
  }

  /* De bronnen. Elke bron is { naam, soort, url?, haal() } waarbij haal() een
     pakket of een lijst pakketten oplevert (of niets). */
  const bronnen = [];
  function meldBronAan(bron) {
    if (!bron || typeof bron.haal !== 'function') throw new TypeError('een bron heeft een haal()-functie nodig');
    bronnen.push(bron);
    return bronnen.length;
  }

  /* Een ronde: alle bronnen langs, alles wat binnenkomt door de keuring, en het
     resultaat in het journaal. Faalt een bron, dan gaan de andere gewoon door --
     een kapotte koppeling hoort de rest niet stil te zetten. */
  /* DE BRONNEN VAN DE HELE WERELD, en niet alleen die in de code staan.
     Een land erbij hoort geen uitrol te zijn: het kantoor zet een https-adres
     per land neer (kern/payroll/dekking.js) en de eerstvolgende ronde haalt het
     op. Zonder deze regel werkte de bijwerklaag alleen voor bronnen die iemand
     bij het opstarten had aangemeld -- en dat waren er nul, dus elke ronde keek
     naar niets en meldde opgewekt dat er niets nieuws was. */
  function alleBronnen() {
    const uit = bronnen.slice();
    if (!dekking) return uit;
    for (const b of dekking.alleBronnen()) {
      if (uit.some(x => x.url === b.url)) continue;
      uit.push(Object.assign(urlBron({ naam: b.naam, url: b.url, fetchImpl }),
        { soort: 'koppeling', land: b.land }));
    }
    return uit;
  }

  async function ronde() {
    const bronnen = alleBronnen();
    const uitslag = { at: tijd(), gekeken: bronnen.length, nieuw: [], afgekeurd: [], fouten: [] };
    for (const bron of bronnen) {
      let geleverd;
      try {
        geleverd = await bron.haal();
      } catch (e) {
        const fout = String(e && e.message || e).slice(0, 200);
        uitslag.fouten.push({ bron: bron.naam, land: bron.land || null, fout });
        if (dekking && bron.land && bron.url) dekking.noteerBron(bron.land, bron.url, { fout });
        continue;
      }
      if (dekking && bron.land && bron.url) dekking.noteerBron(bron.land, bron.url, { fout: null });
      const pakketten = Array.isArray(geleverd) ? geleverd : (geleverd ? [geleverd] : []);
      for (const p of pakketten) {
        const r = regelpakket.neemOp(p, { soort: bron.soort || 'koppeling', naam: bron.naam, url: bron.url });
        if (r.error) uitslag.afgekeurd.push({ bron: bron.naam, versie: p && p.versie, bezwaren: r.bezwaren || [r.error] });
        else if (!r.ongewijzigd) uitslag.nieuw.push({ bron: bron.naam, land: p.land, versie: r.versie, geldigVan: r.geldigVan });
      }
    }
    /* VOORUITKIJKEN HOORT BIJ DE RONDE. Een jaargang die afloopt zonder
       opvolger is de klassieke januarifout: op 31 december draait alles, op 1
       januari kan er geen enkele loonrun meer -- precies de week waarin er
       gedraaid moet worden. De ronde die tarieven ophaalt is de enige plek die
       hier sowieso elke dag langskomt, dus hij kijkt meteen vooruit. */
    if (dekking) {
      uitslag.verloopt = dekking.verlooptBinnen(60);
      for (const v of uitslag.verloopt)
        meld('[payroll] ' + v.land + ': het regelpakket loopt af op ' + v.geldigTot +
          ' en er is geen opvolger. ' + v.personeel + ' medewerker(s) in ' + v.zaken + ' zaak/zaken.');
    }

    noteer({ soort: 'ronde', gekeken: uitslag.gekeken, nieuw: uitslag.nieuw.length,
      afgekeurd: uitslag.afgekeurd.length, fouten: uitslag.fouten.length,
      verloopt: (uitslag.verloopt || []).length, details: uitslag });
    if (uitslag.nieuw.length) meld('[payroll] ' + uitslag.nieuw.length + ' nieuw regelpakket(ten) binnengekomen; ze staan als ongecontroleerd klaar.');
    if (uitslag.afgekeurd.length) meld('[payroll] ' + uitslag.afgekeurd.length + ' regelpakket(ten) afgekeurd bij binnenkomst.');
    return uitslag;
  }

  /* De klok. Wordt bij het opstarten aangezet; `unref` zodat een testproces er
     niet op blijft wachten. */
  let klok = null;
  function start(interval) {
    if (klok) return klok;
    const ms = Number(interval) > 0 ? Number(interval) : RONDE_MS;
    klok = setInterval(() => { ronde().catch(() => {}); }, ms);
    if (klok.unref) klok.unref();
    return klok;
  }
  function stop() { if (klok) { clearInterval(klok); klok = null; } }

  /* Wat er klaarligt en aandacht vraagt: pakketten die nog niemand heeft
     aangemerkt, en het moment waarop ze gaan gelden. Dit is wat het kantoor
     hoort te zien, niet een lijst van alles wat er ooit binnenkwam. */
  function tekenen(land) {
    const alle = regelpakket.alle(land || 'NL');
    const vandaag = tijd().slice(0, 10);
    return {
      wachtOpKeuring: alle.filter(p => p.stand !== 'goedgekeurd')
        .map(p => ({ versie: p.versie, geldigVan: p.geldigVan, bron: p.bron,
          alGeldig: p.geldigVan <= vandaag })),
      laatsteRonde: (journaal()[0] || null)
    };
  }

  return { meldBronAan, ronde, start, stop, tekenen, journaal, RONDE_MS };
}

/* ---------------------------------------------------------------------------
   Een bron die een pakket van een URL haalt. Dit is de eenvoudigste vorm en
   meteen het patroon voor alle andere: haal iets op, geef een pakket terug, en
   laat het keuren. Er wordt hier BEWUST niets geparst of gerepareerd -- wat er
   niet als geldig pakket uitkomt, hoort af te ketsen op de keuring en niet
   half-goed naar binnen te glippen. */
function urlBron({ naam, url, fetchImpl }) {
  const haalOp = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  return {
    naam: naam || url, soort: 'url', url,
    async haal() {
      if (!haalOp) throw new Error('geen fetch beschikbaar in deze omgeving');
      const r = await haalOp(url, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('bron gaf status ' + r.status);
      return await r.json();
    }
  };
}

module.exports = { maakBijwerken, urlBron, RONDE_MS };
