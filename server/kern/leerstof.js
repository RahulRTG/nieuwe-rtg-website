/* RTG School, de leerstof-motor: van leerlijn naar les naar oefenen.

   De leerlijnen (data) staan in ./leerstof-data/, de opgave-generatoren in
   ./leerstof-gen.js. Dit deel is de stroom: welke vakken horen bij jouw
   groep, de les in gewone taal, en de oefensessie van vijf verse opgaven.
   Server-authoritatief: de antwoorden blijven hier, de client krijgt alleen
   de vraag. Haal je vier van de vijf, dan wordt het leerdoel in je
   leerpaspoort bijgeschreven (kern/onderwijs.js). Er zijn bewust geen
   scores buiten de sessie, geen reeksen en geen ranglijsten: leren is geen
   wedstrijd, en een fout is gewoon de volgende stap in de les. */
const { opgave } = require('./leerstof-gen');
const { DOELEN, PER_GROEP, PER_FASE } = require('./leerstof-bibliotheek');
/* De graaflaag (voorkennis, uitlegvormen, meting, de keuring en het pad naar
   een doel) staat in ./leerstof-fabric.js; hij bezit de doelen niet, dus die
   komen er hier bij. */
const { UITLEG_SOORTEN, STANDAARD_METING, keurLeerstof, pad: fabricPad } = require('./leerstof-fabric');
/* De Memory Engine: wat een leerling dreigt te vergeten komt terug als drie
   korte vragen. De planning staat in kern/onderwijs-geheugen.js, de vragen in
   ./leerstof-herhalen.js -- en die lopen met opzet door dezelfde antwoordweg
   als een gewone oefensessie. */
const { maakHerhalen } = require('./leerstof-herhalen');
const pad = (doelId, behaald) => fabricPad(doelId, behaald, DOELEN);


