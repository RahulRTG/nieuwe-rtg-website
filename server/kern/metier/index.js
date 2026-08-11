/* Métier: het beroepsprofiel van een lid. De professionele kant van RTG, en
   bewust iets anders dan LinkedIn.

   HET ONTWERP IN EEN ZIN: je profiel draait op je codenaam, RTG bevestigt wat
   het echt kan bevestigen, en je echte naam geef je per werkgever vrij uit de
   kluis -- niet aan de hele wereld, en je kunt hem intrekken.

   Waarom dat sterker is dan een naam op een profiel: op de gebruikelijke
   netwerken schrijft iedereen zijn eigen geschiedenis onder zijn eigen naam, en
   niemand controleert iets. Hier is het omgekeerd. De naam zegt niets, de
   bevestiging alles:

   - BEWEZEN ROL: wie een personeelsrol aan zijn account koppelde, heeft daarvoor
     de zaak-code en zijn eigen PIN moeten geven (kern/eenaccount.js). Dat is
     geen bewering maar een gebeurtenis, met een datum. Die rollen komen hier
     binnen als bevestigd, en het lid kan ze niet zelf verzinnen of bijschaven.
   - ZELF OPGEGEVEN: al het werk van buiten RTG mag erbij, maar staat er zichtbaar
     als onbevestigd. Eerlijk over wat we niet weten.

   Wat hier NIET komt (en zie kern/metier/netwerk.js voor hoe dit zich verhoudt
   tot kern/wereld/bezoek.js, dat het profielbezoek in de wereldlaag wel
   bijhoudt -- zonder melding, teller of ranglijst): "wie bekeek je profiel"
   als lokkertje, een feed met
   motivatiepraat, of "je bent een van de 30 sollicitanten". Dat zijn de
   bezig-houd-lussen die de huisregels verbieden. */
const { keur } = require('../veilig');

