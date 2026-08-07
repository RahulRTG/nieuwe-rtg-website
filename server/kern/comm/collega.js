/* ========= DE COLLEGABERICHTEN VERHUIZEN NAAR DE KERN =========

   De tweede voorraad die overgaat, na de priveberichten tussen leden
   (./dm.js). Hij kon niet eerder: een collegachat loopt tussen twee MENSEN
   BINNEN EEN ZAAK, en zulke deelnemers bestonden pas sinds ./wie.js. Dat is
   ook precies waarom de vorige ronde de moeite waard was -- de voorraden
   stonden niet apart omdat ze anders waren, maar omdat de andere kant van het
   gesprek geen naam had in dit model.

   DEZELFDE DRIE REGELS als bij de priveberichten, en om dezelfde redenen (zie
   de kop van ./dm.js): een gesprek per paar uit de kern, de geschiedenis gaat
   eenmalig mee op het moment dat het paar toch al wordt geopend, en de oude
   voorraad blijft staan.

   TWEE DINGEN ZIJN HIER ANDERS, en allebei zijn ze een valkuil.

   1. DE ZAAKCODE MOET IN DE SLEUTEL. De oude opslag zette hem in het PAD:
      db.data.collegaChats[code][paar]. Twee medewerkers met toevallig
      dezelfde nummers bij twee bedrijven zaten daardoor vanzelf in twee
      bakjes. De kern heeft een platte lijst gesprekken, dus als de code uit
      de sleutel wegvalt lopen die twee gesprekken in elkaar over -- en dat is
      geen rommelig scherm maar een datalek tussen twee bedrijven. Vandaar
      mens(code, id) en niet id alleen, en vandaar dat het als eigen toets
      staat in test/comm-collega.test.js.

   2. ONGELEZEN WAS EEN TELLER, GEEN TIJDSTIP. De oude vorm hield
      unread[staffId] = 3 bij; de kern rekent met "gelezen tot". Die twee zijn
      niet hetzelfde en de omrekening is de plek waar een verhuizing zich
      verraadt: reken je het niet om, dan springt bij iedereen elk oud gesprek
      op ongelezen. Hoe het wel gaat, staat bij leesstandUit() hieronder.

   DE ZAAKSLEUTEL ZIT ER MET OPZET NIET IN. Elke medewerker draagt hem in zijn
   sessie (wie.vanZaak), dus zou hij in een collega-DM staan, dan las het halve
   team mee in een gesprek tussen twee mensen. Een collegagesprek is van de twee
   collega's; de gedeelde inbox van de zaak is een ander ding.

   WAT HIER NIET IN ZIT: de controles. Of de ander echt bij deze zaak op de
   lijst staat, of je een persoonlijke login hebt -- dat blijft in de route
   (routes/staff/collega.js), want dat gaat over personeel en niet over
   berichten. */
'use strict';

const wie = require('./wie');

const MAX_TEKST = 500;   // zoals de oude route hem afkapte

