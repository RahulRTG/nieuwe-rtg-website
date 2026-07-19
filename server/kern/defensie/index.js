/* De defensie-toren: de administratieve, logistieke en zorg-ruggengraat van
   een krijgsmacht op het RTG-platform. Hetzelfde slimme-backoffice-motorwerk
   als bij de andere sectoren, maar dan voor defensie: eenheden en paraatheid,
   materieel en onderhoud, bevoorrading, oefeningen, een veldhospitaal met triage
   en verplaatsingen.

   NADRUKKELIJK BUITEN SCOPE, met opzet: dit is GEEN wapensysteem. Er is geen
   vuurleiding, geen doelselectie, geen aanvalsplanning en geen enkele
   gevechtsaansturing. Het is een organisatie-, logistiek- en oefensysteem;
   voor werkelijke operaties gelden altijd de eigen commandostructuur en
   voorschriften. De AI helpt met plannen en logistiek en weigert alles wat
   richting wapeninzet of doelbestrijding gaat. Dit is de orkestrator: de
   constanten, de state-bak, het commando-overzicht en de staf-AI wonen hier;
   eenheden/materieel/bevoorrading/oefeningen in ./beheer, het veldhospitaal en
   de verplaatsingen in ./veld. */

const DEF_TYPES = {
  defensie: { label: 'Defensie', icon: '\u{1F396}\u{FE0F}', caps: ['location'], besloten: true }
};
const PARAAT = ['gevechtsgereed', 'beperkt', 'in-onderhoud', 'niet-inzetbaar'];
const MAT_STAAT = ['inzetbaar', 'in-onderhoud', 'defect'];
const MAT_SOORTEN = ['voertuig', 'vaartuig', 'luchtvaartuig', 'uitrusting', 'medisch', 'verbinding'];
const BEV_SOORTEN = ['brandstof', 'rantsoenen', 'onderdelen', 'medisch', 'verbinding', 'overig'];
const BEV_KETEN = ['aangevraagd', 'goedgekeurd', 'onderweg', 'geleverd', 'afgewezen'];
const TRIAGE = ['rood', 'oranje', 'geel', 'groen', 'blauw'];
const VERPL_SOORT = ['land', 'water', 'lucht'];
const VERPL_LADING = ['troepen', 'materieel', 'gewonden', 'voorraad'];
const VERPL_KETEN = ['gepland', 'onderweg', 'aangekomen', 'afgelast'];

