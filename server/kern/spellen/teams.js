/* Spellen (deelmodule): teams -- een vaste club om mee te spelen.

   IEDEREEN MAG ER EEN MAKEN. Dat was de keuze, en hij heeft gevolgen die hier
   opgevangen worden en niet in een moderatiewachtrij:

   1. EEN TEAM IS NIET OPENBAAR. Er is geen zoeker, geen lijst, geen
      ontdekpagina. Je ziet een team alleen als je erin zit of ervoor bent
      uitgenodigd. Daarmee is een vrije naam ook geen etalage: hij is te zien
      voor mensen die jou al kennen. Zonder die keuze zou "iedereen mag er een
      maken" betekenen dat iedereen mag PUBLICEREN, en dat is iets anders.
   2. UITNODIGEN KAN ALLEEN IN JE EIGEN KRING -- vrienden en klasgenoten,
      dezelfde kring als een potje. Een team is dus geen nieuwe weg om iemand
      te bereiken die je anders niet kunt bereiken.
   3. JE ZIT ER PAS IN ALS JE JA ZEGT. Een uitnodiging is geen lidmaatschap.

   WAT EEN TEAM NIET HEEFT, en dat is een besluit: een RANGLIJST. Een teamstand
   is per definitie iets dat buiten het potje blijft staan, dus die valt onder
   de progressiegrens -- en dan zou een schoolteam een bord krijgen waarop de
   helft van de leden niet mag staan. Een half bord is erger dan geen bord. Wat
   een team wel doet is samen spelen makkelijk maken: in een tik een potje met
   je club, en verder praat je in dat potje (spellen/praat.js).

   BEWAREN: `spelTeams` staat als gewone lijst in bewaarbeleid.js, op `laatst`
   en niet op `at`. Een team dat gebruikt wordt blijft dus staan; een team waar
   een jaar niets mee gebeurde is geen team meer maar een restant. */
