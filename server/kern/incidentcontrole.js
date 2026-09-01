/* Centrale incidentbediening boven op de BESTAANDE functieschakelaars en
   onderhoudszekering. Er ontstaat dus geen tweede waarheid.

   Elke eerste noodwijziging bewaart alleen de standen die zij werkelijk raakt.
   Herstel zet die exact terug; handelingen aan andere functies tijdens het
   incident blijven daardoor intact. De audit wordt append-only bewaard. */
'use strict';

const crypto = require('crypto');
const klok = require('../lib/klok');
const { maakBeschermstand } = require('./beschermstand');
const { maakBescherm } = require('./incidentcontrole-bescherm');

/* VIJF STANDEN, EN HET IS GEEN LADDER. `waakzaam`, `beperkt` en `isolatie`
   lopen van licht naar zwaar; `beschermd` staat er dwars op. Hij houdt MEER
   tegen dan `beperkt` (zes hele categorieën in plaats van genoemde functies) en
   MINDER dan `isolatie` (het lezen en tien categorieën lopen door). Wie er een
   getal van maakt -- "niveau 3" -- gaat op een dag `beschermd` overslaan omdat
   `isolatie` hoger klinkt, en dat is precies de keuze die grens 6.10 wil
   voorkomen. */
const MODI = ['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie'];

function kopie(v) { return JSON.parse(JSON.stringify(v)); }
function eigen(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }
function fout(status, tekst) { const e = new Error(tekst); e.status = status; throw e; }

