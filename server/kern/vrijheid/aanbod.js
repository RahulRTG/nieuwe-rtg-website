/* VRIJHEID: WAT RTG AANBIEDT -- eerder naar huis, hersteltijd en de rotatie.

   FREEDOM RELEASE is geen aanvraag maar een AANBOD van RTG: "alles is
   geregeld, u kunt voor vandaag stoppen". Drie poorten, in deze volgorde:
     1 veiligheid  -- de werkstand is aantoonbaar af of over te dragen, en de
                      dekking blijft staan zonder deze mens;
     2 eerlijkheid -- kunnen niet alle kandidaten tegelijk weg, dan gaat eerst
                      wie in het venster het minst vaak eerder weg mocht;
     3 aanbod      -- de mens kiest. Niemand MOET eerder weg.
   Bij het AANVAARDEN wordt alles opnieuw gekeken: intussen kan een collega
   hetzelfde aanbod hebben aangenomen, of is de overdracht niet gebeurd. De
   uren blijven betaald en er gaat niets van een saldo af.

   Hersteltijd (RECOVERY RELEASE) staat apart in herstel.js. */
'use strict';
const T = require('./tijd');
const D = require('./dekking');
const S = require('./standen');
const { werkstand } = require('./werkstand');
const { rotatie, vrijheidsVolgorde } = require('./eerlijkheid');