function maakCommCollega({ db, save, comm }) {
  const sleutelVan = (code, staffId) => wie.mens(code, staffId);
  // dezelfde paar-sleutel als de oude opslag, zodat importeer() hem terugvindt
  const oudPaar = (a, b) => (Number(a) < Number(b) ? a + '-' + b : b + '-' + a);

  /* De teller omrekenen naar een tijdstip. `unread[mij] = n` betekende: de
     laatste n berichten VAN DE ANDER heeft mij niet gezien. Dus: loop van
     achteren terug tot je er n van de ander voorbij bent, en zet "gelezen tot"
     op het bericht daarvoor. Staat de teller op nul, dan is alles gelezen.

     Het alternatief -- niets zetten -- lijkt veilig en is het niet: de kern
     telt dan ALLE berichten van de ander als ongelezen, en een gesprek van
     jaren komt binnen als een teller van honderd. */
  function leesstandUit(lijst, mij, ander, aantalOngelezen) {
    const n = Math.max(0, Number(aantalOngelezen) || 0);
    let gezien = 0;
    for (let i = lijst.length - 1; i >= 0; i--) {
      if (lijst[i].van !== ander) continue;
      if (gezien >= n) return lijst[i].at;      // dit las hij nog wel
      gezien++;
    }
    /* De ander heeft minder geschreven dan de teller beweert (of niets). Dan
       is er geen bericht waarop hij bij was, en "gelezen tot" hoort leeg te
       blijven -- alles telt als ongelezen, wat bij een teller die te hoog
       staat de veilige kant is. */
    return null;
  }

  function importeer(gesprek, code, a, b) {
    if (!gesprek || gesprek.meta.oudBinnen) return gesprek;
    gesprek.meta.oudBinnen = new Date().toISOString();
    let oud = null;
    try { oud = ((db.data.collegaChats || {})[code] || {})[oudPaar(a, b)]; } catch (e) {}
    const berichten = (oud && Array.isArray(oud.messages)) ? oud.messages : [];
    if (berichten.length) {
      /* Rechtstreeks in de voorraad van de kern en niet via comm.bericht():
         die zet elk bericht op NU. Een gesprek van twee jaar dat er ineens
         uitziet alsof het vanmiddag gebeurde is geen migratie maar een
         vervalsing, en hij is niet terug te draaien. */
      const lijst = comm.berichtenVan(gesprek.id);
      for (const m of berichten) {
        if (!m || !m.text) continue;
        lijst.push({
          id: 'brc_oud_' + (lijst.length + 1) + '_' + gesprek.id.slice(-6),
          van: sleutelVan(code, m.van), door: null, at: m.at || gesprek.op,
          tekst: String(m.text).slice(0, 4000),
          soort: 'tekst', antwoordOp: null, bijlage: null,
          lang: m.lang || null, reacties: {}
        });
      }
      lijst.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
      const laatste = lijst[lijst.length - 1];
      if (laatste && laatste.at > gesprek.laatst) gesprek.laatst = laatste.at;

      for (const [id, aantal] of Object.entries((oud && oud.unread) || {})) {
        const mij = sleutelVan(code, id), ander = sleutelVan(code, id === String(a) ? b : a);
        const at = leesstandUit(lijst, mij, ander, aantal);
        if (at) comm.leesZet(mij, gesprek.id, at);
      }
      /* Wie GEEN teller had, had niets openstaan -- de oude route wiste de
         teller bij het openen. Die staat dus op "alles gelezen", en zonder deze
         regel zou juist hij een volle badge krijgen na de verhuizing. */
      for (const id of [a, b]) {
        if (((oud && oud.unread) || {})[id] != null) continue;
        if (laatste) comm.leesZet(sleutelVan(code, id), gesprek.id, laatste.at);
      }
    }
    save();
    return gesprek;
  }

  /* Het gesprek tussen twee collega's, met zijn geschiedenis erin. De enige
     ingang: wie een collegabericht wil lezen of schrijven, komt hierlangs. */
  function gesprek(code, a, b) {
    const paar = [sleutelVan(code, a), sleutelVan(code, b)];
    return importeer(comm.tussen(paar[0], paar[1]), code, a, b);
  }

  /* De oude berichtvorm ({ van, naam, text, at }), zodat public/shared/
     collegachat.js en de routes niets merken. `van` blijft het NUMMER en niet
     de sleutel: het scherm vergelijkt hem met het eigen staffId, en dat
     omzetten zou een verhuizing van de opslag zichtbaar maken in de UI. */
  const nummerVan = (sleutel) => { const a = wie.ontleed(sleutel); return a ? a.staffId : null; };
  const oudeVorm = (m, naamVan) => ({
    id: m.id, van: nummerVan(m.van), naam: (naamVan && naamVan(nummerVan(m.van))) || '',
    text: m.tekst || '', at: m.at
  });

  function stuur(code, van, naar, tekst, opties) {
    const o = opties || {};
    const g = gesprek(code, van, naar);
    const m = comm.bericht({ gesprekId: g.id, van: sleutelVan(code, van),
      tekst: String(tekst == null ? '' : tekst).slice(0, MAX_TEKST), lang: o.lang || null });
    return oudeVorm(m, o.naamVan);
  }

  function berichten(code, a, b, hoeveel, naamVan) {
    const g = gesprek(code, a, b);
    const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
    return lijst.slice(-(hoeveel || 100)).map((m) => oudeVorm(m, naamVan));
  }

  function markeerGelezen(code, mij, ander) {
    const g = gesprek(code, mij, ander);
    comm.leesZet(sleutelVan(code, mij), g.id, new Date().toISOString());
    save();
  }

  function ongelezen(code, mij, ander) {
    const g = gesprek(code, mij, ander);
    return comm.gesprek(sleutelVan(code, mij), g.id, { aantal: 500 }).ongelezen;
  }

  function laatste(code, mij, ander) {
    const lijst = comm.berichtenVan(gesprek(code, mij, ander).id).filter((m) => !m.weg);
    const m = lijst[lijst.length - 1];
    return m ? oudeVorm(m) : null;
  }

  return { gesprek, stuur, berichten, markeerGelezen, ongelezen, laatste, oudeVorm, sleutelVan };
}

module.exports = { maakCommCollega };
