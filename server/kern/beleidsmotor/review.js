/* DE TOEGANGSREVIEW -- AUTHORITY.md fase 8, het tweede stuk na "waarom".

   Wie houdt een kantoorzetel, sinds wanneer, en wat zouden de deuren voor die
   mens besluiten? Drie bronnen, elk met een eigen levenscyclus (AUTHORITY.md
   par. 1.3): de kantoorrol op een account (db.data.accountRollen), de
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

function maakReview({ db, boardroomLijst, magBoardroom, boardroomBaas, magBalie, balieZetels, codenaamVan }) {
  const probeer = (fn, anders) => { try { return fn(); } catch (e) { return anders; } };

  function houders() {
    const per = new Map();
    const zet = (key, soort, sinds) => {
      if (!key) return;
      const h = per.get(key) || { key, zetels: [] };
      h.zetels.push({ soort, sinds: sinds || null });
      per.set(key, h);
    };
    const rollen = (db.data && db.data.accountRollen) || {};
    for (const [key, lijst] of Object.entries(rollen)) {
      for (const r of (Array.isArray(lijst) ? lijst : [])) if (r && r.rol === 'kantoor') zet(key, 'kantoorrol', r.at);
    }
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
      nietGezien: ['de gedeelde kantoorcode (die heeft geen houder)', 'rollen binnen RTFOS (BENOEMING.md)',
        'rollen in het Werk OS van een klant (bedrijf/rollen.js)'],
      houders: rijen,
      aantal: rijen.length
    };
  }

  return { review };
}

module.exports = { maakReview };
