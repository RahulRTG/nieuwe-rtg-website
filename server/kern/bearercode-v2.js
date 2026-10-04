/* BEARERCODE VERSIE 2 -- het Access/Grant-contract voor een drager.

   Geen nieuwe laag: ./bearercode.js laadt dit bestand en geeft het door aan
   elke aanroeper die `geldigheid` meegeeft. Wie dat niet doet, blijft op v1 en
   merkt niets. Dit staat los omdat bearercode.js anders over de bestandsgrens
   gaat, niet omdat het een tweede primitive is.

   Wat v2 toevoegt, en waarom (UITVOERINGSPLAN-AUTHORITY par. 3):
     geldigheid   verplicht en eindig: { duurMs } of { verlooptOp }. Geen
                  stille 30 dagen meer; ongeldig is een weigering bij uitgifte.
     gebruik      { max } of 'sessie'. 'sessie' vervangt max_gebruik = 0, zodat
                  onbeperkt gebruik niet meer per ongeluk kan ontstaan.
     afgeleid     'geen' | 'perAanroep' | 'sluit': hoe toegang sluit die uit de
                  code is ONTSTAAN. trekIn() roept de sluitfunctie aan en geeft
                  de uitslag terug; een onbekende uitslag wordt nooit nul.
     contracthash over de beveiligingsvelden. Wie na de uitgifte het einde, de
                  scope of de hash overschrijft, krijgt `gemanipuleerd` en geen
                  werkende code.
     roteer       nieuwe code, oude ingetrokken, einde NOOIT later.
     leidAf       een kindtoegang die alleen kan versmallen.
   Een v2-controle zonder doel of scope is `controle-onvolledig`: leeg is dicht. */
'use strict';

const AFGELEID = new Set(['geen', 'perAanroep', 'sluit']);
const STAPOP = new Set(['geen', 'uitgifte', 'gebruik', 'beide']);
const VELDEN = ['issuer', 'doel', 'scope', 'onderwerp', 'issued_at', 'expires_at', 'max_gebruik',
  'gebruiksvorm', 'code_hash', 'bron_toegang', 'stapOp', 'afgeleid'];
const GESCHIEDENIS_MAX = 20;

