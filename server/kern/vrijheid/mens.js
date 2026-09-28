/* VRIJHEID: DE MENS BESLIST -- menselijke beoordeling en intrekken (deel van
   index.js, apart gezet voor de 10 kB-grens). HUMAN EXCEPTION: niet elke
   menselijke situatie past in een algoritme, maar een mens kan geen
   ontbrekende bevoegdheid wegtekenen en keurt nooit zijn eigen verzoek goed. */
'use strict';
const D = require('./dekking');
const S = require('./standen');

module.exports = (ctx) => {
  const { org, fout, tijd, bewaar, zend, teamKlopt, afwezig, schrijfGrootboek, plan, vrijgaveTerug, TOEGEKEND } = ctx;

  /* Een mens beslist. Nooit de aanvrager zelf, en een goedkeuring rekent de
     dekking OPNIEUW met wat er intussen is toegekend -- zo kunnen twee
     managers niet elk een verzoek goedkeuren dat samen de dekking breekt. */
  function beoordeelMens(code, team, vid, { door, besluit, reden, uitzondering }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const v = org(code).verzoeken[vid];
    if (!v) return fout(404, 'Verzoek niet gevonden.');
    if (!door || door === v.persoon) return fout(403, 'Een verzoek wordt niet door de aanvrager zelf beoordeeld.');
    if (!(team.managers || []).includes(door)) return fout(403, 'Alleen een leidinggevende van dit team beoordeelt.');
    if (v.stand !== 'HUMAN_REVIEW') return fout(409, 'Dit verzoek wacht niet op een mens (stand ' + v.stand + ').');
    if (besluit === 'DECLINED') {
      if (!reden) return fout(422, 'Een weigering draagt altijd een reden.');
      v.menselijkeReden = String(reden).slice(0, 500);
      S.zet(v, 'verzoek', 'DECLINED', door, tijd()); zend('FREEDOM_DECLINED', { organisatie: code, id: vid }); bewaar();
      return { ok: true, verzoek: v };
    }
    if (besluit !== 'APPROVED') return fout(422, 'Besluit is APPROVED of DECLINED.');
    if (v.afwezigheid) {
      const dek = D.toets(team, v.afwezigheid, afwezig(code, vid));
      const bevoegdGat = dek.gaten.some(g => g.ontbreekt !== 'bezetting');
      /* Een uitzondering kan een krappe bezetting aanvaarden -- nooit een
         ontbrekende bevoegdheid. Die verandert geen mens door te tekenen. */
      if (bevoegdGat) return fout(409, 'Nu niet meer mogelijk: ' + dek.uitleg);
      if (dek.stand === 'GAP' && !uitzondering) return fout(409, 'Sinds de aanvraag is de dekking veranderd: ' + dek.uitleg);
      if (uitzondering) { schrijfGrootboek(code, { soort: 'POLICY_EXCEPTION_GRANTED', persoon: v.persoon, datum: v.datum, door }); zend('POLICY_EXCEPTION_GRANTED', { organisatie: code, id: vid }); }
    }
    v.beoordeeldDoor = door;
    S.zet(v, 'verzoek', 'APPROVED', door, tijd()); plan(code, v); bewaar();
    return { ok: true, verzoek: v };
  }

  function trekIn(code, vid, door) {
    const v = org(code).verzoeken[vid];
    if (!v) return fout(404, 'Verzoek niet gevonden.');
    if (door !== v.persoon) return fout(403, 'Alleen de aanvrager trekt een verzoek in.');
    if (!S.mag('verzoek', v.stand, 'CANCELLED')) return fout(409, 'Dit verzoek kan niet meer worden ingetrokken.');
    const toegekend = TOEGEKEND.includes(v.stand);
    S.zet(v, 'verzoek', 'CANCELLED', door, tijd());
    if (toegekend) vrijgaveTerug(code, v);
    bewaar();
    return { ok: true, verzoek: v };
  }

  return { beoordeelMens, trekIn };
};
