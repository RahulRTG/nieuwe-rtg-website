/* ========= DE SOLLICITATIECHAT VERHUIST NAAR DE KERN =========

   De vierde en laatste grote voorraad (db.data.applyChats). Hij kon als
   laatste, en om een reden die het hele actormodel samenvat: een sollicitant
   is niet altijd een lid. Hij kan ook een PROFIEL BINNEN EEN RTF-GEZIN zijn --
   een jongere die via zijn gezin solliciteert, ingelogd op gezinscode en
   token, zonder ledensleutel en zonder codenaam. Zolang ./wie.js alleen leden,
   zaken en medewerkers kende, kon deze voorraad dus maar half verhuizen, en
   een halve verhuizing is twee voorraden.

   Dezelfde drie regels als bij ./dm.js, ./collega.js en ./gast.js: een gesprek
   per sollicitatie uit de kern, de geschiedenis eenmalig mee op het moment dat
   de sollicitatie toch al wordt geopend, en de oude voorraad blijft staan.

   WAT HIER EIGEN IS:

   1. DE KANT IS EEN WOORD, GEEN NAAM. De oude vorm hield `van` bij als
      'werkgever' of 'sollicitant', en het scherm kleurt de bubbels daarop.
      Klapt dat om, dan lijkt de sollicitant zichzelf te hebben afgewezen.
      Vandaar kantVan(): een deelnemer terug naar dat ene woord.

   2. DE NAAM VAN WIE HET SCHREEF REIST MEE (`wie`). Bij de werkgever is dat de
      medewerker die antwoordde -- dat stond er al zo in en gaat zo mee. Het is
      geen deelnemer en geen codenaam; het is wat er in het bericht stond.

   3. ZONDER SLEUTEL GEEN GESPREK. Wie anoniem solliciteert heeft geen enkele
      sleutel. Dan is er ook geen gesprek, en dat is met opzet: een draad voor
      iemand die je niet kunt bereiken belandt in een lijst waar de werkgever
      wel op antwoordt, en dan praat hij tegen niemand.

   DE RECORD BLIJFT, DE BERICHTEN VERHUIZEN. Anders dan bij het gastcontact
   verdwijnt db.data.applyChats[id] niet: dat is geen berichtenvoorraad maar de
   SCHAKEL tussen een sollicitatie en haar gesprek, en hij draagt wie de
   sollicitant is (lid, gezinsprofiel of anoniem) -- iets wat de aanmeldstroom
   bepaalt en de kern niet kan afleiden. Wat er weg is, is `berichten`: die
   staan alleen nog in de kern. Dat er niets meer bij komt in de oude tak, is
   een eigen toets ("de oude voorraad blijft staan"), zodat een latere hand die
   daar weer in schrijft niet stil een tweede voorraad terugbouwt.

   WAT HIER NIET IN ZIT: de controles. Of dit jouw sollicitatie is, of je bij
   die zaak hoort, de vertaling per kijker, de melding aan de werkgever -- dat
   blijft in kern/werk.js en de routes eromheen. Die gaan over werk en niet
   over berichten. */
'use strict';

const wie = require('./wie');

const MAX_TEKST = 1000;     // zoals kern/werk.js hem afkapte

