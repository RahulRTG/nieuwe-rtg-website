/* DE TOEGANGSREVIEW -- AUTHORITY.md fase 8, het tweede stuk na "waarom".

   Wie houdt een kantoorzetel, sinds wanneer, en wat zouden de deuren voor die
   mens besluiten? Drie bronnen, elk met een eigen levenscyclus (AUTHORITY.md
   par. 1.3): de kantoorrol op een account (kern/eenaccount.js), de
   boardroomtoegang (boardroomLijst) en de baliezetels. De review LEEST ze alle
   drie en schrijft niets: intrekken gebeurt waar het recht woont (fase 3), en
   een tweede intrekweg hier zou er een zijn die uiteenloopt.

   GEEN NAMEN, en geen cijfer op een mens. Een codenaam en een sleutel (die is
   nodig om een baliezetel in te trekken), gesorteerd op codenaam en nooit op
   iets anders -- een review die rangschikt maakt van toegang een score.

   DE DEUREN ZIJN GESIMULEERD, en dat staat erbij. De feiten komen uit de
   zetels en niet uit een sessie: "als deze mens met zijn eigen account en de
   kantoorrol inlogt". Een sessie die NU openstaat met de gedeelde code is geen
   houder en staat hier dus niet -- de gedeelde code heeft geen zelf. */
'use strict';

const { kan, DEUREN } = require('./regels');

function maakReview({ kantoorHouders, boardroomLijst, magBoardroom, boardroomBaas, magBalie, balieZetels, codenaamVan, laatstGebruikt }) {
  const probeer = (fn, anders) => { try { return fn(); } catch (e) { return anders; } };

  function houders() {
    const per = new Map();
    const zet = (key, soort, sinds) => {
      if (!key) return;
      const h = per.get(key) || { key, zetels: [] };
      /* Slapend (besluit van de eigenaar): alleen de laatste gebruiksdatum, 90
         dagen bewaard. `onbekend` zolang de meting zelf nog geen 90 dagen loopt. */
      const g = typeof laatstGebruikt === 'function' ? probeer(() => laatstGebruikt(key, soort), null) : null;
      h.zetels.push({ soort, sinds: sinds || null, laatstGebruikt: g ? g.laatstGebruikt : null,
        slapend: g ? g.slapend : 'onbekend' });
      per.set(key, h);
    };
    for (const k of probeer(() => kantoorHouders() || [], [])) zet(k.key, 'kantoorrol', k.sinds);
    for (const t of probeer(() => boardroomLijst() || [], [])) zet(t.key, 'boardroom', t.at);
    for (const z of probeer(() => (typeof balieZetels === 'function' ? balieZetels() : []) || [], [])) zet(z.key, 'balie', z.sinds);
    return [...per.values()];
  }

  /* De feiten zoals ./feiten.js ze uit een sessie zou lezen, maar dan uit de
     zetels. `undefined` blijft `undefined`: een bron die niet antwoordt wordt
     geen nee. */
  function feitenVoor(h) {
    const baas = probeer(() => !!boardroomBaas(h.key), undefined);
    const rol = h.zetels.some(z => z.soort === 'kantoorrol');
    const kantoor = rol || baas === true ? true : (baas === undefined ? undefined : false);
    return {
      kantoorsessie: kantoor, eigenaar: baas, mensOpSessie: kantoor,
      boardroomZetel: probeer(() => !!magBoardroom(h.key), undefined),
      balieZetel: typeof magBalie === 'function' ? probeer(() => !!magBalie(h.key), undefined) : undefined,
      eigenaarMens: baas
    };
  }

  function review() {
    const rijen = houders().map(h => {
      const f = feitenVoor(h);
      const cn = probeer(() => codenaamVan(h.key), null);
      const deuren = {};
      for (const d of Object.keys(DEUREN)) deuren[d] = kan(f, d).uitkomst;
      return { codenaam: cn && cn !== h.key ? cn : null, key: h.key, eigenaar: f.eigenaar === true,
        zetels: h.zetels, deuren,
        /* Een zetel zonder kantoorrol opent niets: de boardroom en de balie
           hangen aan een kantoorsessie op naam. Die houders zijn het eerst aan
           een besluit toe, dus ze staan erbij en worden niet verborgen. */
        zetelZonderDeur: h.zetels.some(z => z.soort !== 'kantoorrol') && f.kantoorsessie === false };
    });
    rijen.sort((a, b) => String(a.codenaam || a.key).localeCompare(String(b.codenaam || b.key)));
    return {
      uitleg: 'Wie houdt een kantoorzetel, sinds wanneer, en wat de vier deuren voor die mens zouden besluiten ' +
        '(AUTHORITY.md fase 8). Alleen lezen: intrekken gebeurt waar het recht woont.',
      aanname: 'De deuren zijn gesimuleerd uit de zetels: als deze mens met zijn eigen account en de kantoorrol inlogt.',
      slapend: 'Per zetel alleen de laatste gebruiksdatum, 90 dagen bewaard. Slapend is ja pas als de meting zelf 90 ' +
        'dagen loopt; daarvoor heet een zetel zonder datum onbekend.',
      nietGezien: ['de gedeelde kantoorcode (die heeft geen houder)', 'rollen binnen RTFOS (BENOEMING.md)',
        'rollen in het Werk OS van een klant (bedrijf/rollen.js)'],
      houders: rijen,
      aantal: rijen.length
    };
  }

  /* DE SIMULATOR (fase 8): wat zouden de deuren voor DEZE mens besluiten als hij
     een zetel erbij kreeg of kwijtraakte? Er verandert niets: het is een
     rekensom over dezelfde feiten als de review, en de uitkomst toont alleen
     de deuren die van besluit wisselen. `plus` en `min` noemen zetelsoorten. */
  function simuleer(key, { plus, min } = {}) {
    const bij = (Array.isArray(plus) ? plus : []).filter(z => ZETELSOORTEN.includes(z));
    const af = (Array.isArray(min) ? min : []).filter(z => ZETELSOORTEN.includes(z));
    const h = houders().find(x => x.key === key) || { key, zetels: [] };
    const voorF = feitenVoor(h);
    const heeft = new Set(h.zetels.map(z => z.soort));
    for (const z of bij) heeft.add(z);
    for (const z of af) heeft.delete(z);
    const baas = voorF.eigenaar === true;
    const kantoor = heeft.has('kantoorrol') || baas;
    const naF = Object.assign({}, voorF, { kantoorsessie: kantoor, mensOpSessie: kantoor,
      boardroomZetel: baas || heeft.has('boardroom'), balieZetel: baas || heeft.has('boardroom') || heeft.has('balie') });
    const verschil = [];
    const deuren = {};
    for (const d of Object.keys(DEUREN)) {
      const voor = kan(voorF, d).uitkomst, na = kan(naF, d).uitkomst;
      deuren[d] = { voor, na };
      if (voor !== na) verschil.push({ deur: d, voor, na });
    }
    return { key, zetelsVoor: [...new Set(h.zetels.map(z => z.soort))], zetelsNa: [...heeft], deuren, verschil,
      genegeerd: [].concat(plus || [], min || []).filter(z => !ZETELSOORTEN.includes(z)),
      grens: 'Een simulatie: er is niets veranderd. De eigenaar blijft eigenaar, wat de simulatie ook zegt.' };
  }

  return { review, simuleer };
}

const ZETELSOORTEN = Object.freeze(['kantoorrol', 'boardroom', 'balie']);

module.exports = { maakReview };
