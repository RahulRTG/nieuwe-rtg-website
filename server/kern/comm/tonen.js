/* De LEESKANT van de communicatiekern: wat een kijker van een gesprek ziet.

   Waarom dit een eigen bestand is, en niet zomaar een blok in ./index.js: er
   loopt een echte naad door de kern. De ene helft SCHRIJFT -- een gesprek
   aanleggen, een bericht toevoegen, een vlag zetten -- en die helft kent maar
   een waarheid. De andere helft, deze, VERTAALT die waarheid naar EEN kijker,
   en levert voor twee mensen bewust twee verschillende antwoorden op dezelfde
   opslag. De titel van een gesprek is de naam van de ANDER. De teller staat op
   wat JIJ nog niet las. En de naam achter een bericht van een zaak is voor de
   klant de voornaam en voor het team de hele naam.

   Alles wat hier staat is dus per definitie afhankelijk van `mij`, en alles
   wat in index.js staat per definitie niet. Dat is de grens, en het is dezelfde
   grens waar een lek doorheen zou moeten: wie wil weten wat een klant te zien
   krijgt, hoeft alleen dit bestand te lezen.

   Deze laag verandert NIETS aan de opslag. Ze krijgt de binnenkant van de kern
   mee (`binnen`) en leest daaruit; schrijven doet ze niet. */
'use strict';

const wie = require('./wie');

/* `binnen` is de binnenkant van maakComm(): de opslagfuncties en de kleine
   hulpjes. Bewust doorgegeven en niet geimporteerd -- die functies sluiten om
   de db van DEZE kern heen, en een tweede kern (de toetsen maken er een per
   geval) moet zijn eigen leeskant krijgen. */