function maakCommWerk({ db, save, comm }) {
  const chatVan = (id) => {
    try { return (db.data.applyChats || {})[String(id)] || null; } catch (e) { return null; }
  };

  /* De sleutel van de sollicitant. Twee vormen, en de vorm bepaalt wie het is
     -- niet een veld dat de aanroeper meegeeft. */
  function sollicitantVan(chat) {
    const a = chat && chat.applicant;
    if (!a) return null;
    if (a.kind === 'rtg' && a.key) return String(a.key);
    if (a.kind === 'rtf' && a.gezinCode && a.profielId != null) return wie.gezin(a.gezinCode, a.profielId);
    return null;                        // anoniem: geen in-app chat
  }
  const werkgeverVan = (chat) => (chat && chat.supplierCode ? wie.zaak(chat.supplierCode) : null);

  const kantVan = (m, sollicitant) => (m.van === sollicitant ? 'sollicitant' : 'werkgever');
  const oudeVorm = (m, sollicitant) => ({
    id: m.id, van: kantVan(m, sollicitant), wie: m.who || '',
    tekst: m.tekst || '', lang: m.lang || null, at: m.at
  });

  function importeer(gesprek, chat, sollicitant) {
    if (!gesprek || gesprek.meta.oudBinnen) return gesprek;
    gesprek.meta.oudBinnen = new Date().toISOString();
    const berichten = Array.isArray(chat.berichten) ? chat.berichten : [];
    if (berichten.length) {
      /* Rechtstreeks in de voorraad van de kern en niet via comm.bericht():
         die zet elk bericht op NU. Een sollicitatie van vorig jaar die eruit
         ziet alsof hij vanmiddag liep is geen migratie maar een vervalsing --
         en bij een sollicitatie is de datum ook nog eens het halve verhaal. */
      const lijst = comm.berichtenVan(gesprek.id);
      const werkgever = werkgeverVan(chat);
      for (const m of berichten) {
        if (!m || !m.tekst) continue;
        lijst.push({
          id: 'brc_oud_' + (lijst.length + 1) + '_' + gesprek.id.slice(-6),
          van: m.van === 'sollicitant' ? sollicitant : werkgever, door: null,
          at: m.at || gesprek.op,
          tekst: String(m.tekst).slice(0, 4000), soort: 'tekst',
          who: m.wie || '', antwoordOp: null, bijlage: null,
          lang: m.lang || null, reacties: {}
        });
      }
      lijst.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
      const laatste = lijst[lijst.length - 1];
      if (laatste && laatste.at > gesprek.laatst) gesprek.laatst = laatste.at;
      /* De oude vorm hield GEEN leesstand bij -- er was geen ongelezen-teller
         op een sollicitatiechat. Er valt hier dus niets om te rekenen, en dat
         staat er als opmerking en niet als lege lus: "hier hoort niets" is
         iets anders dan "hier is iets vergeten". */
    }
    save();
    return gesprek;
  }

  /* Het gesprek bij een sollicitatie. De enige ingang; null als er niemand is
     om mee te praten (anoniem) of als de sollicitatie niet bestaat. */
  function gesprek(id) {
    const chat = chatVan(id);
    if (!chat) return null;
    const sollicitant = sollicitantVan(chat), werkgever = werkgeverVan(chat);
    if (!sollicitant || !werkgever) return null;
    const g = comm.gesprekMaak({
      soort: 'business', deelnemers: [sollicitant, werkgever], door: sollicitant,
      meta: { sleutel: 'werk:' + chat.id, zaak: String(chat.supplierCode || '').toUpperCase(),
        bron: 'Werk', func: chat.func || null, bedrijf: chat.bedrijf || null,
        metWie: (chat.applicant && chat.applicant.naam) || null }
    });
    return importeer(g, chat, sollicitant);
  }

  function berichten(id, hoeveel) {
    const chat = chatVan(id);
    const g = gesprek(id);
    if (!g) return [];
    const sollicitant = sollicitantVan(chat);
    return comm.berichtenVan(g.id).filter((m) => !m.weg)
      .slice(-(hoeveel || 200)).map((m) => oudeVorm(m, sollicitant));
  }

  /* Sturen. `van` is het WOORD ('werkgever' of 'sollicitant') zoals de oude
     kern/werk.js hem kreeg, zodat de aanroepers ongewijzigd blijven; hier
     wordt het een deelnemer. */
  function stuur(id, van, wieSchreef, tekst, lang) {
    const chat = chatVan(id);
    const g = gesprek(id);
    if (!g) return null;
    const t = String(tekst == null ? '' : tekst).trim().slice(0, MAX_TEKST);
    if (!t) return null;
    const sollicitant = sollicitantVan(chat);
    const m = comm.bericht({ gesprekId: g.id,
      van: van === 'sollicitant' ? sollicitant : werkgeverVan(chat), tekst: t, lang: lang || 'nl' });
    if (wieSchreef) { m.who = String(wieSchreef).slice(0, 60); save(); }
    return oudeVorm(m, sollicitant);
  }

  /* ---------------------------------------------------- de lijsten

     Zelfde valkuil als bij het gastcontact (./gast.js): een lijst die uit de
     kern komt ziet alleen wat al verhuisd is, en de lijst is de manier om een
     gesprek te openen. Zonder binnenhalen staat de sollicitatielijst op de dag
     van de verhuizing leeg. Begrensd tot deze sollicitant of deze zaak, dus
     nog steeds een verhuizing op aanraking. */
  function haalBinnen(filter) {
    let oud = null;
    try { oud = db.data.applyChats || {}; } catch (e) { return; }
    for (const [id, chat] of Object.entries(oud)) {
      if (!chat || !filter(chat)) continue;
      gesprek(id);
    }
  }

  function rij(chat, g) {
    const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
    const laatste = lijst[lijst.length - 1] || null;
    return { id: chat.id, gesprekId: g.id, func: chat.func || null,
      bedrijf: chat.bedrijf || null, supplierCode: chat.supplierCode || null,
      metWie: (chat.applicant && chat.applicant.naam) || null,
      laatste: laatste ? String(laatste.tekst || '').slice(0, 80) : null,
      laatsteVan: laatste ? kantVan(laatste, sollicitantVan(chat)) : null,
      at: g.laatst || chat.at || null };
  }

  function voorSollicitant(sleutel) {
    haalBinnen((c) => sollicitantVan(c) === String(sleutel));
    const uit = [];
    for (const g of comm.inbox(String(sleutel), {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Werk') continue;
      const chat = chatVan(String(kern.meta.sleutel).replace(/^werk:/, ''));
      if (chat) uit.push(rij(chat, kern));
    }
    return uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }

  function voorZaak(code) {
    const c = String(code || '').trim().toUpperCase();
    haalBinnen((chat) => String(chat.supplierCode || '').toUpperCase() === c);
    const uit = [];
    for (const g of comm.inbox(wie.zaak(c), {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Werk') continue;
      const chat = chatVan(String(kern.meta.sleutel).replace(/^werk:/, ''));
      if (chat) uit.push(Object.assign(rij(chat, kern), { ongelezen: g.ongelezen }));
    }
    return uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }

  return { gesprek, berichten, stuur, oudeVorm, sollicitantVan, werkgeverVan,
    voorSollicitant, voorZaak };
}

module.exports = { maakCommWerk };
