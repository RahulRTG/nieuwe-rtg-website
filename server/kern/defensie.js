/* De defensie-toren: de administratieve, logistieke en zorg-ruggengraat van
   een krijgsmacht op het RTG-platform. Hetzelfde slimme-backoffice-motorwerk
   als bij de andere sectoren, maar dan voor defensie:

   - Eenheden en paraatheid: elke eenheid meldt haar gereedheid (gevechts-
     gereed, beperkt inzetbaar, in onderhoud, niet inzetbaar) met een reden;
     het commando ziet de vloot in een oogopslag.
   - Materieel en onderhoud: het park (voertuigen, vaartuigen, luchtvaartuigen,
     uitrusting) met de staat (inzetbaar, in onderhoud, defect) en de
     onderhoudsketen.
   - Bevoorrading: verzoeken om brandstof, rantsoenen, onderdelen, medisch;
     aangevraagd -> goedgekeurd -> geleverd, met prioriteit.
   - Oefeningen: de trainings- en oefenagenda.

   NADRUKKELIJK BUITEN SCOPE, met opzet: dit is GEEN wapensysteem. Er is geen
   vuurleiding, geen doelselectie, geen aanvalsplanning en geen enkele
   gevechtsaansturing. Het is een organisatie-, logistiek- en oefensysteem;
   voor werkelijke operaties gelden altijd de eigen commandostructuur en
   voorschriften. De AI helpt met plannen en logistiek en weigert alles wat
   richting wapeninzet of doelbestrijding gaat. */

const DEF_TYPES = {
  defensie: { label: 'Defensie', icon: '\u{1F396}\u{FE0F}', caps: ['location'], besloten: true }
};
const PARAAT = ['gevechtsgereed', 'beperkt', 'in-onderhoud', 'niet-inzetbaar'];
const MAT_STAAT = ['inzetbaar', 'in-onderhoud', 'defect'];
const MAT_SOORTEN = ['voertuig', 'vaartuig', 'luchtvaartuig', 'uitrusting', 'medisch', 'verbinding'];
const BEV_SOORTEN = ['brandstof', 'rantsoenen', 'onderdelen', 'medisch', 'verbinding', 'overig'];
const BEV_KETEN = ['aangevraagd', 'goedgekeurd', 'onderweg', 'geleverd', 'afgewezen'];

