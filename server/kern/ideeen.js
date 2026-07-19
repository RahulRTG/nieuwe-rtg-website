/* De Ideeenkamer: de gedeelde werkbank van de vier RTG-ontwerpbureaus (Atelier,
   Ontwerpstudio, Hardwarelab en Architectenbureau). Hier bedenken de ateliers
   samen ideeen: een idee krijgt tags voor de betrokken bureaus, iedereen kan
   reageren, de AI werkt het idee uit tot een korte brief per bureau, en met
   een klik gaat het als concept naar het gekozen bureau (spin-off).

   Volgt het vaste kern-patroon maakIdeeen(state). De bureaus worden als
   referenties meegegeven zodat een spin-off echt een concept aanmaakt. */

const BUREAUS = {
  atelier:   { label: 'RTG Atelier', icon: '✂️', wat: 'mode en alles wat je draagt' },
  studio:    { label: 'RTG Ontwerpstudio', icon: '🏎️', wat: 'voertuigen en vaartuigen' },
  hardware:  { label: 'RTG Hardwarelab', icon: '🔧', wat: 'apparaten en wearables' },
  architect: { label: 'RTG Architectenbureau', icon: '🏛️', wat: 'gebouwen en huizen' }
};
const BUREAU_IDS = Object.keys(BUREAUS);
const STATUS = ['nieuw', 'in-uitwerking', 'uitgewerkt', 'geparkeerd'];