module.exports = ({ db, save, crypto, anthropic }) => {
  const nu = () => Date.now();
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
  const isDef = s => !!s && s.type === 'defensie';
  function bak(code) {
    if (!db.data.defensie) db.data.defensie = {};
    const d = db.data.defensie;
    if (!d[code]) d[code] = { eenheden: [], materieel: [], bevoorrading: [], oefeningen: [], gewonden: [], verplaatsingen: [] };
    for (const k of ['eenheden', 'materieel', 'bevoorrading', 'oefeningen', 'gewonden', 'verplaatsingen']) if (!Array.isArray(d[code][k])) d[code][k] = [];
    return d[code];
  }
  function gewondenGesorteerd(code) {
    return bak(code).gewonden.filter(g => g.status !== 'ontslagen' && g.status !== 'geevacueerd')
      .slice().sort((a, b) => TRIAGE.indexOf(a.triage) - TRIAGE.indexOf(b.triage) || a.at - b.at);
  }

  /* ---------- het commando-overzicht ---------- */
  function overzicht(s) {
    if (!isDef(s)) return { status: 403, error: 'Dit is geen defensie-organisatie.' };
    const d = bak(s.code);
    const tel = p => d.eenheden.filter(e => e.paraat === p).length;
    return {
      ok: true, code: s.code, naam: s.name,
      paraatheid: { gevechtsgereed: tel('gevechtsgereed'), beperkt: tel('beperkt'), inOnderhoud: tel('in-onderhoud'), nietInzetbaar: tel('niet-inzetbaar') },
      eenheden: d.eenheden.slice(0, 100),
      materieel: d.materieel.slice(0, 100),
      materieelDefect: d.materieel.filter(m => m.staat === 'defect').length,
      bevoorrading: d.bevoorrading.filter(v => !['geleverd', 'afgewezen'].includes(v.status)).slice(0, 50),
      oefeningen: d.oefeningen.filter(o => o.status !== 'afgerond' && o.status !== 'afgelast').slice(0, 30),
      gewonden: gewondenGesorteerd(s.code),
      verplaatsingen: d.verplaatsingen.filter(v => v.status !== 'aangekomen' && v.status !== 'afgelast').slice(0, 30),
      ziekenhuizen: (db.data.suppliers || []).filter(x => x.type === 'ziekenhuis').map(x => ({ code: x.code, naam: x.name }))
    };
  }

  /* ---------- de staf-AI: logistiek en planning, nooit wapeninzet ---------- */
  async function stafAi(s, vraag) {
    const v = schoon(vraag, 400);
    if (!v) return { status: 400, error: 'Wat wilt u weten?' };
    // harde grens: alles wat richting wapeninzet, doelbestrijding of aanvals-
    // planning gaat, wordt geweigerd; dit systeem is logistiek en organisatie.
    if (/\b(doelwit|target|vuurleiding|aanval(?:s|len|)|wapen|munitie richten|bestrijd|raket lanceer|luchtaanval|artillerie.?vuur)\b/i.test(v))
      return { ok: true, antwoord: 'Daar ga ik niet in mee: dit is een logistiek- en organisatiesysteem, geen wapen- of vuurleidingssysteem. Ik help wel met paraatheid, materieel, onderhoud, bevoorrading en oefeningen. Voor operationele inzet gelden altijd uw eigen commandostructuur en voorschriften.' };
    const o = overzicht(s);
    const beeld = 'Eenheid: ' + s.name + '. Paraat: ' + JSON.stringify(o.paraatheid) + '. Defect materieel: ' + o.materieelDefect +
      '. Open bevoorrading: ' + (o.bevoorrading || []).map(b => b.prioriteit + ' ' + b.wat).join('; ');
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('../rahul').RAHUL_LEAD + 'je bent de logistiek- en stafassistent van een defensie-eenheid op het RTG-platform. Je helpt met paraatheid, materieel, onderhoud, bevoorrading en oefeningen, kort en concreet. ' +
            'Je bent NADRUKKELIJK geen wapen- of vuurleidingssysteem: je geeft nooit doelen, aanvalsadvies of gevechtsaansturing en wijst zulke vragen vriendelijk af. Dit is een demonstratie- en organisatieomgeving. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t };
      } catch (e) { /* de vaste hulp hieronder vangt het op */ }
    }
    return { ok: true, antwoord: 'Op het bord: ' + o.paraatheid.gevechtsgereed + ' eenhe(i)d(en) gevechtsgereed, ' + o.materieelDefect + ' stuk(s) materieel defect, ' +
      (o.bevoorrading || []).length + ' open bevoorradingsverzoek(en). Pak de hoogste prioriteit eerst; meld defect materieel in de onderhoudsketen. Dit is de demo-omgeving voor logistiek en organisatie.' };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, nu, schoon, bak,
    PARAAT, MAT_STAAT, MAT_SOORTEN, BEV_SOORTEN, BEV_KETEN, TRIAGE, VERPL_SOORT, VERPL_LADING, VERPL_KETEN };
  const api = { DEF_TYPES, PARAAT, MAT_SOORTEN, BEV_SOORTEN, TRIAGE, VERPL_SOORT, VERPL_LADING, isDef, overzicht, stafAi };
  Object.assign(api, require('./beheer')(ctx), require('./veld')(ctx));
  return { defensie: api };
};
module.exports.DEF_TYPES = DEF_TYPES;
