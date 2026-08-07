/* RTG Stadsweefsel, deel "relaties": de getypeerde randen tussen objecten.

   Een objectregister zonder relaties is een lijst; met relaties is het een net.
   Het verschil merk je pas als er iets stuk is: een lantaarn die niet brandt is
   een klusje, drie lantaarns op dezelfde voedingsgroep is een transformator.

   De soorten zijn bewust weinig en gericht. Elke rand loopt van OORZAAK naar
   GEVOLG -- "A voedt B" betekent dat B uitvalt als A wegvalt. Die richting is
   de hele afspraak; hem omdraaien maakt van de uitvalketen een onzin-lijst,
   dus hij staat hier en nergens anders.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const SOORTEN = {
  voedt: { label: 'voedt (elektrisch)', uitval: true },
  'afvoer-naar': { label: 'voert af naar', uitval: true },
  stuurt: { label: 'stuurt aan', uitval: true },
  'hoort-bij': { label: 'hoort bij', uitval: false },
  vervangt: { label: 'vervangt', uitval: false }
};
// welke soorten een energie- of waterobject afneemt van zijn bron
const AFNEMERS = ['lantaarn', 'verkeerslicht', 'laadpaal', 'gemaal', 'halte', 'sensor'];

module.exports = (ctx) => {
  const { bak, save, crypto, nu, obj } = ctx;

  const relaties = () => bak().relaties;

  function relatieMaak({ van, naar, soort, door }) {
    const s = String(soort || '');
    if (!SOORTEN[s]) return { status: 400, error: 'Kies een soort: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const a = obj.object(van), b = obj.object(naar);
    if (!a || !b) return { status: 404, error: 'Onbekend object aan een van beide kanten.' };
    if (a.id === b.id) return { status: 400, error: 'Een object hangt niet aan zichzelf.' };
    const al = relaties().find(r => r.van === a.id && r.naar === b.id && r.soort === s);
    if (al) return { ok: true, relatie: al, bestond: true };
    const r = { id: 'R-' + crypto.randomBytes(4).toString('hex'), van: a.id, naar: b.id, soort: s,
      door: schoon(door, 60) || 'weefsel', at: nu() };
    relaties().push(r);
    save();
    return { ok: true, relatie: r };
  }

  function relatieWeg({ id }) {
    const i = relaties().findIndex(r => r.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Onbekende relatie.' };
    relaties().splice(i, 1);
    save();
    return { ok: true };
  }

  /* De buren van een object. richting 'uit' = wat ik voed (mijn gevolgen),
     'in' = waar ik van afhang (mijn oorzaken). Alleen soorten die uitval
     doorgeven tellen mee als je dat vraagt. */
  function buren(id, { soort, richting, alleenUitval } = {}) {
    const uit = [];
    for (const r of relaties()) {
      if (soort && r.soort !== soort) continue;
      if (alleenUitval && !SOORTEN[r.soort].uitval) continue;
      if ((richting !== 'in') && r.van === id) uit.push({ relatie: r, ander: r.naar, richting: 'uit' });
      if ((richting !== 'uit') && r.naar === id) uit.push({ relatie: r, ander: r.van, richting: 'in' });
    }
    return uit;
  }

  /* De seed: het net zoals de stad in elkaar zit. Elk transformatorstation
     voedt de elektrische objecten in zijn eigen wijk, elke put voert af naar
     het gemaal van zijn buurt. Dat is een vereenvoudiging van een echt
     energie- en rioolnet, en dat hoort hier te staan: het is genoeg om de
     ketenvraag echt te beantwoorden, en het is geen netbeheer. */
  function zorgRelaties() {
    obj.zorgObjecten();
    if (relaties().length) return;
    const { geo } = ctx;
    for (const w of geo.opNiveau('wijk')) {
      const trafo = obj.zoek({ soort: 'transformator', gebied: w.id })[0];
      if (!trafo) continue;
      for (const o of obj.zoek({ gebied: w.id }))
        if (AFNEMERS.includes(o.soort)) relatieMaak({ van: trafo.id, naar: o.id, soort: 'voedt', door: 'seed' });
    }
    for (const b of geo.opNiveau('buurt')) {
      const gemaal = obj.zoek({ soort: 'gemaal', gebied: b.id })[0];
      if (!gemaal) continue;
      for (const p of obj.zoek({ soort: 'put', gebied: b.id }))
        relatieMaak({ van: p.id, naar: gemaal.id, soort: 'afvoer-naar', door: 'seed' });
    }
    save();
  }

  return {
    SOORTEN, zorgRelaties, relaties, buren, relatieMaak,
    api: {
      weefselRelaties: ({ objectId } = {}) => {
        zorgRelaties();
        const rij = objectId ? buren(String(objectId)).map(b => b.relatie) : relaties().slice(0, 2000);
        return { status: 200, soorten: SOORTEN, aantal: rij.length,
          relaties: rij.map(r => ({ ...r, vanNaam: (obj.object(r.van) || {}).naam || null, naarNaam: (obj.object(r.naar) || {}).naam || null })) };
      },
      weefselRelatieMaak: relatieMaak,
      weefselRelatieWeg: relatieWeg
    }
  };
};
