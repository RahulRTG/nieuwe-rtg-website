/* DE AANGIFTEGATEWAY (deelmodule): DE VERZEGELING EN DE KETEN.

   Afgesplitst van ./index.js op de omvanglat, en de snede valt op een echte
   grens: hiernaast staat de LEVENSLOOP van een zending (klaarzetten, aanbieden,
   bevestigen), hier staat waarmee je later kunt aantonen dat er niets aan is
   veranderd. Het eerste gaat over wat er gebeurt, het tweede over of je het nog
   kunt geloven.

   CANONIEK SERIALISEREN. Sleutels gesorteerd, op elk niveau. Zonder dat geeft
   dezelfde inhoud twee verschillende hashes zodra een veld in een andere
   volgorde is opgebouwd -- en dan werkt de idempotentie niet meer, precies bij
   de retry waarvoor hij bedoeld is.

   DE KETEN. Elke gebeurtenis draagt de zegel van de vorige, zoals in
   kern/betaalwaarheid. Dat maakt een record dat achteraf is bijgewerkt
   zichtbaar: je kunt een schakel wijzigen, maar dan klopt de volgende niet meer.

   EN DE CONTROLE HERREKENT. Dat is het verschil tussen een hash die ergens IN
   staat en bewijs: een zegel die niemand ooit natelt, bewijst niets. */
'use strict';

function canoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function maakZegel({ crypto, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

  /* Een gebeurtenis aan de keten hangen. De zegel wordt over de schakel ZONDER
     zijn eigen zegel gerekend -- anders zou hij zichzelf moeten bevatten. */
  function gebeurtenis(z, soort, extra) {
    if (!Array.isArray(z.gebeurtenissen)) z.gebeurtenissen = [];
    const vorig = z.gebeurtenissen.length ? z.gebeurtenissen[z.gebeurtenissen.length - 1].zegel : 'BEGIN';
    const g = Object.assign({ nr: z.gebeurtenissen.length + 1, at: tijd(), soort, status: z.status, vorig }, extra || {});
    g.zegel = hash(canoniek(g));
    z.gebeurtenissen.push(g);
    return g;
  }

  /* De keten nalopen: klopt de inhoud nog met zijn zegel, en wijst elke schakel
     naar de vorige. Geeft een LIJST bevindingen en nooit een boolean -- wie iets
     afkeurt hoort te kunnen zeggen wat er niet klopt. */
  function controleer(z) {
    const bevindingen = [];
    if (hash(canoniek(z.payload)) !== z.zegel) bevindingen.push({ soort: 'inhoud-gewijzigd',
      let: 'De inhoud van deze zending is veranderd sinds hij is verzegeld.' });
    let vorig = 'BEGIN';
    for (const g of z.gebeurtenissen || []) {
      const kopie = Object.assign({}, g);
      delete kopie.zegel;
      if (g.vorig !== vorig) bevindingen.push({ soort: 'keten-breuk', nr: g.nr,
        let: 'Schakel ' + g.nr + ' wijst niet naar de vorige.' });
      if (hash(canoniek(kopie)) !== g.zegel) bevindingen.push({ soort: 'schakel-gewijzigd', nr: g.nr,
        let: 'Schakel ' + g.nr + ' is na het vastleggen gewijzigd.' });
      vorig = g.zegel;
    }
    return { ok: true, id: z.id, status: z.status, zegel: z.zegel,
      schakels: (z.gebeurtenissen || []).length, heel: bevindingen.length === 0, bevindingen };
  }

  return { canoniek, hash, gebeurtenis, controleer };
}

module.exports = { maakZegel, canoniek };
