/* Magnaat: DE BEURSACTIES -- aanbieden, kopen, intrekken.

   De acties van de beurslaag; de regels staan in ./beurs.js. Dezelfde driedeling
   als bij de bank, de verzekering, het onderzoek en het beheer.

   ALLE DRIE VRIJ. Een order plaatsen of nemen verandert de kaart niet: er komt
   geen gebouw bij en er gaat er geen weg. Wat er wel gebeurt is dat een deel van
   een resultaat van eigenaar wisselt, en dat mag altijd -- net als onderhandelen.

   HET GELD GAAT NAAR DE HUIDIGE EIGENAAR VAN DE ZAAK bij een eigenaarsbelang, en
   naar de verkopende houder bij doorverkoop. Dat is dezelfde regel als bij een
   onderhandeld belang (./aandeel-acties.js besluit 4): het belang hangt aan de
   VESTIGING en niet aan de persoon, dus wie de zaak nu heeft, draagt vanaf nu de
   verwatering en krijgt dus ook de opbrengst. */
/* DE VASTE GETALLEN KOMEN VAN DE MODULE EN NIET VAN DE FABRIEK. Dat onderscheid
   is hier al een keer misgegaan (zie ./beheer.js): `beurs.LOOPTIJD` was
   `undefined`, dus `tot` werd `NaN`, en een order die op `NaN` afloopt verloopt
   nooit. Hij bleef stil op de markt staan. */
const B = require('./beurs');

const rond = (n) => Math.round(n);

module.exports = ({ beurs, wieHeeft, mijnVestiging, uitgegeven, MAX_DEEL }) => {
  const ACTIES = {
    /* VRIJ: een belang openbaar te koop zetten. Twee soorten en dat onderscheid
       is echt: een EIGENAAR geeft nieuw belang uit (er komt een aandeelhouder
       bij, hij verwatert zichzelf), een HOUDER verkoopt door (het belang
       verhuist, er verandert niets aan de zaak). */
    'beurs-aanbieden'(potje, h, z) {
      const st = potje.staat;
      const w = wieHeeft(st, String(z.vestiging || ''));
      if (!w) return { status: 404, error: 'Die vestiging bestaat niet.' };
      const eigenaar = w.speler === h;
      const deel = Math.floor(Number(z.deel) || 0);
      const prijs = Math.floor(Number(z.prijs) || 0);
      const fout = beurs.keur(st, h, w.v, deel, prijs, eigenaar);
      if (fout) return { status: 409, error: fout };
      const o = { id: 'b' + (st.beursTeller = (st.beursTeller || 0) + 1), status: 'open',
        vestiging: w.v.id, verkoper: h, eigenaar, deel, prijs,
        sinds: st.maand, tot: st.maand + B.LOOPTIJD };
      (st.beurs = st.beurs || []).push(o);
      return { status: 200, ok: true, id: o.id, prijs, tot: o.tot,
        rekenwaarde: rond(beurs.stukPrijs(w.v, deel)) };
    },

    /* VRIJ: een order nemen. Iedereen mag, behalve de verkoper zelf en behalve
       de eigenaar van de zaak -- die zou zijn eigen verwatering terugkopen, en
       dan is een order een manier om geld van links naar rechts te zetten. */
    'beurs-kopen'(potje, h, z) {
      const st = potje.staat;
      const o = (st.beurs || []).find(x => x.id === String(z.id || ''));
      if (!o || o.status !== 'open') return { status: 404, error: 'Dat aanbod staat niet meer open.' };
      if (o.verkoper === h) return { status: 409, error: 'Dat is je eigen aanbod.' };
      const w = wieHeeft(st, o.vestiging);
      if (!w) return { status: 409, error: 'Die vestiging bestaat niet meer.' };
      if (w.speler === h) return { status: 409, error: 'Een belang in je eigen zaak koop je niet.' };
      if (!beurs.gedekt(st, o)) { o.status = 'vervallen'; return { status: 409, error: 'Dat aanbod is niet meer gedekt.' }; }
      if (o.eigenaar && uitgegeven(st, o.vestiging) + o.deel > MAX_DEEL)
        return { status: 409, error: 'Er is inmiddels te veel van deze zaak vergeven.' };
      if (st.geld[h] < o.prijs) return { status: 400, error: 'Dat kost ' + o.prijs + '; dat heb je niet.' };

      st.geld[h] -= o.prijs;
      /* NAAR DE HUIDIGE EIGENAAR bij nieuw belang, naar de verkopende houder bij
         doorverkoop. In allebei de gevallen is het een OVERDRACHT: dezelfde euro
         staat na afloop op een andere rekening en er komt er geen bij. */
      const ontvanger = o.eigenaar ? w.speler : o.verkoper;
      st.geld[ontvanger] += o.prijs;

      if (o.eigenaar) {
        (st.deelnemingen = st.deelnemingen || []).push({
          id: 'd' + (st.deelnemingTeller = (st.deelnemingTeller || 0) + 1), status: 'loopt',
          via: 'beurs', vestiging: o.vestiging, eigenaar: w.speler, houder: h,
          deel: o.deel, prijs: o.prijs, gekocht: st.maand, ontvangen: 0 });
      } else {
        /* DOORVERKOOP: het bestaande belang wisselt van houder. Er wordt geen
           nieuw belang gemaakt -- dan zou er meer uitstaan dan er verkocht is. */
        let rest = o.deel;
        for (const d of (st.deelnemingen || []).filter(x => x.status === 'loopt'
          && x.vestiging === o.vestiging && x.houder === o.verkoper)) {
          if (rest <= 0) break;
          if (d.deel <= rest) { d.houder = h; rest -= d.deel; continue; }
          d.deel -= rest;
          (st.deelnemingen).push(Object.assign({}, d, {
            id: 'd' + (st.deelnemingTeller = (st.deelnemingTeller || 0) + 1),
            deel: rest, houder: h, via: 'beurs', gekocht: st.maand, ontvangen: 0 }));
          rest = 0;
        }
      }
      o.status = 'verkocht'; o.koper = h; o.tot = st.maand;
      return { status: 200, ok: true, deel: o.deel, prijs: o.prijs, wek: o.verkoper };
    },

    /* VRIJ: je eigen order intrekken. */
    'beurs-intrekken'(potje, h, z) {
      const st = potje.staat;
      const o = (st.beurs || []).find(x => x.id === String(z.id || '') && x.verkoper === h);
      if (!o || o.status !== 'open') return { status: 404, error: 'Dat aanbod staat niet meer open.' };
      o.status = 'ingetrokken'; o.tot = st.maand;
      return { status: 200, ok: true };
    }
  };

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES),
    beeld: (st, h, codenaamVan) => beurs.beeld(st, h, codenaamVan) };
};