module.exports = (ctx) => {
  const { db, save, rid, nu, codenaamVan, schoon, sociaalRate } = ctx;
  // dezelfde kring als bij het praten in een potje, uit een bron: ./kring.js
  const { bereikbaar } = require('./kring')(ctx);

  const MAX_LEDEN = 12;        // een club om mee te spelen, geen ledenbestand
  const MAX_TEAMS = 8;         // per persoon; anders is "maak er een" een spamknop
  const MAX_NAAM = 40;

  function T() {
    if (!Array.isArray(db.data.spelTeams)) db.data.spelTeams = [];
    return db.data.spelTeams;
  }
  const teamVan = (id) => T().find(t => t.id === String(id || '')) || null;
  const hoortErbij = (t, key) => !!t && (t.leden.includes(key) || t.uitgenodigd.includes(key));
  const inKring = (mij, ander) => bereikbaar(mij, ander);
  // elk gebruik houdt het team levend; zie de kop over `laatst`
  function raak(t) { t.laatst = nu(); }

  function toon(t, mij) {
    return {
      id: t.id, naam: t.naam, at: t.at,
      ik: t.leden.includes(mij) ? 'lid' : 'uitgenodigd',
      baas: t.baas === mij,
      leden: t.leden.map(k => ({ key: k, codenaam: codenaamVan(k), baas: k === t.baas })),
      uitgenodigd: t.uitgenodigd.map(k => ({ codenaam: codenaamVan(k) }))
    };
  }

  /* Een team maken. De naam gaat door dezelfde opschoning als elke andere
     vrije tekst in dit huis; leeg of alleen spaties is geen naam. */
  function teamNieuw(mij, naam, leden) {
    const n = schoon(naam, MAX_NAAM).replace(/\s+/g, ' ').trim();
    if (n.length < 2) return { status: 400, error: 'Geef je team een naam.' };
    if (T().filter(t => t.baas === mij).length >= MAX_TEAMS)
      return { status: 409, error: 'Je hebt al ' + MAX_TEAMS + ' teams. Laat er eerst een los.' };
    if (!sociaalRate(mij, 'spel-team', 10, 3600000)) return { status: 429, error: 'Rustig aan met teams maken.' };

    const nodig = [...new Set((Array.isArray(leden) ? leden : []).map(String))]
      .filter(k => inKring(mij, k)).slice(0, MAX_LEDEN - 1);
    const t = { id: rid(5), naam: n, baas: mij, leden: [mij], uitgenodigd: nodig, at: nu(), laatst: nu() };
    T().push(t);
    save();
    return { status: 200, ok: true, team: toon(t, mij) };
  }

  /* Er meer bij vragen. Alleen de baas, en alleen uit ZIJN kring: anders is
     "nodig jij hem uit" een manier om de kringregel via een ander te omzeilen. */
  function teamNodig(mij, id, leden) {
    const t = teamVan(id);
    if (!t || !t.leden.includes(mij)) return { status: 404, error: 'Dit team bestaat niet (meer).' };
    if (t.baas !== mij) return { status: 403, error: 'Alleen wie het team maakte kan er mensen bij vragen.' };
    const nu_erin = t.leden.length + t.uitgenodigd.length;
    const nodig = [...new Set((Array.isArray(leden) ? leden : []).map(String))]
      .filter(k => inKring(mij, k) && !hoortErbij(t, k))
      .slice(0, Math.max(0, MAX_LEDEN - nu_erin));
    if (!nodig.length) return { status: 400, error: 'Er is niemand om uit te nodigen (vol, of buiten je kring).' };
    t.uitgenodigd.push(...nodig);
    raak(t); save();
    return { status: 200, ok: true, team: toon(t, mij) };
  }

  function teamAntwoord(mij, id, akkoord) {
    const t = teamVan(id);
    if (!t || !t.uitgenodigd.includes(mij)) return { status: 404, error: 'Er ligt geen uitnodiging voor je klaar.' };
    t.uitgenodigd = t.uitgenodigd.filter(k => k !== mij);
    if (akkoord) {
      if (t.leden.length >= MAX_LEDEN) { save(); return { status: 409, error: 'Dit team zit vol.' }; }
      t.leden.push(mij);
      raak(t);
    }
    save();
    return { status: 200, ok: true, lid: !!akkoord };
  }

  /* Weggaan. De baas die vertrekt geeft het team door aan wie er het langst in
     zit; is er niemand meer, dan houdt het team op te bestaan. Een team zonder
     leden laten staan zou een naam reserveren die niemand meer kan opzeggen. */
  function teamVerlaat(mij, id) {
    const t = teamVan(id);
    if (!t || !t.leden.includes(mij)) return { status: 404, error: 'Dit team bestaat niet (meer).' };
    t.leden = t.leden.filter(k => k !== mij);
    if (!t.leden.length) {
      db.data.spelTeams = T().filter(x => x.id !== t.id);
      save();
      return { status: 200, ok: true, opgeheven: true };
    }
    if (t.baas === mij) t.baas = t.leden[0];
    raak(t); save();
    return { status: 200, ok: true, opgeheven: false };
  }

  // je eigen teams plus de uitnodigingen die op je liggen te wachten
  function mijnTeams(mij) {
    const mijne = T().filter(t => t.leden.includes(mij)).map(t => toon(t, mij));
    const gevraagd = T().filter(t => t.uitgenodigd.includes(mij)).map(t => toon(t, mij));
    return { status: 200, teams: mijne, uitnodigingen: gevraagd };
  }

  /* Een lid dat zich laat verwijderen. Zijn sleutel gaat overal uit; was hij de
     baas, dan schuift die door, en een leeg team verdwijnt. */
  function teamVergeet(key) {
    if (!key) return;
    const over = [];
    for (const t of T()) {
      if (!hoortErbij(t, key)) { over.push(t); continue; }
      t.leden = t.leden.filter(k => k !== key);
      t.uitgenodigd = t.uitgenodigd.filter(k => k !== key);
      if (!t.leden.length) continue;              // niemand over: weg ermee
      if (t.baas === key) t.baas = t.leden[0];
      over.push(t);
    }
    db.data.spelTeams = over;
    save();
  }

  return { teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, teamVergeet, _MAX_LEDEN: MAX_LEDEN };
};
