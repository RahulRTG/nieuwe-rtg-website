/* Sparren (deelmodule van kern/fluister): Rahul denkt met je mee.

   Twee dingen:
   1. De sparhouding. Rahul spart met iedereen, maar NIET om zijn gelijk te
      halen: hij helpt het idee beter te maken. Deze houding reist mee in de
      systeemprompt en in de eigen (canned) antwoorden.
   2. Terugkomen op een rustig moment. Zeg je iets terwijl je druk bent, dan
      parkeert Rahul het. Ziet de halfuurlijkse ronde dat je rustig thuis bent
      (niet onderweg) en niets meer op je agenda hebt staan vandaag, dan kaart
      hij het zelf nog een keer aan: "je noemde laatst X, zullen we er even over
      sparren?". Rustig, nooit zeurend (een koeling per onderwerp), en je kunt
      elk onderwerp als besproken of weg zetten.

   De opslag hangt aan het fluister-profiel van het lid (p.spar), dus het is
   privacy-by-design van de gebruiker zelf en wist mee met "vergeet alles". */
module.exports = (ctx) => {
  const { db, save, schoon, notify, van, nu } = ctx;
  const MAX = 40;
  const KOELING_MS = 20 * 60 * 60 * 1000; // hooguit ~eens per dag hetzelfde onderwerp

  function ruw(key) { const p = van(key); if (!Array.isArray(p.spar)) p.spar = []; return p.spar; }
  const pub = t => ({ id: t.id, tekst: t.tekst, bron: t.bron, at: t.at, getoond: t.getoond || 0 });
  function openLijst(key) { return ruw(key).filter(t => t.status === 'open').map(pub); }

  // de sparhouding: waar Rahul voor staat als hij meedenkt.
  function sparHouding() {
    return 'Je spart mee om het idee samen beter te maken, niet om je gelijk te halen. ' +
      'Bouw voort op wat de ander zegt, stel een scherpe vraag, benoem een kans en een risico, ' +
      'en laat de keuze altijd bij de ander. Kort en concreet, nooit belerend.';
  }

  // parkeer een gedachte om er later op terug te komen. Idempotent: dezelfde
  // open tekst niet twee keer.
  function parkeer(key, tekstIn, bron) {
    const tekst = schoon(tekstIn, 240);
    if (!tekst) return { status: 400, error: 'Waar wil je later over sparren? Vertel het in een zin.' };
    const arr = ruw(key);
    if (arr.some(t => t.status === 'open' && t.tekst.toLowerCase() === tekst.toLowerCase()))
      return { ok: true, spar: openLijst(key) };
    arr.unshift({
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      tekst, bron: schoon(bron, 40) || 'gesprek', status: 'open', at: nu(), laatst: null, getoond: 0
    });
    while (arr.length > MAX) arr.pop();
    save();
    return { ok: true, spar: openLijst(key) };
  }

  function lijst(key) { return { ok: true, spar: openLijst(key), houding: sparHouding() }; }

  function status(key, id, st) {
    const arr = ruw(key);
    const t = arr.find(x => x.id === id);
    if (!t) return { status: 404, error: 'Dat spar-onderwerp ken ik niet (meer).' };
    if (st === 'weg') arr.splice(arr.indexOf(t), 1);
    else t.status = 'besproken';
    save();
    return { ok: true, spar: openLijst(key) };
  }

  // rustig thuis + niks meer op de agenda + een net moment op de dag
  function rustMoment(key, nuDate) {
    const d = nuDate || new Date();
    const uur = d.getHours();
    if (uur < 9 || uur > 22) return false;                 // geen nachtelijke pings
    const L = (db.data.live || {})[key];
    if (L && L.active) return false;                        // onderweg is niet "rustig thuis"
    const dag = d.toISOString().slice(0, 10);
    const items = (db.data.agendas || {})['lid:' + key] || [];
    if (items.some(i => !i.gedaan && String(i.datum) === dag)) return false; // vandaag nog iets te doen
    return true;
  }

  // het terugkomen: hooguit een onderwerp per ronde, met een koeling, en alleen
  // als het rustig is. Het oudste open onderwerp gaat voor.
  function sweepVoor(key, nuDate) {
    if (String(key).startsWith('staff:') || !notify) return 0;
    const open = ruw(key).filter(t => t.status === 'open');
    if (!open.length || !rustMoment(key, nuDate)) return 0;
    const d = nuDate || new Date();
    const due = open.filter(t => !t.laatst || (d.getTime() - Date.parse(t.laatst)) > KOELING_MS);
    if (!due.length) return 0;
    const t = due[due.length - 1]; // het langst geleden geparkeerde onderwerp eerst
    t.laatst = d.toISOString();
    t.getoond = (t.getoond || 0) + 1;
    notify(key, { icon: '💭', title: 'Rahul', body: 'Je zei laatst iets toen je het druk had: "' + t.tekst + '". Je bent nu rustig thuis en je agenda is leeg. Zullen we er even samen over sparren?', scope: 'fluister' });
    save();
    return 1;
  }

  function sweepAlle(nuDate) {
    let n = 0;
    for (const k of Object.keys(db.data.fluister || {})) { try { n += sweepVoor(k, nuDate); } catch (e) {} }
    return { ok: true, aangekaart: n };
  }

  return { parkeer, lijst, status, sparHouding, rustMoment, sweepVoor, sweepAlle, openLijst };
};