module.exports = (ctx) => {
  const { org, id, fout, tijd, bewaar, zend, teamKlopt, afwezig, schrijfGrootboek, boek, roosterPas, plan } = ctx;

  function vrijheidsKansen(code, team, { datum, vanaf, beleid }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const staat = org(code);
    const moment = T.punt(datum, vanaf);
    const kandidaten = [];
    const nietAangeboden = [];
    for (const d of team.diensten || []) {
      const iv = T.interval(d);
      if (!iv || !(iv.van < moment && moment < iv.tot)) continue;
      const mens = (team.mensen || []).find(m => m.id === d.persoon);
      if (!D.inDienst(mens, d.datum)) continue;
      if (staat.aanbiedingen[id('fr', code, d.persoon, datum)]) continue;
      const ws = werkstand(team, d.persoon, datum);
      if (ws.stand !== 'WORK_COMPLETE' && ws.stand !== 'HANDOVER_POSSIBLE') { nietAangeboden.push({ persoon: d.persoon, reden: ws.uitleg }); continue; }
      kandidaten.push({ persoon: d.persoon, iv, ws });
    }
    const venster = beleid.waarde('eerlijkheid.vensterDagen');
    const volgorde = vrijheidsVolgorde(kandidaten.map(k => k.persoon), staat.grootboek, { datum, vensterDagen: venster.open ? null : venster.waarde, zaad: code + datum });
    const gekozen = [];
    const aangeboden = [];
    for (const persoon of volgorde) {
      const k = kandidaten.find(x => x.persoon === persoon);
      const afw = { persoon, van: moment, tot: k.iv.tot };
      const a = { id: id('fr', code, persoon, datum), stand: 'OPPORTUNITY_DETECTED', persoon, datum, vanaf, afwezigheid: afw,
        uren: (afw.tot - afw.van) / 60, werkstand: k.ws.stand, beleidVersie: beleid.versie, rosterVersie: team.rosterVersie || null };
      S.zet(a, 'vrijgaveAanbod', 'SAFETY_CHECK', 'systeem', tijd());
      const dek = D.toets(team, afw, afwezig(code).concat(gekozen));
      if (dek.stand !== 'SAFE') { a.reden = dek.uitleg; S.zet(a, 'vrijgaveAanbod', 'NOT_OFFERED', 'systeem', tijd()); nietAangeboden.push({ persoon, reden: dek.uitleg }); staat.aanbiedingen[a.id] = a; continue; }
      S.zet(a, 'vrijgaveAanbod', 'FAIRNESS_CHECK', 'systeem', tijd());
      S.zet(a, 'vrijgaveAanbod', 'OFFERED', 'systeem', tijd());
      a.tekst = k.ws.stand === 'HANDOVER_POSSIBLE'
        ? 'Uw werk kan worden overgedragen. Na de overdracht kunt u voor vandaag stoppen. Uw salaris en verlofsaldo veranderen niet.'
        : 'Alles is geregeld. U kunt voor vandaag stoppen. Uw salaris en verlofsaldo veranderen niet. Fijne middag.';
      gekozen.push(afw); aangeboden.push(a); staat.aanbiedingen[a.id] = a;
      zend('FREEDOM_RELEASE_OFFERED', { organisatie: code, id: a.id });
      if (k.ws.stand === 'HANDOVER_POSSIBLE') zend('HANDOVER_REQUIRED', { organisatie: code, id: a.id });
    }
    bewaar();
    return { ok: true, aangeboden, nietAangeboden };
  }

  function aanvaardVrijheid(code, team, aid, door) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    const a = org(code).aanbiedingen[aid];
    if (!a) return fout(404, 'Aanbod niet gevonden.');
    if (door !== a.persoon) return fout(403, 'Alleen de mens aan wie het is aangeboden, aanvaardt het.');
    if (a.stand !== 'OFFERED') return fout(409, 'Dit aanbod staat niet meer open (stand ' + a.stand + ').');
    const ws = werkstand(team, a.persoon, a.datum);
    if (ws.stand !== 'WORK_COMPLETE') return fout(409, 'Eerst de overdracht afronden: ' + ws.uitleg);
    const dek = D.toets(team, a.afwezigheid, afwezig(code, aid));
    if (dek.stand !== 'SAFE') { a.reden = dek.uitleg; S.zet(a, 'vrijgaveAanbod', 'EXPIRED', 'systeem', tijd()); bewaar();
      return fout(409, 'Intussen kan het niet meer: ' + dek.uitleg + ' Dat ligt niet aan u.'); }
    S.zet(a, 'vrijgaveAanbod', 'ACCEPTED', door, tijd());
    boek(code, a.id, { categorie: 'FREEDOM_RELEASE', uren: a.uren, datum: a.datum, persoon: a.persoon, betaaldeUren: a.uren }, a.afwezigheid);
    schrijfGrootboek(code, { soort: 'FREEDOM_RELEASE_GRANTED', persoon: a.persoon, datum: a.datum });
    roosterPas(code, a, { soort: 'eerder-weg', persoon: a.persoon, afwezigheid: a.afwezigheid, bron: a.id });
    S.zet(a, 'vrijgaveAanbod', a.rooster === 'ONBEKEND' ? 'RECONCILE_PENDING' : 'ROSTER_RECONCILED', 'systeem', tijd());
    zend('FREEDOM_RELEASE_ACCEPTED', { organisatie: code, id: a.id });
    bewaar();
    return { ok: true, aanbod: a };
  }

  function weigerVrijheid(code, aid, door) {
    const a = org(code).aanbiedingen[aid];
    if (!a) return fout(404, 'Aanbod niet gevonden.');
    if (door !== a.persoon) return fout(403, 'Alleen de mens aan wie het is aangeboden, beslist erover.');
    if (a.stand !== 'OFFERED') return fout(409, 'Dit aanbod staat niet meer open.');
    S.zet(a, 'vrijgaveAanbod', 'DECLINED', door, tijd()); bewaar();
    return { ok: true, aanbod: a };
  }

  /* De rotatie voor een schaars moment. Het aantal plekken volgt uit de
     DEKKING: in eerlijke volgorde krijgt iedereen het moment zolang de dekking
     blijft staan. Dus geen getal dat een manager kiest. */
  function verdeelSchaars(code, team, moment, { door }) {
    if (!teamKlopt(code, team)) return fout(403, 'Dit teambeeld hoort niet bij deze organisatie.');
    if (!(team.managers || []).includes(door)) return fout(403, 'Alleen een leidinggevende start de verdeling.');
    const staat = org(code);
    const wachtend = Object.values(staat.verzoeken).filter(v => v.stand === 'CHECKING' && v.moment === moment);
    if (!wachtend.length) return { ok: true, toegekend: [], afgewezen: [] };
    const volgorde = rotatie(wachtend.map(v => v.persoon), { moment, plekken: wachtend.length, zaad: code + '|' + moment }, staat.grootboek);
    const gekozen = []; const toegekend = []; const afgewezen = [];
    for (const r of volgorde) {
      const v = wachtend.find(x => x.persoon === r.persoon);
      const dek = D.toets(team, v.afwezigheid, afwezig(code).concat(gekozen));
      v.rotatieUitleg = r.uitleg.replace(/^(Toegekend|Niet toegekend)\. /, '');
      if (dek.stand === 'SAFE') {
        gekozen.push(v.afwezigheid); toegekend.push(v.id);
        S.zet(v, 'verzoek', 'AUTO_APPROVED', 'rotatie', tijd()); plan(code, v);
        schrijfGrootboek(code, { soort: 'POPULAR_SLOT_GRANTED', persoon: v.persoon, datum: v.datum, moment });
      } else {
        v.afwijzing = 'Het moment is eerlijk verdeeld en de dekking laat niet meer mensen toe. ' + dek.uitleg;
        S.zet(v, 'verzoek', 'DECLINED', 'rotatie', tijd()); afgewezen.push(v.id);
        schrijfGrootboek(code, { soort: 'POPULAR_SLOT_DECLINED', persoon: v.persoon, datum: v.datum, moment });
        zend('FREEDOM_DECLINED', { organisatie: code, id: v.id });
      }
    }
    bewaar();
    return { ok: true, toegekend, afgewezen };
  }

  return { vrijheidsKansen, aanvaardVrijheid, weigerVrijheid, verdeelSchaars };
};