function maakTonen(binnen) {
  const { G, B, standVan, magErin, eis, noem, isAanwezig, wieTypt,
    LADEN, MAX_GESPREKKEN } = binnen;

  const naam = (key) => noem(key) || 'Onbekend';
  const ladeVan = (soort) => (LADEN.find((l) => l.soorten.includes(soort)) || LADEN[0]).id;

  function toonBericht(m, mij) {
    return {
      id: m.id, at: m.at, vanMij: m.van === mij, van: naam(m.van),
      /* WIE ER NAMENS DE ZAAK TYPTE: de klant ziet de VOORNAAM, het team de
         hele naam.

         De eerste versie hield die naam helemaal binnen de zaak. Dat is
         verdedigbaar op een platform dat op codenaam draait, maar het is niet
         hoe gastvrijheid werkt -- "Marta brengt het zo" is het verschil tussen
         een dienst en een systeem, en de gastchat deed het voor de verhuizing
         ook al. Het is dus een besluit geworden en geen afleiding.

         Wat er wel strenger werd: vroeger ging de HELE naam mee, want het
         personeelsregister draagt "Marta Colom". Een achternaam maakt iemand
         vindbaar, een voornaam maakt hem aanspreekbaar. Binnen de zaak blijft
         de hele naam staan, want daar werk je met elkaar en moet je weten wie
         wat deed. */
      door: m.door ? (wie.zelfdeZaak(m.door, mij) ? naam(m.door) : wie.voornaam(naam(m.door))) : null,
      tekst: m.weg ? null : m.tekst, soort: m.soort,
      bijlage: m.weg ? null : (m.bijlage || null),
      antwoordOp: m.antwoordOp || null,
      reacties: Object.entries(m.reacties || {}).map(([teken, wie]) => ({
        teken, aantal: wie.length, vanMij: wie.includes(mij)
      })),
      gewijzigd: m.gewijzigd || null, was: m.gewijzigd ? m.was : null,
      lang: m.lang || null,
      weg: m.weg || null
    };
  }

  /* De titel van een een-op-een gesprek is de codenaam van de ANDER, en die
     hangt dus af van wie er kijkt. Vandaar hier en niet in het gesprek zelf:
     een opgeslagen titel zou voor een van beiden altijd de verkeerde zijn. */
  function toonGesprek(g, mij) {
    const lijst = B()[g.id] || [];
    const st = standVan(mij, g.id);
    const laatste = [...lijst].reverse().find((m) => !m.weg) || lijst[lijst.length - 1] || null;
    const gelezen = st.gelezen || '';
    const ongelezen = lijst.filter((m) => m.van !== mij && !m.weg && m.at > gelezen).length;
    const anderen = g.deelnemers.filter((d) => d !== mij);
    return {
      id: g.id, soort: g.soort, lade: ladeVan(g.soort),
      titel: g.titel || (anderen.length === 1 ? naam(anderen[0]) : anderen.map(naam).join(', ')) || 'Gesprek',
      deelnemers: anderen.map(naam), aantal: g.deelnemers.length,
      laatste: laatste ? (laatste.weg ? 'Bericht ingetrokken' : (laatste.tekst || '(bijlage)')).slice(0, 140) : null,
      laatsteVanMij: laatste ? laatste.van === mij : false,
      at: g.laatst, ongelezen,
      vast: !!st.vast, stil: !!st.stil, weg: !!st.weg, concept: st.concept || null,
      online: anderen.length === 1 ? isAanwezig(anderen[0]) : anderen.some(isAanwezig),
      bron: (g.meta && g.meta.bron) || null, link: (g.meta && g.meta.link) || null
    };
  }

  function inbox(mij, opties) {
    const o = opties || {};
    let mijne = G().filter((g) => magErin(g, mij));
    if (o.lade) {
      const lade = LADEN.find((l) => l.id === o.lade);
      if (lade) mijne = mijne.filter((g) => lade.soorten.includes(g.soort));
    }
    const uit = mijne.map((g) => toonGesprek(g, mij))
      .filter((g) => o.archief ? g.weg : !g.weg)
      .sort((a, b) => (b.vast ? 1 : 0) - (a.vast ? 1 : 0) ||
        String(b.at || '').localeCompare(String(a.at || '')));
    return { gesprekken: uit.slice(0, MAX_GESPREKKEN), laden: LADEN };
  }

  function gesprek(mij, gesprekId, opties) {
    const g = eis(gesprekId, mij);
    const o = opties || {};
    const lijst = B()[g.id] || [];
    const vanaf = Math.max(0, lijst.length - (Number(o.aantal) || 120));
    return Object.assign(toonGesprek(g, mij), {
      berichten: lijst.slice(vanaf).map((m) => toonBericht(m, mij)),
      meer: vanaf > 0,
      typt: wieTypt(g.id, mij)
    });
  }

  /* Zoeken over ALLES wat van jou is, in een keer. Dit is wat een berichtenapp
     onderscheidt van een archiefkast: niet weten in welke module iets stond en
     het toch vinden. */
  function zoek(mij, vraag) {
    const naald = String(vraag || '').trim().toLowerCase().slice(0, 80);
    if (naald.length < 2) return { treffers: [], vraag: naald };
    const uit = [];
    for (const g of G()) {
      if (!magErin(g, mij)) continue;
      for (const m of (B()[g.id] || [])) {
        if (m.weg || !m.tekst) continue;
        if (!m.tekst.toLowerCase().includes(naald)) continue;
        uit.push({ gesprekId: g.id, berichtId: m.id, soort: g.soort, lade: ladeVan(g.soort),
          titel: toonGesprek(g, mij).titel, tekst: m.tekst.slice(0, 160),
          at: m.at, vanMij: m.van === mij });
      }
    }
    uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return { treffers: uit.slice(0, 60), vraag: naald, totaal: uit.length };
  }

  /* De draad als leesbare regels, voor de AI-laag (./ai). Alleen codenamen,
     alleen dit gesprek, alleen wat er nu staat. Dit is het ENIGE wat een model
     van een gesprek te zien krijgt. */
  function draad(mij, gesprekId, hoeveel) {
    const g = eis(gesprekId, mij);
    const lijst = (B()[g.id] || []).filter((m) => !m.weg && m.tekst);
    return {
      titel: toonGesprek(g, mij).titel,
      regels: lijst.slice(-(hoeveel || 60)).map((m) => (m.van === mij ? 'Ik' : naam(m.van)) + ': ' + m.tekst)
    };
  }

  return { naam, ladeVan, toonBericht, toonGesprek, inbox, gesprek, zoek, draad };
}

module.exports = { maakTonen };
