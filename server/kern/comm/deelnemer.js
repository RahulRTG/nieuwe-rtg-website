/* Wat een DEELNEMER met een gesprek doet nadat het bericht er staat.

   De kern valt in drieën uiteen, en dit is de derde. ./index.js legt vast wat
   er IS: een gesprek, een bericht, wie erin zit. ./tonen.js vertaalt dat naar
   wat EEN KIJKER ziet. En hier staat alles wat een deelnemer daarna nog doet:
   een tikfout herstellen, een bericht intrekken, een duim geven, iets als
   gelezen wegzetten, vastzetten, stilzetten, een concept bewaren, laten weten
   dat je typt, en porren.

   Die dingen horen bij elkaar omdat ze allemaal DEZELFDE vorm hebben: een
   deelnemer, een gesprek waar hij in moet zitten (eis), een kleine wijziging,
   opslaan, en een sein naar de rest. Ze staan hier bij elkaar zodat je die
   vorm een keer kunt nalopen in plaats van hem tussen de opslagcode door te
   moeten zoeken.

   Deze laag legt de grenzen vast die van de MENS zijn en niet van de opslag:
   een kwartier om te corrigeren, een por per minuut, een reactie van hoogstens
   een teken. Ze staan met hun reden erbij, want dat zijn de getallen waar
   iemand later aan gaat draaien. */
'use strict';

const VLAGGEN = ['vast', 'stil', 'weg'];
const WIJZIG_MS = 15 * 60000;   // een correctie mag een kwartier lang
const TYPT_MS = 6000;           // "typt..." vervalt vanzelf
const AANWEZIG_MS = 45000;      // zo lang geldt een teken van leven als online
const NUDGE_MS = 60000;         // een por per minuut per gesprek

