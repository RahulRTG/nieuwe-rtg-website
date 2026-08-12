/* Magnaat: WAT EEN DIENST DE MAAND IN STUURT -- en wat er van hem overblijft.

   Twee functies, en ze staan hier los van ./rush-acties.js omdat ./maand.js ze
   nodig heeft en de actietabel niet. Zou de maandkant in de actiefabriek zitten,
   dan moest ./maand.js die fabriek bouwen om een getal op te halen -- en dan
   hangt de economie aan de bediening in plaats van andersom.

   `factoren()` LOOPT VOOR DE MAAND, `naMaand()` erna. Die volgorde is niet
   inwisselbaar: de eerste levert de invoer waarmee ./stap.js rekent, de tweede
   schrijft op wat eruit kwam. */
'use strict';

const R = require('./rush');
const D = require('./dienst');

/* Hoeveel diensten er in het log passen. Zoals bij ./beheer.js: een log dat
   alles bewaart is geen geheugen maar een bak. */
const LOGLENGTE = 40;

const vind = (st, id) => (st.vestigingen ? Object.values(st.vestigingen).flat()
  .find(v => v.id === id) : null) || null;

/* Elke AFGERONDE dienst van deze maand, met zijn zaak en zijn uitkomst erbij.
   Beide functies hieronder lopen langs dezelfde lijst, en dat is met opzet: zou
   `naMaand` een andere selectie maken dan `factoren`, dan staat er een dienst in
   het log die de rekening nooit raakte, of omgekeerd. */
function afgerond(potje) {
  const st = potje.staat;
  const t = R.tafel(st);
  const uit = [];
  for (const d of D.lopend(st)) {
    const s = t.diensten[d.id];
    /* NIET AFGEMAAKT IS NEUTRAAL -- wet 4, op de plek waar hij geld raakt. Een
       dienst die je begon en liet liggen telt niet mee, en kost dus niets. */
    if (!s || s.maand !== st.maand || !s.klaar) continue;
    const v = vind(st, d.vestiging);
    if (!v || !R.magRush(d.rol, v.sector)) continue;
    uit.push({ d, v, s, vv: R.bouw(potje.id, d, s.maand, d.rol) });
  }
  return uit;
}

/* DE FACTOR PER ZAAK, voor de maand die gerekend gaat worden.

   TWEE HULPKRACHTEN OP EEN ZAAK MIDDELEN, ze tellen niet op. Zou het optellen,
   dan halveert een tweede man de derving zonder iets te doen -- en dan is
   personeel aannemen een geldpomp in plaats van een kostenpost. */
function factoren(potje) {
  const per = {};
  for (const { d, v, s, vv } of afgerond(potje))
    (per[d.vestiging] = per[d.vestiging] || []).push(R.uitkomst(vv, s, v).factor);
  return Object.fromEntries(Object.entries(per)
    .map(([id, l]) => [id, l.reduce((a, b) => a + b, 0) / l.length]));
}

/* NA DE MAAND: wat er van de dienst overblijft. Een regel met een reden in het
   log (zoals ./beheer.js `meld`), en het FEIT op het dienstverband.

   ER STAAT GEEN OORDEEL IN. Niet "goed gedraaid" maar wat je aanpakte en wat er
   bleef liggen -- par. 0b: wat gebeurd is blijft waar, wat het betekent kan
   veranderen. Of hier ooit een moment uit groeit beslist ../loopbaan-noteren.js,
   en die leest hetzelfde feit als iedereen.

   `geboekt` MAAKT HEM IDEMPOTENT, want de wereld rekent bij en een maand kan
   meer dan eens langskomen zonder dat er een tweede regel hoort te ontstaan. */
function naMaand(potje) {
  const t = R.tafel(potje.staat);
  for (const { d, v, s, vv } of afgerond(potje)) {
    if (s.geboekt) continue;
    const u = R.uitkomst(vv, s, v);
    s.geboekt = true;
    (d.diensten = d.diensten || []).push({ maand: s.maand, vestiging: d.vestiging,
      aangepakt: s.gedaan.length, bleefLiggen: u.bleefLiggen.length,
      /* WAT EEN AVOND BIJZONDER MAAKT (wet 5): dat je een incident hebt
         opgevangen, niet dat je zes keer geklikt hebt. */
      incident: vv.some(x => x.incident && s.gedaan.some(g => g.id === x.id)) });
    t.log.unshift({ maand: s.maand, werknemer: d.werknemer, zaak: v.naam,
      derving: u.derving,
      waarom: u.verschil >= 0
        ? 'derving ' + u.verschil + ' lager dan zonder sturing'
        : 'derving ' + (-u.verschil) + ' hoger dan zonder sturing' });
  }
  if (t.log.length > LOGLENGTE) t.log.length = LOGLENGTE;
}

module.exports = { factoren, naMaand, afgerond, vind, LOGLENGTE };
