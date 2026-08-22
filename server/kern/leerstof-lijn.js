/* RTG School: de leerlijn en de les -- de LEES-kant van de leerstof.

   Dit bestand beantwoordt "wat valt er hier te leren en wat weet ik al": de
   leerlijn per groep of fase, de les in gewone taal met zijn voorkennis en zijn
   andere uitlegvormen, en het pad naar een leerdoel. Wat een leerling ermee
   DOET (oefenen, herhalen, het dagplan) staat in ./leerstof.js.

   Dat is een echte knip en geen opdeling om de omvang: hier wordt niets
   veranderd aan een paspoort, hier loopt geen sessie, en er wordt niets
   opgeslagen. Alles hieronder is een vraag met een antwoord. */
const { DOELEN, PER_GROEP, PER_FASE } = require('./leerstof-bibliotheek');
const { STANDAARD_METING, pad: fabricPad } = require('./leerstof-fabric');
const pad = (doelId, behaald) => fabricPad(doelId, behaald, DOELEN);

function maakLijn({ onderwijs }) {
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

  /* De weg naar een leerdoel: wat ligt eronder, en wat daarvan is nog niet af.
     Dit is het antwoord op "waarom lukt dit niet" dat geen percentage geeft. */
  function leerstofPad(key, d) {
    const doel = DOELEN[String(d && d.doel || '')];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    const behaald = (onderwijs.mijn(key).doelen) || {};
    const rij = pad(doel.id, behaald);
    return { ok: true, doel: doel.id, naam: doel.naam, pad: rij,
      ontbreekt: rij.filter(x => x.id !== doel.id && !x.behaald),
      uitleg: 'Dit is de weg naar dit leerdoel: eerst wat eronder ligt, dan het doel zelf.' };
  }

  return { vakken, les, leerstofPad };
}

module.exports = { maakLijn };