module.exports = ({ db, save, liveCodename, codenaamVan, findSupplier }) => {
  const KOP_MAX = 80;         // je beroepskop ("Sommelier, tien jaar")
  const OVER_MAX = 600;
  const ROL_MAX = 12;         // zelf opgegeven rollen
  const VAARDIG_MAX = 20;
  const PAGINA = 20;
  const nu = () => new Date().toISOString();

  function S() {
    if (!db.data.metier || typeof db.data.metier !== 'object') db.data.metier = {};
    const m = db.data.metier;
    for (const k of ['profiel', 'aanbeveling', 'onderschrijving', 'naamvrij', 'inzagelog']) {
      if (!m[k] || typeof m[k] !== 'object') m[k] = {};
    }
    return m;
  }

  const leegProfiel = () => ({ kop: '', over: '', plaats: '', open: false, rollen: [], vaardigheden: [], talen: [], portfolio: [], bij: null });
  const profielVan = (key) => { const m = S(); return m.profiel[key] || leegProfiel(); };

  /* De bewezen rollen komen uit de sleutelbos (db.data.accountRollen): daar
     staat alleen wat iemand met een PIN of bedrijfsinlog heeft aangetoond.
     Deze module SCHRIJFT daar nooit; hij leest mee. Zo kan een profiel niet
     mooier zijn dan de werkelijkheid. */
  function bewezenRollen(key) {
    const alle = (db.data.accountRollen || {})[key] || [];
    return alle.filter(r => r && (r.rol === 'personeel' || r.rol === 'zaak')).map(r => {
      const s = r.code && findSupplier ? findSupplier(r.code) : null;
      return {
        wat: r.rol === 'zaak' ? 'Eigenaar of beheer' : (r.naam || 'Medewerker'),
        waar: (s && s.name) || r.zaakNaam || r.code || 'Een RTG-zaak',
        sinds: r.at || null, bevestigd: true,
        hoe: r.rol === 'zaak' ? 'RTG zag de bedrijfsinlog' : 'RTG zag de personeels-PIN van deze zaak'
      };
    });
  }

  function kaartZet(key, invoer) {
    const m = S();
    const p = m.profiel[key] || leegProfiel();
    const v = invoer || {};
    const tekst = (waarde, max) => String(waarde == null ? '' : waarde).slice(0, max).trim();
    for (const [veld, waarde] of [['kop', tekst(v.kop, KOP_MAX)], ['over', tekst(v.over, OVER_MAX)], ['plaats', tekst(v.plaats, 60)]]) {
      if (waarde) { const k = keur(waarde); if (!k.ok) return { error: k.reden }; }
      if (v[veld] !== undefined) p[veld] = waarde;
    }
    if (v.open !== undefined) p.open = !!v.open;
    p.bij = nu();
    m.profiel[key] = p;
    save();
    return { ok: true, profiel: p };
  }

  // Een zelf opgegeven rol: werk van buiten RTG. Komt er als ONBEVESTIGD in.
  function rolZet(key, invoer) {
    const m = S();
    const p = m.profiel[key] || leegProfiel();
    const v = invoer || {};
    const wat = String(v.wat || '').slice(0, 80).trim();
    const waar = String(v.waar || '').slice(0, 80).trim();
    if (!wat || !waar) return { error: 'Wat deed je, en waar?' };
    for (const t of [wat, waar]) { const k = keur(t); if (!k.ok) return { error: k.reden }; }
    const rol = { id: rolId(p), wat, waar, van: jaar(v.van), tot: jaar(v.tot), bevestigd: false };
    p.rollen = [rol, ...(p.rollen || [])].slice(0, ROL_MAX);
    p.bij = nu();
    m.profiel[key] = p;
    save();
    return { ok: true, rol };
  }

  const jaar = (x) => { const n = Number(x); return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null; };
  function rolId(p) {
    let id = Date.now();
    while ((p.rollen || []).some(r => r.id === id)) id++;
    return id;
  }

  function rolWeg(key, id) {
    const m = S();
    const p = m.profiel[key];
    if (!p) return { error: 'Je hebt nog geen profiel.' };
    const voor = (p.rollen || []).length;
    p.rollen = (p.rollen || []).filter(r => String(r.id) !== String(id));
    if (p.rollen.length === voor) return { error: 'Deze rol staat niet op je profiel.' };
    save();
    return { ok: true };
  }

  /* Vaardigheden en talen: gewoon lijstjes woorden. Geen niveaus van 1 tot 5,
     want die zegt iedereen 5. De waarde komt van de onderschrijvingen van
     anderen (kern/metier/netwerk.js), niet van je eigen cijfer. */
  function lijstZet(key, veld, waarden) {
    if (!['vaardigheden', 'talen'].includes(veld)) return { error: 'Onbekende lijst.' };
    const m = S();
    const p = m.profiel[key] || leegProfiel();
    const uit = [];
    for (const w of (Array.isArray(waarden) ? waarden : [])) {
      const t = String(w || '').slice(0, 40).trim();
      if (!t || uit.includes(t)) continue;
      const k = keur(t); if (!k.ok) return { error: k.reden };
      uit.push(t);
      if (uit.length >= VAARDIG_MAX) break;
    }
    p[veld] = uit;
    p.bij = nu();
    m.profiel[key] = p;
    save();
    return { ok: true, [veld]: uit };
  }

  /* Wat een ander van je profiel ziet. Nooit je sleutel, nooit je naam: de
     codenaam is wie je hier bent. De naam volgt alleen langs de weg van
     kern/metier/bewijs.js, per werkgever, als jij hem vrijgeeft. */
  function publiek(key, kijkerKey, extra) {
    const p = profielVan(key);
    const e = extra || {};
    return {
      codenaam: codenaamVan(key),
      kop: p.kop || '', over: p.over || '', plaats: p.plaats || '',
      open: !!p.open,
      bewezen: bewezenRollen(key),
      rollen: p.rollen || [],
      vaardigheden: p.vaardigheden || [], talen: p.talen || [],
      ikZelf: key === kijkerKey,
      aanbevelingen: e.aanbevelingen || [], onderschreven: e.onderschreven || {},
      naamVrij: !!e.naamVrij
    };
  }

  return { S, leegProfiel, profielVan, bewezenRollen, kaartZet, rolZet, rolWeg, lijstZet, publiek, PAGINA };
};