module.exports = ({ db, save, crypto, anthropic, findSupplier }) => {
  const nu = () => Date.now();
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
  const isDef = s => !!s && s.type === 'defensie';
  function bak(code) {
    if (!db.data.defensie) db.data.defensie = {};
    const d = db.data.defensie;
    if (!d[code]) d[code] = { eenheden: [], materieel: [], bevoorrading: [], oefeningen: [] };
    for (const k of ['eenheden', 'materieel', 'bevoorrading', 'oefeningen']) if (!Array.isArray(d[code][k])) d[code][k] = [];
    return d[code];
  }

  /* ---------- eenheden en paraatheid ---------- */
  function eenheidMaak(code, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet de eenheid?' };
    const d = bak(code);
    if (d.eenheden.length >= 200) return { status: 400, error: 'Het maximum aantal eenheden op dit bord is bereikt.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam, soort: schoon(b.soort, 30) || 'eenheid', paraat: 'gevechtsgereed', reden: '', sterkte: Math.max(0, Math.min(100000, Math.round(Number(b.sterkte) || 0))), at: nu() };
    d.eenheden.unshift(e);
    save();
    return { ok: true, eenheid: e };
  }
  function paraatZet(code, id, paraat, reden) {
    const e = bak(code).eenheden.find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (!PARAAT.includes(paraat)) return { status: 400, error: 'Kies gevechtsgereed, beperkt, in-onderhoud of niet-inzetbaar.' };
    e.paraat = paraat;
    e.reden = schoon(reden, 200);
    e.at = nu();
    save();
    return { ok: true, eenheid: e };
  }

  /* ---------- materieel en onderhoud ---------- */
  function materieelMaak(code, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Welk materieel?' };
    if (!MAT_SOORTEN.includes(b.soort)) return { status: 400, error: 'Kies een soort: ' + MAT_SOORTEN.join(', ') + '.' };
    const m = { id: crypto.randomBytes(4).toString('hex'), naam, soort: b.soort, kenmerk: schoon(b.kenmerk, 40), staat: 'inzetbaar', notitie: '', at: nu() };
    bak(code).materieel.unshift(m);
    save();
    return { ok: true, materieel: m };
  }
  function materieelZet(code, id, staat, notitie) {
    const m = bak(code).materieel.find(x => x.id === id);
    if (!m) return { status: 404, error: 'Dit materieel staat niet in het park.' };
    if (!MAT_STAAT.includes(staat)) return { status: 400, error: 'Kies inzetbaar, in-onderhoud of defect.' };
    m.staat = staat;
    m.notitie = schoon(notitie, 200);
    m.at = nu();
    save();
    return { ok: true, materieel: m };
  }

  /* ---------- bevoorrading: aanvraag tot levering ---------- */
  function bevoorradingMaak(code, b) {
    if (!BEV_SOORTEN.includes(b.soort)) return { status: 400, error: 'Kies een soort: ' + BEV_SOORTEN.join(', ') + '.' };
    const wat = schoon(b.wat, 120);
    if (!wat) return { status: 400, error: 'Wat is er nodig?' };
    const v = { id: crypto.randomBytes(4).toString('hex'), soort: b.soort, wat, aantal: schoon(b.aantal, 40),
      prioriteit: ['hoog', 'normaal', 'laag'].includes(b.prioriteit) ? b.prioriteit : 'normaal', status: 'aangevraagd', logboek: [], at: nu() };
    v.logboek.push({ at: nu(), wat: 'Aangevraagd (' + v.prioriteit + ')' });
    bak(code).bevoorrading.unshift(v);
    save();
    return { ok: true, verzoek: v };
  }
  function bevoorradingZet(code, id, status) {
    const v = bak(code).bevoorrading.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit verzoek staat niet op het bord.' };
    if (!BEV_KETEN.includes(status)) return { status: 400, error: 'Onbekende status.' };
    v.status = status;
    v.logboek.push({ at: nu(), wat: status });
    if (v.logboek.length > 20) v.logboek.shift();
    save();
    return { ok: true, verzoek: v };
  }

  /* ---------- oefeningen: de trainingsagenda ---------- */
  function oefeningMaak(code, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Hoe heet de oefening?' };
    const o = { id: crypto.randomBytes(4).toString('hex'), naam, wanneer: schoon(b.wanneer, 40), locatie: schoon(b.locatie, 60), doel: schoon(b.doel, 200), status: 'gepland', at: nu() };
    bak(code).oefeningen.unshift(o);
    save();
    return { ok: true, oefening: o };
  }
  function oefeningZet(code, id, status) {
    const o = bak(code).oefeningen.find(x => x.id === id);
    if (!o) return { status: 404, error: 'Deze oefening staat niet in de agenda.' };
    if (!['gepland', 'bezig', 'afgerond', 'afgelast'].includes(status)) return { status: 400, error: 'Onbekende status.' };
    o.status = status;
    save();
    return { ok: true, oefening: o };
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
      oefeningen: d.oefeningen.filter(o => o.status !== 'afgerond' && o.status !== 'afgelast').slice(0, 30)
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
          system: require('./rahul').RAHUL_LEAD + 'je bent de logistiek- en stafassistent van een defensie-eenheid op het RTG-platform. Je helpt met paraatheid, materieel, onderhoud, bevoorrading en oefeningen, kort en concreet. ' +
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

  return { defensie: { DEF_TYPES, PARAAT, MAT_SOORTEN, BEV_SOORTEN, isDef, overzicht, eenheidMaak, paraatZet, materieelMaak, materieelZet, bevoorradingMaak, bevoorradingZet, oefeningMaak, oefeningZet, stafAi } };
};
module.exports.DEF_TYPES = DEF_TYPES;