/* Een vaste volgorde van sleutels, zodat dezelfde inhoud dezelfde hash geeft. */
function stabiel(v) {
  if (Array.isArray(v)) return '[' + v.map(stabiel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stabiel(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

const fout = (code, tekst) => Object.assign(new Error('bearercode v2: ' + tekst), { code });

module.exports = ({ crypto, ns, nu, hash, codeNieuw, plafondMs, sluit, spoor }) => {
  const contracthash = t => {
    const deel = {};
    for (const k of VELDEN) deel[k] = t[k] === undefined ? null : t[k];
    return crypto.createHash('sha256').update('rtg-bearer-v2|' + ns + '|' + stabiel(deel)).digest('hex');
  };
  const meld = (soort, t) => { if (spoor) spoor({ soort, namespace: ns, doel: t.doel, at: nu() }); };

  function einde(geldigheid, uitgifte) {
    const start = Date.parse(uitgifte);
    const g = geldigheid && typeof geldigheid === 'object' ? geldigheid : null;
    let tot = NaN;
    if (g && 'duurMs' in g && !('verlooptOp' in g)) {
      const d = g.duurMs;
      if (typeof d === 'number' && Number.isFinite(d) && d >= 1000) tot = start + Math.min(d, plafondMs);
    } else if (g && 'verlooptOp' in g && !('duurMs' in g)) {
      const t = typeof g.verlooptOp === 'string' ? Date.parse(g.verlooptOp) : NaN;
      if (Number.isFinite(t) && t - start >= 1000) tot = Math.min(t, start + plafondMs);
    }
    if (!Number.isFinite(tot)) throw fout('geldigheid-ongeldig', 'geldigheid moet { duurMs } of { verlooptOp } zijn, eindig en minstens een seconde vooruit');
    return new Date(tot).toISOString();
  }

  function gebruiksvorm(gebruik) {
    if (gebruik === 'sessie') return { gebruiksvorm: 'sessie', max_gebruik: 0 };
    const m = gebruik && typeof gebruik === 'object' ? gebruik.max : undefined;
    if (!Number.isSafeInteger(m) || m < 1 || m > 10000) throw fout('gebruik-ongeldig', "gebruik moet { max: 1..10000 } of 'sessie' zijn");
    return { gebruiksvorm: 'teller', max_gebruik: m };
  }

  function maak({ prefix, issuer, doel, scope, onderwerp, geldigheid, gebruik, afgeleid, stapOp = 'geen', bron_toegang = null }) {
    if (!AFGELEID.has(afgeleid)) throw fout('afgeleid-onverklaard', "afgeleid moet 'geen', 'perAanroep' of 'sluit' zijn");
    if (afgeleid === 'sluit' && typeof sluit !== 'function') throw fout('afgeleid-onverklaard', "afgeleid 'sluit' vraagt een sluitfunctie bij de fabriek");
    if (!STAPOP.has(stapOp)) throw fout('stapop-ongeldig', 'onbekende stapOp');
    const issued_at = nu();
    const kaleCode = codeNieuw(prefix);
    const t = Object.assign({
      code_hash: hash(kaleCode),
      issuer: String(issuer || '').trim().slice(0, 100),
      doel: String(doel || '').trim().slice(0, 100),
      scope: [...new Set([].concat(scope || []).map(x => String(x || '').trim()).filter(Boolean))],
      onderwerp: JSON.parse(JSON.stringify(onderwerp || {})),
      issued_at,
      expires_at: einde(geldigheid, issued_at)
    }, gebruiksvorm(gebruik), {
      gebruik: 0, laatst_gebruikt_at: null, ingetrokken_at: null, ingetrokken_door: null, intrekreden: null,
      rotatie: 1, contractversie: 2, afgeleid, stapOp, bron_toegang, geschiedenis: []
    });
    if (!t.issuer || !t.doel || !t.scope.length) throw fout('onvolledig', 'issuer, doel en scope zijn verplicht');
    t.contracthash = contracthash(t);
    meld('uitgegeven', t);
    return { code: kaleCode, toegang: t };
  }

  /* De v2-controles die VOOR de v1-weigervolgorde gaan. null = door naar v1. */
  function voorReden(t, verwacht) {
    if (t.contracthash !== contracthash(t)) return 'gemanipuleerd';
    if (!verwacht.doel || ![].concat(verwacht.scope || []).length) return 'controle-onvolledig';
    return null;
  }
  /* En die erna: het gebruik van een sessie telt niet af, en een step-up die
     het doel eist moet bewezen zijn. */
  function naReden(t, verwacht, v1) {
    if (v1 === 'opgebruikt' && t.gebruiksvorm === 'sessie') v1 = null;
    if (v1) return v1;
    if ((t.stapOp === 'gebruik' || t.stapOp === 'beide') && !verwacht.stapBewezen) return 'stap-op-vereist';
    return null;
  }

  async function trekIn(t, intrekken, actor, reden) {
    intrekken(t, actor, reden);          // eerst vast: wat er daarna ook misgaat, de code is dicht
    meld('ingetrokken', t);
    if (t.contractversie !== 2) return { toegang: t, afgeleid: { onbekend: 'een v1-record verklaart geen afgeleide toegang' } };
    if (t.afgeleid !== 'sluit') return { toegang: t, afgeleid: { nietNodig: t.afgeleid } };
    try {
      const uit = await sluit(t);
      if (uit && Number.isSafeInteger(uit.gesloten) && uit.gesloten >= 0) return { toegang: t, afgeleid: { gesloten: uit.gesloten } };
      return { toegang: t, afgeleid: { onbekend: (uit && uit.onbekend) || 'de sluitfunctie gaf geen telling' } };
    } catch (e) {
      return { toegang: t, afgeleid: { onbekend: 'de sluitfunctie faalde: ' + String(e && e.message || e).slice(0, 120) } };
    }
  }

  function roteer(oud, intrekken, { actor, prefix, afgeleid } = {}) {
    /* Een INGETROKKEN toegang mag roteren: zo krijgt de houder van een gestolen
       code een nieuwe (de cadeaukaart doet precies dat). De eerste intrekking
       blijft dan staan; een verlopen toegang roteert niet, want het einde schuift
       nooit op. */
    if (!oud) throw fout('niet-roteerbaar', 'er is geen toegang om te roteren');
    const nieuw = maak({ prefix, issuer: oud.issuer, doel: oud.doel, scope: oud.scope, onderwerp: oud.onderwerp,
      geldigheid: { verlooptOp: oud.expires_at },
      gebruik: oud.gebruiksvorm === 'sessie' ? 'sessie' : { max: oud.max_gebruik },
      afgeleid: oud.afgeleid || afgeleid, stapOp: oud.stapOp || 'geen', bron_toegang: oud.bron_toegang || null });
    const t = nieuw.toegang;
    t.gebruik = oud.gebruik;
    t.rotatie = (Number(oud.rotatie) || 1) + 1;
    const nu_ = nu();
    t.geschiedenis = [].concat(oud.geschiedenis || [], [{ rotatie: oud.rotatie || 1, geroteerd_at: nu_, door: String(actor || 'onbekend').slice(0, 100) }])
      .slice(-GESCHIEDENIS_MAX);
    intrekken(oud, actor, 'geroteerd');
    meld('geroteerd', t);
    return nieuw;
  }

  /* Een kind kan alleen VERSMALLEN: scope deelverzameling, einde niet later,
     gebruik niet meer dan wat de ouder nog heeft. Een verzoek om meer is een
     weigering, geen stille inkorting -- wie meer vraagt, hoort dat te horen. */
  function leidAf(ouder, verzoek, redenVan) {
    const r = redenVan(ouder, { doel: ouder && ouder.doel, scope: ouder && ouder.scope, negeerGebruik: ouder && ouder.gebruiksvorm === 'sessie', stapBewezen: true });
    if (r) throw fout('ouder-ongeldig', 'de oudertoegang is ' + r);
    const v = verzoek || {};
    const scope = [].concat(v.scope || []);
    if (!scope.length || scope.some(s => !ouder.scope.includes(s))) throw fout('verbreding', 'de scope van een kind valt binnen die van de ouder');
    let gebruik = v.gebruik;
    if (ouder.gebruiksvorm !== 'sessie') {
      const rest = ouder.max_gebruik - ouder.gebruik;
      if (gebruik === 'sessie' || !gebruik || !(gebruik.max <= rest)) throw fout('verbreding', 'een kind krijgt hooguit ' + rest + ' gebruik(en)');
    }
    const kind = maak({ prefix: v.prefix, issuer: v.issuer, doel: ouder.doel, scope, onderwerp: ouder.onderwerp,
      geldigheid: v.geldigheid, gebruik, afgeleid: v.afgeleid || ouder.afgeleid, stapOp: ouder.stapOp, bron_toegang: ouder.code_hash });
    if (Date.parse(kind.toegang.expires_at) > Date.parse(ouder.expires_at)) {
      kind.toegang.expires_at = ouder.expires_at;
      kind.toegang.contracthash = contracthash(kind.toegang);
    }
    return kind;
  }

  return { maak, voorReden, naReden, trekIn, roteer, leidAf, contracthash };
};

module.exports.VELDEN = VELDEN;
module.exports.GESCHIEDENIS_MAX = GESCHIEDENIS_MAX;