function maakDeelnemer(binnen) {
  const { B, eis, nu, save, seinNaarDeRest, standZet, standVan, noem, MAX_TEKST } = binnen;

  /* Aanwezigheid en "typt..." staan MET OPZET NIET in de database. Ze zijn
     seconden geldig en zouden bij elke toetsaanslag een schrijfronde kosten;
     na een herstart is "wie is er online" bovendien per definitie onbekend.
     Een Map in het geheugen is hier de eerlijke opslag. */
  const aanwezig = new Map();   // key -> ms
  const typt = new Map();       // gesprekId -> Map(key -> ms)
  const nudges = new Map();     // key|gesprekId -> ms

  const berichtVan = (g, berichtId) => {
    const m = (B()[g.id] || []).find((x) => x.id === berichtId);
    if (!m) throw new Error('Dat bericht bestaat niet.');
    return m;
  };

  /* ------------------------------------------- wijzigen, wissen, reageren */
  /* Een correctie binnen een kwartier, en daarna niet meer. De oorspronkelijke
     tekst blijft in `was` staan: "bewerkt" zonder te kunnen zien wat er stond
     is een uitnodiging om een gesprek achteraf te herschrijven. */
  function wijzig(key, gesprekId, berichtId, tekst) {
    const g = eis(gesprekId, key);
    const m = berichtVan(g, berichtId);
    if (m.van !== key) throw new Error('Je kunt alleen je eigen bericht wijzigen.');
    if (m.weg) throw new Error('Dit bericht is ingetrokken.');
    if (Date.now() - Date.parse(m.at) > WIJZIG_MS) throw new Error('Dit bericht is te oud om nog te wijzigen.');
    const nieuw = String(tekst || '').slice(0, MAX_TEKST).trim();
    if (!nieuw) throw new Error('Een bericht leegmaken is intrekken, niet wijzigen.');
    m.was = m.was || m.tekst;
    m.tekst = nieuw;
    m.gewijzigd = nu();
    save();
    seinNaarDeRest(g, key, 'wijzig', { gesprekId: g.id, berichtId: m.id });
    return m;
  }

  /* Intrekken laat een spoor achter, en dat is met opzet: de andere kant heeft
     het gelezen, en doen alsof er nooit iets stond is liegen tegen wie erbij
     was. Wat weg is, is de inhoud. */
  function wis(key, gesprekId, berichtId) {
    const g = eis(gesprekId, key);
    const m = berichtVan(g, berichtId);
    if (m.van !== key) throw new Error('Je kunt alleen je eigen bericht intrekken.');
    m.weg = nu(); m.tekst = null; m.bijlage = null; m.was = null; m.reacties = {};
    save();
    seinNaarDeRest(g, key, 'wis', { gesprekId: g.id, berichtId: m.id });
    return m;
  }

  function reactie(key, gesprekId, berichtId, teken) {
    const g = eis(gesprekId, key);
    const m = berichtVan(g, berichtId);
    if (m.weg) throw new Error('Dit bericht is ingetrokken.');
    // een reactie is een teken, geen zin: langer dan dat is een bericht
    const t = String(teken || '').slice(0, 8);
    if (!t) throw new Error('Welke reactie?');
    m.reacties = m.reacties || {};
    const wie = m.reacties[t] = m.reacties[t] || [];
    const i = wie.indexOf(key);
    if (i >= 0) wie.splice(i, 1); else wie.push(key);   // nog een tik haalt hem weg
    if (!wie.length) delete m.reacties[t];
    save();
    seinNaarDeRest(g, key, 'reactie', { gesprekId: g.id, berichtId: m.id });
    return m.reacties;
  }

  /* ------------------------------------------------------ standen */
  function lees(key, gesprekId) {
    const g = eis(gesprekId, key);
    standZet(key, g.id, 'gelezen', nu());
    save();
    seinNaarDeRest(g, key, 'gelezen', { gesprekId: g.id, wie: noem(key) });
    return standVan(key, g.id);
  }
  function vlag(key, gesprekId, welke, aan) {
    if (!VLAGGEN.includes(welke)) throw new Error('Onbekende vlag.');
    eis(gesprekId, key);
    const st = standZet(key, gesprekId, welke, !!aan || null);
    save();
    return st;
  }
  /* Het concept reist mee tussen apparaten. Een half getypt bericht dat weg is
     omdat je van telefoon naar laptop wisselde, is precies het soort verlies
     dat je niet aan de app vergeeft. */
  function concept(key, gesprekId, tekst) {
    eis(gesprekId, key);
    const st = standZet(key, gesprekId, 'concept', String(tekst || '').slice(0, MAX_TEKST) || null);
    save();
    return st;
  }

  /* -------------------------------------------- aanwezigheid en typen */
  function levensteken(key) { aanwezig.set(key, Date.now()); }
  const isAanwezig = (key) => (Date.now() - (aanwezig.get(key) || 0)) < AANWEZIG_MS;
  function typtNu(key, gesprekId) {
    const g = eis(gesprekId, key);
    levensteken(key);
    const m = typt.get(g.id) || new Map();
    m.set(key, Date.now());
    typt.set(g.id, m);
    seinNaarDeRest(g, key, 'typt', { gesprekId: g.id, wie: noem(key) });
    return true;
  }
  function wieTypt(gesprekId, behalve) {
    const m = typt.get(gesprekId);
    if (!m) return [];
    const uit = [];
    for (const [key, t] of m) {
      if (Date.now() - t > TYPT_MS) { m.delete(key); continue; }
      if (key === behalve) continue;
      uit.push(noem(key));
    }
    return uit.filter(Boolean);
  }

  /* ------------------------------------------------------------- nudge */
  /* De buzz van MSN, en de reden dat hij hier mag staan is dat hij iets kan wat
     een bericht niet kan: door "stil" heen komen. Precies daarom is hij ook
     begrensd -- een aandachtsknop zonder rem is een pestknop. Een per minuut
     per gesprek, en alleen in een gesprek waar de ander je al kent. */
  function nudge(key, gesprekId) {
    const g = eis(gesprekId, key);
    const s = key + '|' + gesprekId;
    const laatst = nudges.get(s) || 0;
    if (Date.now() - laatst < NUDGE_MS) {
      throw new Error('Even wachten -- een por mag een keer per minuut.');
    }
    nudges.set(s, Date.now());
    seinNaarDeRest(g, key, 'nudge', { gesprekId: g.id, wie: noem(key) });
    return true;
  }

  return {
    wijzig, wis, reactie,
    lees, vlag, concept,
    levensteken, isAanwezig, typtNu, wieTypt, nudge
  };
}

module.exports = { VLAGGEN, WIJZIG_MS, TYPT_MS, AANWEZIG_MS, NUDGE_MS, maakDeelnemer };
