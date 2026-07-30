/* Boardroom van het lid, deel "schakel": de SCHRIJFKANT. Een functie omzetten,
   een set in een keer, en terug naar de standaard.

   Drie dingen die hier bewust in zitten:

   ALLES-OF-NIETS. Een bulk-actie valideert eerst en schrijft pas daarna. Een
   bord blijft nooit half om, ook niet als er halverwege iets niet mag.

   VERSIE. Elk bord telt zijn wijzigingen. Wie schakelt mag zijn versie
   meesturen; klopt die niet meer, dan krijgt hij een 409 met het verse bord in
   plaats van dat hij de wijziging van zijn andere toestel stilzwijgend
   overschrijft. Twee toestellen op een account is de normale situatie.
   Geen versie meesturen blijft toegestaan (oudere clients); wie hem wel
   meestuurt, krijgt de bescherming.

   NIETS VERANDERD IS GEEN GEBEURTENIS. Een schakelaar die je op dezelfde stand
   zet, hoogt de versie niet op en komt niet in het journaal. Anders vult een
   dubbelklik het spoor met ruis. */

const { CAPS, OP_ID, standaardAan } = require('./catalogus');

module.exports = (ctx) => {
  const { store, versie, aan, save, journaal, bord, platformStand } = ctx;

  /* Mag deze boardroom deze functie omzetten? Geeft null als het mag, anders de
     fout die de route teruggeeft. Een plek, zodat enkel en bulk niet uit elkaar
     kunnen lopen. */
  function toets(id, waarde, opts) {
    const o = opts || {};
    const c = OP_ID[id];
    if (!c) return { status: 400, error: 'Onbekende functie.' };
    if (o.kind && c.kind === false) return { status: 403, error: 'Deze functie hoort niet bij een kinder-boardroom.' };
    if (c.vast && waarde === false) {
      return { status: 409, error: '"' + c.naam + '" hoort bij de basis van je toestel en kan niet uit.' };
    }
    const pf = platformStand(id, o.doelgroep);
    if (pf) return { status: 409, error: '"' + c.naam + '" staat nu bij RTG uit: ' + pf.zin };
    return null;
  }

  /* Schrijf een gevalideerde set standen weg als EEN handeling: eerst de
     wijzigingen bepalen, dan de versie ophogen, dan bewaren, dan het journaal. */
  function schrijf(sleutel, standen, opts) {
    const o = opts || {};
    const s = store();
    if (!s[sleutel] || typeof s[sleutel] !== 'object') s[sleutel] = {};
    const bak = s[sleutel];
    const wijzigingen = [];
    for (const [id, waarde] of Object.entries(standen)) {
      const nu = aan(sleutel, id);
      const naar = waarde !== false;
      bak[id] = naar;
      if (nu !== naar) wijzigingen.push({ id, naam: (OP_ID[id] || {}).naam || id, van: nu, naar });
    }
    if (wijzigingen.length) {
      bak._v = versie(sleutel) + 1;
      bak._at = new Date().toISOString();
    }
    save();
    if (wijzigingen.length) journaal.noteer(sleutel, wijzigingen, { door: o.door, bron: o.bron });
    return wijzigingen;
  }

  function versieBotst(sleutel, opts) {
    const v = opts && opts.versie;
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return { status: 400, error: 'Ongeldige versie.' };
    if (n !== versie(sleutel)) {
      return { status: 409, conflict: true, bord: bord(sleutel, opts),
        error: 'Je boardroom is ondertussen op een ander toestel gewijzigd. Hier is de verse stand.' };
    }
    return null;
  }

  // Een functie omzetten. opts.kind begrenst tot de kind-functies.
  function zet(sleutel, id, waarde, opts) {
    const o = opts || {};
    const bots = versieBotst(sleutel, o); if (bots) return bots;
    const fout = toets(id, waarde !== false, o); if (fout) return fout;
    schrijf(sleutel, { [id]: waarde !== false }, o);
    return { status: 200, ok: true, bord: bord(sleutel, o) };
  }

  /* Meerdere functies in een keer. Een functie die RTG heeft dichtgezet of die
     vast staat, slaan we stil over: anders zou "alles uit" nooit lukken omdat
     er altijd iets tussen zit dat niet mag. Wat er wel omging staat in het
     antwoord, zodat de app kan tonen wat er echt is gebeurd. */
  function zetVeel(sleutel, standen, opts) {
    const o = opts || {};
    if (!standen || typeof standen !== 'object' || Array.isArray(standen)) {
      return { status: 400, error: 'Geef een set functies mee.' };
    }
    const ids = Object.keys(standen);
    if (!ids.length) return { status: 400, error: 'Geef minstens een functie mee.' };
    if (ids.length > CAPS.length) return { status: 400, error: 'Te veel functies in een keer.' };
    const bots = versieBotst(sleutel, o); if (bots) return bots;
    const schoon = {};
    for (const id of ids) {
      const waarde = standen[id] !== false;
      const fout = toets(id, waarde, o);
      if (fout && fout.status === 409) continue;   // beheerd of vast: overslaan
      if (fout) return fout;                       // onbekend of niet voor een kind: hard stoppen
      schoon[id] = waarde;
    }
    const wijzigingen = schrijf(sleutel, schoon, o);
    return { status: 200, ok: true, gewijzigd: wijzigingen.length, bord: bord(sleutel, o) };
  }

  /* Terug naar de standaard: alles wat je zelf hebt omgezet valt weg en het bord
     staat weer zoals bij een nieuw account, met de gevoelige deel-functies uit.
     Dat is iets anders dan "alles aan" -- vandaar apart. */
  function herstel(sleutel, opts) {
    const o = opts || {};
    const bots = versieBotst(sleutel, o); if (bots) return bots;
    const caps = o.kind ? CAPS.filter(c => c.kind !== false) : CAPS;
    const standen = {};
    for (const c of caps) if (!platformStand(c.id, o.doelgroep)) standen[c.id] = standaardAan(c);
    const wijzigingen = schrijf(sleutel, standen, Object.assign({}, o, { bron: (o.bron || 'boardroom') + ':herstel' }));
    return { status: 200, ok: true, hersteld: wijzigingen.length, bord: bord(sleutel, o) };
  }

  return { zet, zetVeel, herstel };
};
