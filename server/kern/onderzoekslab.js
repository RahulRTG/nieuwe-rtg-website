/* Het RTG Onderzoekslab (kern/onderzoekslab): een groot, modern onderzoeks- en
   ontwikkellab voor RTG en de RTFoundation samen. Hier wordt hardware en
   software ontwikkeld, geplend hoe we een heel dorp kunnen helpen, onderzoek
   gedaan naar het boeren, naar energie en water, en zelfs onderzoek naar
   onderzoek (meta: hoe leren we sneller en eerlijker).

   Toekomstbestendig en veilig door ontwerp:
   - elke stap doorloopt de vaste fase-keten idee > onderzoek > prototype >
     proef > uitrol; niets slaat een fase over
   - voor de proef- en uitrolfase is een veiligheids- en ethiektoets nodig,
     en die toets zet ALTIJD een mens op akkoord, met naam; de AI adviseert
   - schadelijke richtingen (wapens en verwanten) weigert het lab hard
   - afgeronde kennis verdwijnt nooit: bevindingen stromen naar de kennisbank
   Opslag: db.data.labProjecten. De AI-onderzoekscoach staat in ./onderzoekslab-ai.js. */

const VELDEN = {
  hardware: { naam: 'Hardware', emoji: '🔩' }, software: { naam: 'Software', emoji: '💻' },
  dorp: { naam: 'Dorpshulp (een heel dorp helpen)', emoji: '🏘️' }, meta: { naam: 'Onderzoek naar onderzoek', emoji: '🔁' },
  landbouw: { naam: 'Boeren & landbouw', emoji: '🌾' }, energie: { naam: 'Energie', emoji: '⚡' },
  water: { naam: 'Water', emoji: '💧' }, zorg: { naam: 'Zorg & gezondheid', emoji: '🩺' },
  onderwijs: { naam: 'Onderwijs', emoji: '📚' }
};
const FASEN = ['idee', 'onderzoek', 'prototype', 'proef', 'uitrol', 'archief'];
const VERBODEN = ['wapen', 'wapens', 'munitie', 'explosief', 'explosieven', 'biowapen', 'gifgas'];