module.exports = function maakIncidentcontrole({ db, save, functies, beveilig, journaal }) {
  const beschermstand = maakBeschermstand({ functies });

  function techniek() {
    if (!db.data.techniek) db.data.techniek = {};
    const t = db.data.techniek;
    if (!t.functies || typeof t.functies !== 'object') t.functies = {};
    if (!t.zekeringen || typeof t.zekeringen !== 'object') t.zekeringen = {};
    if (!t.incidentcontrole || typeof t.incidentcontrole !== 'object')
      t.incidentcontrole = { modus: 'normaal', revisie: 0, actief: null, audit: [] };
    const s = t.incidentcontrole;
    if (!Array.isArray(s.audit)) s.audit = [];
    if (!Number.isSafeInteger(s.revisie)) s.revisie = 0;
    /* SEC-LOCK-004: EEN ONBEKENDE STAND IS GEEN NORMALE STAND. Hier stond
       `s.modus = 'normaal'`, en dat is een fail-OPEN: een beschadigd of
       gemanipuleerd veld zette het platform stilzwijgend in de zwakste stand,
       precies op het moment dat er iets aan de hand was. Terugvallen op
       `isolatie` zou het huis platleggen op grond van een tikfout, en dat is de
       knop die volgens BESTUUR.md grens 6.10 niet gebruikt wordt. Dus valt hij
       terug op `beschermd`: de enige stand die GEEN schakelaar omzet, het lezen
       laat doorlopen en toch de zes bevoorrechte categorieën bevriest.
       kern/isolatie/ordening.js leest dezelfde onbekende waarde op dezelfde
       manier; deze regel is de uitvoering ervan en niet een tweede oordeel. */
    if (!MODI.includes(s.modus)) {
      const was = String(s.modus);
      s.modus = 'beschermd';
      s.standOnbepaald = { was: was.slice(0, 40), at: klok.datum().toISOString() };
      if (beveilig) beveilig.meld('incidentcontrole', 'kritiek',
        'De opgeslagen incidentstand was onleesbaar ("' + was.slice(0, 40) + '"). ' +
        'Teruggevallen op de beschermstand in plaats van op normaal; stel handmatig vast wat er hoort te gelden.',
        { bron: 'incidentcontrole:standOnbepaald' });
    } else if (s.standOnbepaald) delete s.standOnbepaald;
    return { t, s };
  }

  function actorVan(actor) {
    const id = actor && actor.id;
    return Number.isSafeInteger(id) || typeof id === 'string' ? 'user-' + String(id).slice(0, 40) : 'eigenaar';
  }

  function redenVan(v) {
    const reden = String(v || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    if (reden.length < 8) fout(400, 'Geef een concrete reden van minimaal 8 tekens.');
    return reden;
  }

  function nieuwActief(s, reden, actor) {
    if (s.actief) return s.actief;
    s.actief = {
      id: crypto.randomBytes(8).toString('hex'),
      gestart: klok.datum().toISOString(),
      gestartDoor: actorVan(actor),
      reden,
      herstel: { functies: {}, onderhoud: null }
    };
    return s.actief;
  }

  function schrijfAudit(s, actie, actor, reden, ids) {
    s.revisie++;
    s.audit.push({ revisie: s.revisie, at: klok.datum().toISOString(), actor: actorVan(actor),
      actie, modus: s.modus, reden, functies: (ids || []).slice(0, functies.FUNCTIES.length) });
  }

  function onthoudFunctie(t, actief, id) {
    if (eigen(actief.herstel.functies, id)) return;
    actief.herstel.functies[id] = eigen(t.functies, id)
      ? { bestond: true, waarde: kopie(t.functies[id]) } : { bestond: false };
  }

  function zetUit(t, actief, ids) {
    for (const id of ids) {
      onthoudFunctie(t, actief, id);
      const cur = t.functies[id] = t.functies[id] || {};
      cur.aan = false;
      cur.incident = actief.id;
    }
  }

  function doelen(invoer) {
    invoer = invoer || {};
    let ids = [];
    if (Array.isArray(invoer.ids)) ids.push(...invoer.ids);
    if (invoer.id) ids.push(invoer.id);
    if (invoer.categorie) ids.push(...functies.FUNCTIES.filter(f => f.categorie === invoer.categorie).map(f => f.id));
    ids = [...new Set(ids.map(String))];
    const vreemd = ids.filter(id => !eigen(functies.OP_ID, id));
    if (vreemd.length) fout(404, 'Onbekende functie: ' + vreemd[0]);
    if (!ids.length) fout(400, 'Kies minstens één functie of categorie om te beperken.');
    return ids;
  }

  function meld(actie, reden, ids) {
    if (!beveilig) return;
    const kritiek = actie === 'isolatie';
    beveilig.meld('incidentcontrole', kritiek ? 'kritiek' : 'waarschuwing',
      'Incidentcontrole: ' + actie + '. Reden: ' + reden + (ids && ids.length ? ' Functies: ' + ids.join(', ') + '.' : ''),
      { bron: 'incidentcontrole:' + actie });
  }

  function waakzaam(redenIn, actor) {
    const reden = redenVan(redenIn);
    const { s } = techniek();
    if (s.modus !== 'normaal') fout(409, 'Er loopt al een incident; breid dat uit of herstel het eerst.');
    nieuwActief(s, reden, actor);
    s.modus = 'waakzaam';
    schrijfAudit(s, 'waakzaam', actor, reden, []);
    save(); meld('waakzaam', reden, []);
    return status();
  }

  function beperk(invoer, actor) {
    const reden = redenVan(invoer && invoer.reden);
    const ids = doelen(invoer);
    const { t, s } = techniek();
    const actief = nieuwActief(s, reden, actor);
    zetUit(t, actief, ids);
    if (s.modus !== 'isolatie') s.modus = 'beperkt';
    schrijfAudit(s, 'beperk', actor, reden, ids);
    save(); meld('beperk', reden, ids);
    return status();
  }

  function isoleer(redenIn, actor) {
    const reden = redenVan(redenIn);
    const { t, s } = techniek();
    const actief = nieuwActief(s, reden, actor);
    const ids = functies.FUNCTIES.map(f => f.id);
    zetUit(t, actief, ids);
    if (actief.herstel.onderhoud === null) {
      actief.herstel.onderhoud = eigen(t.zekeringen, 'onderhoud')
        ? { bestond: true, waarde: kopie(t.zekeringen.onderhoud) } : { bestond: false };
    }
    const z = t.zekeringen.onderhoud = t.zekeringen.onderhoud || {};
    z.aan = false; z.reden = 'incidentisolatie: ' + reden; z.sindsGesprongen = klok.nu();
    s.modus = 'isolatie';
    schrijfAudit(s, 'isolatie', actor, reden, ids);
    save(); meld('isolatie', reden, []);
    return status();
  }

  /* DE VEILIGE NOODSTAND, en waarom hij in een eigen bestand staat: hij is de
     enige van de vijf die GEEN enkele schakelaar omzet. Zie
     ./incidentcontrole-bescherm.js. */
  const bescherm = maakBescherm({ techniek, redenVan, nieuwActief, schrijfAudit,
    save, meld, status, fout, journaal });

  function herstel(redenIn, actor) {
    const reden = redenVan(redenIn);
    const { t, s } = techniek();
    if (!s.actief) fout(409, 'Er is geen actief incident om te herstellen.');
    const geraakt = Object.keys(s.actief.herstel.functies || {});
    for (const id of geraakt) {
      const oud = s.actief.herstel.functies[id];
      if (oud.bestond) t.functies[id] = kopie(oud.waarde); else delete t.functies[id];
    }
    const oz = s.actief.herstel.onderhoud;
    if (oz) { if (oz.bestond) t.zekeringen.onderhoud = kopie(oz.waarde); else delete t.zekeringen.onderhoud; }
    const incidentId = s.actief.id;
    s.actief = null; s.modus = 'normaal';
    schrijfAudit(s, 'herstel', actor, reden, geraakt);
    s.laatstGesloten = { id: incidentId, at: klok.datum().toISOString(), reden, door: actorVan(actor) };
    save(); meld('herstel', reden, geraakt);
    return status();
  }

  function status() {
    const { t, s } = techniek();
    const beschermd = s.modus === 'beschermd';
    const uit = functies.FUNCTIES.filter(f => !functies.functieAan(f.id, t.functies));
    return {
      modus: s.modus, revisie: s.revisie, actief: s.actief ? {
        id: s.actief.id, gestart: s.actief.gestart, gestartDoor: s.actief.gestartDoor,
        reden: s.actief.reden, geraakt: Object.keys(s.actief.herstel.functies || {}).length
      } : null,
      onderhoud: !!(t.zekeringen.onderhoud && t.zekeringen.onderhoud.aan === false),
      functiesUit: uit.length,
      uit: uit.slice(0, 100).map(f => ({ id: f.id, naam: f.naam, categorie: f.categorie })),
      /* De beschermstand vertelt WAT hij tegenhoudt en wat er doorloopt, ook
         als hij uit staat. Een noodknop waarvan je pas tijdens het incident
         leest wat hij doet, is een knop die niemand indrukt. */
      bescherming: { aan: beschermd,
        onderdelen: beschermstand.onderdelen({ zegel: (s.actief && s.actief.zegel) || null }),
        bevriest: Object.keys(beschermstand.BEVRIEST),
        looptDoor: Object.keys(beschermstand.LOOPT_DOOR),
        uitzonderingen: beschermstand.UITZONDERINGEN },
      /* Een teruggevallen stand staat in het antwoord en niet alleen in de
         melding: wie het scherm leest hoort te zien dat hier geen mens heeft
         gekozen. */
      standOnbepaald: s.standOnbepaald || null,
      auditAantal: s.audit.length,
      audit: s.audit.slice(-50).reverse(),
      laatstGesloten: s.laatstGesloten || null
    };
  }

  return { status, waakzaam, beperk, bescherm, isoleer, herstel, beschermstand, MODI };
};