function maakLeerstof({ db, save, onderwijs }) {
  const nu = () => new Date().toISOString();

  function sessies() {
    if (!db.data.leerstofSessies || typeof db.data.leerstofSessies !== 'object') db.data.leerstofSessies = {};
    return db.data.leerstofSessies;
  }
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---- de leerlijn voor een groep: wat leer je hier, en wat heb je al ---- */
  function vakken(key, d) {
    // per fase (vmbo t/m wo) of per groep (1 t/m 8): zelfde antwoordvorm
    const fase = String(d && d.fase || '').trim();
    if (fase) {
      if (!PER_FASE[fase]) return { status: 400, error: 'Voor deze fase is er (nog) geen leerlijn.' };
      const behaaldF = (onderwijs.mijn(key).doelen) || {};
      const perVakF = {};
      for (const id of PER_FASE[fase]) {
        const doel = DOELEN[id];
        perVakF[doel.vak] = perVakF[doel.vak] || [];
        perVakF[doel.vak].push({ id, naam: doel.naam, ref: doel.ref || null, behaald: !!behaaldF[id] });
      }
      return { ok: true, fase, vakken: Object.entries(perVakF).map(([vak, doelen]) => ({ vak, doelen })) };
    }
    const groep = Number(String(d && d.groep || '').replace(/\D/g, ''));
    if (!PER_GROEP[groep]) return { status: 400, error: 'Kies een groep van 1 tot en met 8, of een fase uit de ladder.' };
    const pas = onderwijs.mijn(key);
    const behaald = (pas.doelen) || {};
    const perVak = {};
    for (const id of PER_GROEP[groep]) {
      const doel = DOELEN[id];
      perVak[doel.vak] = perVak[doel.vak] || [];
      perVak[doel.vak].push({ id, naam: doel.naam, ref: doel.ref || null, behaald: !!behaald[id] });
    }
    return { ok: true, groep, vakken: Object.entries(perVak).map(([vak, doelen]) => ({ vak, doelen })) };
  }

  function les(key, d) {
    const doel = DOELEN[String(d && d.doel || '')];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    const behaald = key ? ((onderwijs.mijn(key).doelen) || {}) : {};
    const onder = pad(doel.id, behaald).filter(x => x.id !== doel.id);
    return { ok: true, doel: { id: doel.id, naam: doel.naam, vak: doel.vak, groep: doel.groep, les: doel.les, ref: doel.ref || null,
      /* Andere uitleg van HETZELFDE doel. Het leerdoel verandert niet; de weg
         ernaartoe wel. Wie de eerste uitleg niet snapt, is niet geholpen met
         diezelfde uitleg nog een keer. */
      uitleg: (doel.uitleg || []).map(u => ({ soort: u.soort, tekst: u.tekst })),
      meting: doel.meting || STANDAARD_METING },
      voorkennis: onder,
      ontbreekt: onder.filter(x => !x.behaald),
      /* Zonder voorkennis-informatie zou dit veld liegen; daarom zegt hij het
         zelf als er niets onder ligt. */
      let: onder.length ? null : 'Voor dit leerdoel staat (nog) geen voorkennis in de leerlijn.' };
  }

  const { herhaalLijst, herhaalStart, herhaalKlaar } =
    maakHerhalen({ onderwijs, sessies, save, opgave, DOELEN, nu });

  /* ---- oefenen: vijf verse opgaven, een tegelijk, antwoorden op de server ---- */
  function oefenStart(key, d) {
    const doel = DOELEN[String(d && d.doel || '')];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    const meting = doel.meting || STANDAARD_METING;
    const vragen = [];
    for (let i = 0; i < meting.opgaven; i++) vragen.push(opgave(doel.gen));
    sessies()['lid:' + key] = { doel: doel.id, vragen, ix: 0, goed: 0, drempel: meting.drempel, at: nu() };
    save();
    const v = vragen[0];
    return { ok: true, doel: doel.id, naam: doel.naam, totaal: meting.opgaven, nr: 1, vraag: v.v, opties: v.opties || null };
  }

  function oefenAntwoord(key, d) {
    const s = sessies()['lid:' + key];
    if (!s) return { status: 400, error: 'Begin eerst een oefensessie.' };
    const vraag = s.vragen[s.ix];
    if (!vraag) return { status: 400, error: 'Deze sessie is al klaar; begin een nieuwe.' };
    const goed = norm(d && d.antwoord) === norm(vraag.a);
    if (goed) s.goed += 1;
    s.ix += 1;
    const klaar = s.ix >= s.vragen.length;
    const uit = { ok: true, goed, juisteAntwoord: vraag.a, nr: s.ix, totaal: s.vragen.length, aantalGoed: s.goed, klaar };
    if (klaar && s.herhaling) {
      /* Een herhaling loopt tot hier precies gelijk aan een oefensessie -- dat
         is de belofte -- en pas aan het eind anders: het doel is al behaald,
         dus er valt niets bij te schrijven maar wel iets te plannen. */
      Object.assign(uit, herhaalKlaar(key, s));
      delete sessies()['lid:' + key];
    } else if (klaar) {
      uit.behaald = s.goed >= (s.drempel || BEHAALD_BIJ);
      if (uit.behaald) {
        /* Het bewijs reist mee: wat er is gedaan en hoe het ging. Zonder dat
           is "behaald" een bewering zonder onderbouwing -- precies wat Proof
           of Learning uit de wereld helpt. */
        const b = onderwijs.doelBehaald(key, { doel: s.doel,
          bewijs: { soort: 'oefening', detail: s.goed + ' van ' + s.vragen.length + ' goed' } });
        if (b.error) uit.behaald = false; // geen paspoort (bijv. niet ingeschreven): eerlijk melden
        uit.paspoort = b.error || 'bijgeschreven';
      } else {
        /* Niet gehaald is geen aansporing maar een vraag: ligt er iets onder
           dat nog niet af is? Dan wijst het advies daarheen, en anders naar een
           andere uitleg van hetzelfde doel. */
        const behaald = (onderwijs.mijn(key).doelen) || {};
        const mist = pad(s.doel, behaald).filter(x => x.id !== s.doel && !x.behaald);
        const doel = DOELEN[s.doel];
        uit.ontbreekt = mist.slice(0, 3);
        uit.advies = mist.length
          ? 'Hieronder staat nog iets open: ' + mist.slice(0, 2).map(x => x.naam).join(' en ') + '. Doe dat eerst; daarna gaat dit vanzelf beter.'
          : (doel.uitleg || []).length
            ? 'Lees de uitleg eens op een andere manier; dezelfde stof kan er heel anders uitzien.'
            : 'Lees de les nog eens rustig door en probeer het opnieuw; elke poging is gewoon oefening.';
      }
      delete sessies()['lid:' + key];
    } else {
      const volgende = s.vragen[s.ix];
      uit.vraag = volgende.v;
      uit.opties = volgende.opties || null;
    }
    save();
    return uit;
  }

  return { leerstofVakken: vakken, leerstofLes: les, leerstofOefenStart: oefenStart, leerstofOefenAntwoord: oefenAntwoord,
    leerstofHerhalen: herhaalLijst, leerstofHerhaalStart: herhaalStart,
    leerstofPad: (key, d) => {
      const doel = DOELEN[String(d && d.doel || '')];
      if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
      const behaald = (onderwijs.mijn(key).doelen) || {};
      const rij = pad(doel.id, behaald);
      return { ok: true, doel: doel.id, naam: doel.naam, pad: rij,
        ontbreekt: rij.filter(x => x.id !== doel.id && !x.behaald),
        uitleg: 'Dit is de weg naar dit leerdoel: eerst wat eronder ligt, dan het doel zelf.' };
    },
    DOELEN };
}

module.exports = { maakLeerstof, DOELEN, PER_FASE, UITLEG_SOORTEN, STANDAARD_METING, keurLeerstof, pad };