module.exports = ({ db, save, crypto, anthropic }) => {
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const rid = () => crypto.randomBytes(4).toString('hex');
  const P = () => { if (!Array.isArray(db.data.labProjecten)) db.data.labProjecten = []; return db.data.labProjecten; };
  const vind = id => P().find(p => p.id === String(id || ''));
  const fout = tekst => { const laag = tekst.toLowerCase(); return VERBODEN.some(w => laag.includes(w)); };

  const beeld = p => ({ id: p.id, titel: p.titel, veld: p.veld, veldNaam: (VELDEN[p.veld] || {}).naam,
    voorWie: p.voorWie, doel: p.doel, fase: p.fase, budget: p.budget, veiligheid: p.veiligheid,
    team: p.team || [],
    logboek: (p.logboek || []).slice(0, 30), bevindingen: p.bevindingen || [], at: p.at });

  /* Bedrijfsgeheimen: het werk van personeel in het lab is besloten. Alleen wie
     ERAAN werkt (op het team van het project) ziet het project; de RTG-boardroom
     ziet ALLES (RTG- en RTF-werk). Een viewer is { key, boardroom }. */
  function magZien(p, viewer) {
    if (!viewer) return false;
    if (viewer.boardroom) return true;
    return !!viewer.key && (p.team || []).includes(viewer.key);
  }
  function overzicht(lijst) {
    const L = lijst || P();
    const perVeld = Object.keys(VELDEN).map(v => ({ veld: v, naam: VELDEN[v].naam, emoji: VELDEN[v].emoji,
      aantal: L.filter(p => p.veld === v).length }));
    const perFase = {};
    for (const f of FASEN) perFase[f] = L.filter(p => p.fase === f).length;
    return { ok: true, velden: perVeld, fasen: FASEN.slice(0, 5), perFase,
      toetsOpen: L.filter(p => (p.veiligheid || {}).status === 'open').length,
      kennisbank: L.reduce((s, p) => s + (p.bevindingen || []).length, 0),
      projecten: L.slice(0, 100).map(beeld) };
  }
  // het overzicht zoals EEN kijker het mag zien (team + boardroom)
  function overzichtVoor(viewer) { return overzicht(P().filter(p => magZien(p, viewer))); }
  // het team van een project bijwerken (de mensen die eraan werken, op sleutel)
  function teamZet(id, keys) {
    const p = vind(id); if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    p.team = (Array.isArray(keys) ? keys : []).map(k => schoon(k, 80)).filter(Boolean).slice(0, 50);
    p.logboek.unshift({ id: rid(), tekst: 'Team bijgewerkt (' + p.team.length + ' personen).', wie: 'lab', at: nu() });
    save();
    return { ok: true, project: beeld(p) };
  }
  function projectMaak(b, makerKey) {
    b = b || {};
    const titel = schoon(b.titel, 100), doel = schoon(b.doel, 400);
    if (titel.length < 3) return { status: 400, error: 'Geef het project een duidelijke titel.' };
    if (!VELDEN[b.veld]) return { status: 400, error: 'Kies een onderzoeksveld.' };
    if (fout(titel + ' ' + doel)) return { status: 400, error: 'Dit lab onderzoekt nooit wapens of andere schadelijke richtingen. Dat is een principe, geen instelling.' };
    if (P().length >= 2000) return { status: 400, error: 'Het lab zit vol; archiveer eerst afgeronde projecten.' };
    const voorWie = ['rtg', 'rtf', 'samen'].includes(b.voorWie) ? b.voorWie : 'samen';
    const p = { id: rid(), titel, veld: b.veld, voorWie, doel, fase: 'idee',
      budget: Math.max(0, Math.min(10000000, Math.round(Number(b.budget) || 0))),
      team: makerKey ? [String(makerKey)] : [],
      veiligheid: { status: 'open', door: null, om: null, notitie: '' },
      logboek: [{ id: rid(), tekst: 'Project gestart in het veld ' + VELDEN[b.veld].naam + '.', wie: 'lab', at: nu() }],
      bevindingen: [], at: nu() };
    P().unshift(p); save();
    return { ok: true, project: beeld(p) };
  }
  /* De fase-keten: altijd een stap tegelijk, nooit een fase overslaan, en de
     poort naar proef/uitrol gaat alleen open na het menselijke veiligheidsakkoord. */
  function faseZet(id, fase) {
    const p = vind(id); if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    if (!FASEN.includes(fase)) return { status: 400, error: 'Kies een geldige fase.' };
    if (fase !== 'archief') {
      const van = FASEN.indexOf(p.fase), naar = FASEN.indexOf(fase);
      if (naar !== van + 1) return { status: 400, error: 'Het lab slaat nooit een fase over: van ' + p.fase + ' kan alleen naar ' + (FASEN[van + 1] || 'archief') + '.' };
      if ((fase === 'proef' || fase === 'uitrol') && (p.veiligheid || {}).status !== 'akkoord')
        return { status: 409, error: 'Eerst de veiligheids- en ethiektoets: een mens zet die op akkoord, dan pas de ' + fase + '.' };
    }
    p.fase = fase;
    p.logboek.unshift({ id: rid(), tekst: 'Fase gewijzigd naar ' + fase + '.', wie: 'lab', at: nu() });
    save();
    return { ok: true, project: beeld(p) };
  }
  function veiligheidZet(id, b) {
    const p = vind(id); if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    b = b || {};
    if (!['akkoord', 'afgewezen', 'open'].includes(b.status)) return { status: 400, error: 'Kies akkoord, afgewezen of open.' };
    const door = schoon(b.door, 60);
    if (b.status !== 'open' && door.length < 2) return { status: 400, error: 'De toets draagt altijd de naam van de mens die beslist.' };
    p.veiligheid = { status: b.status, door: door || null, om: nu(), notitie: schoon(b.notitie, 300) };
    p.logboek.unshift({ id: rid(), tekst: 'Veiligheids- en ethiektoets: ' + b.status + (door ? ' door ' + door : '') + '.', wie: 'mens', at: nu() });
    save();
    return { ok: true, project: beeld(p) };
  }
  function logMaak(id, tekst, wie) {
    const p = vind(id); if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const t = schoon(tekst, 300); if (!t) return { status: 400, error: 'Een leeg logboek-regeltje heeft geen zin.' };
    p.logboek.unshift({ id: rid(), tekst: t, wie: schoon(wie, 60) || 'lab', at: nu() });
    if (p.logboek.length > 200) p.logboek.pop();
    save();
    return { ok: true, project: beeld(p) };
  }
  function bevindingMaak(id, titel, tekst) {
    const p = vind(id); if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const t = schoon(titel, 100); if (t.length < 3) return { status: 400, error: 'Geef de bevinding een titel.' };
    p.bevindingen.unshift({ id: rid(), titel: t, tekst: schoon(tekst, 600), at: nu() });
    if (p.bevindingen.length > 50) p.bevindingen.pop();
    save();
    return { ok: true, project: beeld(p) };
  }
  /* De kennisbank: alle bevindingen uit het hele lab, ook uit het archief;
     kennis verdwijnt hier nooit. */
  function kennisbank() {
    const uit = [];
    for (const p of P()) for (const b of p.bevindingen || [])
      uit.push({ project: p.titel, veld: (VELDEN[p.veld] || {}).naam, fase: p.fase, titel: b.titel, tekst: b.tekst, at: b.at });
    uit.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { ok: true, totaal: uit.length, bevindingen: uit.slice(0, 200) };
  }

  const labAI = require('./onderzoekslab-ai')({ anthropic, schoon, P, VELDEN });
  return { lab: { overzicht, overzichtVoor, teamZet, projectMaak, faseZet, veiligheidZet, logMaak, bevindingMaak, kennisbank, labAI, VELDEN, FASEN } };
};