function maakIdeeen({ db, save, crypto, anthropic, schoon, bureaus }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const id = () => 'idee' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  bureaus = bureaus || {};

  function store() {
    if (!d().ideeen || typeof d().ideeen !== 'object') d().ideeen = { lijst: [] };
    if (!Array.isArray(d().ideeen.lijst)) d().ideeen.lijst = [];
    if (!d().ideeen._seed) {
      d().ideeen._seed = true;
      const o = _maak({ titel: 'Reislijn Meridiaan', brief: 'Een samenhangende reislijn: dezelfde taal in kleding, de auto, de tas en het strandpaviljoen.', bureaus: ['atelier', 'studio', 'architect'], door: 'Boardroom' });
      o.reacties.push({ door: 'Atelier', tekst: 'Wij pakken de reisgarderobe: linnen, gedempt palet.', at: nu() });
      save();
    }
    return d().ideeen;
  }
  const alle = () => store().lijst;
  const vind = iid => alle().find(o => o.id === iid);

  function schoonBureaus(arr) {
    const set = [...new Set((Array.isArray(arr) ? arr : []).map(x => String(x)))].filter(b => BUREAU_IDS.includes(b));
    return set.length ? set : BUREAU_IDS.slice();
  }

  function publiek(o) {
    return {
      id: o.id, titel: o.titel, brief: o.brief, status: o.status,
      bureaus: o.bureaus.map(b => ({ id: b, label: BUREAUS[b].label, icon: BUREAUS[b].icon })),
      uitwerking: o.uitwerking || null,
      spinoffs: o.spinoffs || [],
      reacties: o.reacties || [],
      door: o.door || null, at: o.at, updatedAt: o.updatedAt || o.at
    };
  }

  function _maak(data) {
    const o = {
      id: id(), titel: scho(data.titel, 100) || 'Naamloos idee',
      brief: scho(data.brief, 800), bureaus: schoonBureaus(data.bureaus),
      status: 'nieuw', uitwerking: null, spinoffs: [], reacties: [],
      door: scho(data.door, 60) || null, at: nu(), updatedAt: nu()
    };
    alle().unshift(o);
    if (alle().length > 2000) alle().length = 2000;
    return o;
  }

  function overzicht() {
    return {
      ok: true,
      bureaus: BUREAU_IDS.map(b => ({ id: b, label: BUREAUS[b].label, icon: BUREAUS[b].icon, wat: BUREAUS[b].wat })),
      statussen: STATUS,
      ideeen: alle().map(publiek)
    };
  }

  function ideeMaak(data) {
    if (!scho(data && data.titel, 100)) return { status: 400, error: 'Geef het idee een titel.' };
    const o = _maak(data || {}); save();
    return { ok: true, idee: publiek(o) };
  }
  function ideeZet(iid, patch) {
    const o = vind(iid); if (!o) return { status: 404, error: 'Idee niet gevonden.' };
    patch = patch || {};
    if (patch.titel != null) o.titel = scho(patch.titel, 100) || o.titel;
    if (patch.brief != null) o.brief = scho(patch.brief, 800);
    if (patch.bureaus != null) o.bureaus = schoonBureaus(patch.bureaus);
    if (patch.status != null && STATUS.includes(patch.status)) o.status = patch.status;
    o.updatedAt = nu(); save();
    return { ok: true, idee: publiek(o) };
  }
  function ideeVerwijder(iid) {
    const s = store(); s.lijst = s.lijst.filter(o => o.id !== iid); save();
    return { ok: true };
  }
  function reactie(iid, data) {
    const o = vind(iid); if (!o) return { status: 404, error: 'Idee niet gevonden.' };
    const tekst = scho(data && data.tekst, 500); if (!tekst) return { status: 400, error: 'Schrijf een reactie.' };
    o.reacties.push({ door: scho(data.door, 60) || 'Bureau', tekst, at: nu() });
    if (o.reacties.length > 200) o.reacties = o.reacties.slice(-200);
    o.updatedAt = nu(); save();
    return { ok: true, idee: publiek(o) };
  }

  function _sjabloonBrief(o) {
    const uit = {};
    for (const b of o.bureaus) {
      uit[b] = 'Voor ' + BUREAUS[b].label + ' (' + BUREAUS[b].wat + '): vertaal "' + o.titel + '" naar ' + BUREAUS[b].wat +
        '; houd de lijn ingetogen en herkenbaar, met een gedempt palet en een enkel signatuurdetail.';
    }
    return uit;
  }

  /* De AI werkt het idee uit tot een korte brief per betrokken bureau, zodat
     elk atelier meteen aan de slag kan met dezelfde gedachte. */
  async function aiUitwerken(iid) {
    const o = vind(iid); if (!o) return { status: 404, error: 'Idee niet gevonden.' };
    let uit = null;
    if (anthropic) {
      try {
        const labels = o.bureaus.map(b => '"' + b + '" = ' + BUREAUS[b].label + ' (' + BUREAUS[b].wat + ')').join(', ');
        const sys = require('./rahul').RAHUL_LEAD + 'je leidt de gezamenlijke ideeenkamer van de RTG-ontwerpbureaus. Werk het idee uit tot een korte, concrete ontwerpbrief per bureau. ' +
          'Antwoord ALLEEN met JSON met precies deze sleutels: ' + o.bureaus.map(b => '"' + b + '"').join(', ') + '. Elke waarde is een korte brief (max 2 zinnen), in het Nederlands. Bureaus: ' + labels + '.';
        const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 600, system: sys, messages: [{ role: 'user', content: 'Idee: ' + o.titel + '. ' + (o.brief || '') }] });
        const t = (r && r.content && r.content[0] && r.content[0].text || '');
        const jm = t.match(/\{[\s\S]*\}/);
        if (jm) { const p = JSON.parse(jm[0]); const acc = {};
          for (const b of o.bureaus) if (p[b]) acc[b] = scho(p[b], 400);
          if (Object.keys(acc).length) uit = acc;
        }
      } catch (e) { /* val terug op het sjabloon */ }
    }
    o.uitwerking = uit || _sjabloonBrief(o);
    if (o.status === 'nieuw') o.status = 'in-uitwerking';
    o.updatedAt = nu(); save();
    return { ok: true, idee: publiek(o) };
  }

  /* Spin-off: het idee gaat als echt concept naar het gekozen bureau. Het
     bureau maakt er een ontwerp van, met de uitgewerkte brief als vertrekpunt. */
  function spinOff(iid, bureauId) {
    const o = vind(iid); if (!o) return { status: 404, error: 'Idee niet gevonden.' };
    const b = String(bureauId || '');
    if (!BUREAU_IDS.includes(b)) return { status: 400, error: 'Kies een geldig bureau.' };
    const mod = bureaus[b];
    if (!mod || typeof mod.ontwerpMaak !== 'function') return { status: 400, error: 'Dit bureau kan nu geen concept aanmaken.' };
    const brief = (o.uitwerking && o.uitwerking[b]) ? o.uitwerking[b] : (o.brief || o.titel);
    const r = mod.ontwerpMaak({ naam: o.titel, brief, huis: 'Ideeenkamer' });
    if (r.error) return { status: r.status || 400, error: r.error };
    const spin = { bureau: b, bureauLabel: BUREAUS[b].label, ontwerpId: r.ontwerp && r.ontwerp.id, naam: o.titel, at: nu() };
    o.spinoffs.push(spin);
    if (o.status !== 'uitgewerkt') o.status = 'uitgewerkt';
    o.updatedAt = nu(); save();
    return { ok: true, idee: publiek(o), spinoff: spin };
  }

  return { ideeen: { BUREAUS, STATUS, overzicht, ideeMaak, ideeZet, ideeVerwijder, reactie, aiUitwerken, spinOff } };
}

module.exports = { maakIdeeen, IDEE_BUREAUS: BUREAUS, IDEE_STATUS: STATUS };
