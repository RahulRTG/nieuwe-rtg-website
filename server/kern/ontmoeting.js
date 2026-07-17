/* Kern-module "ontmoeting": Salon-ontmoetingen tussen wederzijdse connecties.

   Het idee: twee leden die al met elkaar verbonden zijn (vrienden in De Salon)
   en die deze functie allebei zelf hebben aangezet, krijgen een seintje als ze
   dicht bij elkaar in de buurt zijn. Ze kiezen dan elk een activiteit, of doen
   niets (niets doen telt als afwijzen). Kiezen ze hetzelfde, dan gaan ze dat
   doen. Kiezen ze verschillend, dan luistert het systeem naar de vrouw; is dat
   niet te bepalen, dan wint de rustigste keuze.

   Gaan ze akkoord, dan tekenen ze allebei een contract in de app. Daarmee geven
   ze RTG-kantoor toestemming om hun live-locatie te zien tot de afspraak klaar
   is, en om bij een SOS meteen mee te luisteren en te kijken via de camera en
   direct de hulpdiensten te bellen. De functie staat standaard uit; elk lid zet
   hem zelf aan en uit.

   Voorwaarden om mee te doen: een actief RTG-geverifieerd paspoort en minstens
   18 jaar. Het geslacht (voor de "naar de vrouw"-regel) komt uit dat paspoort.

   maakOntmoeting(state) volgt het vaste kern-patroon: draagt state, praat niet
   rechtstreeks met de buitenwereld, en is los te testen. */

const RADIUS_M = 250;                        // "in de buurt": binnen deze straal
const POS_TTL_MS = 6 * 60 * 1000;            // een positie is zo lang vers voor de radar
const VOORSTEL_TTL_MS = 12 * 60 * 1000;      // een voorstel verloopt vanzelf (niets doen = afwijzen)
const MIN_LEEFTIJD = 18;

// Rangorde "rustig" -> "uitbundig"; bij een gelijkspel zonder vrouw wint de rustigste.
const ACTIVITEITEN = [
  { id: 'wandelen', label: 'Wandelen', icon: '\u{1F6B6}', tekst: 'Een rustige wandeling', rust: 0 },
  { id: 'borrelen', label: 'Borrelen', icon: '\u{1F942}', tekst: 'Iets drinken op een terras', rust: 1 },
  { id: 'jetset',   label: 'Jetset',   icon: '✨',    tekst: 'Uitgaan in stijl', rust: 2 }
];
const ACT_IDS = ACTIVITEITEN.map(a => a.id);

function maakOntmoeting({ db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice, connectieTussen, verbActief, zijnVrienden, codenaamVan, haversine }) {
  const id = () => crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();
  const paar = (a, b) => [a, b].sort().join('|');

  function lijsten() {
    if (!db.data.ontmoetVoorkeur) db.data.ontmoetVoorkeur = {};   // key -> { aan, at }
    if (!db.data.ontmoetPosities) db.data.ontmoetPosities = {};   // key -> { lat, lng, at }
    if (!Array.isArray(db.data.ontmoetVoorstellen)) db.data.ontmoetVoorstellen = [];
    if (!Array.isArray(db.data.ontmoetDates)) db.data.ontmoetDates = [];
  }

  /* ---- wie mag meedoen: 18+ met actief RTG-geverifieerd paspoort ---- */
  function accountVanKey(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    try { return accounts.getUserById(Number(m[1])); } catch (e) { return null; }
  }
  function memberState(u) { try { return accounts.getMemberState(u.id) || {}; } catch (e) { return {}; } }
  function geslachtVan(key) {
    const u = accountVanKey(key);
    if (!u || u.verified !== 'verified') return null;      // alleen uit een geverifieerd paspoort
    const g = String(memberState(u).geslacht || '').toLowerCase();
    return (g === 'v' || g === 'm') ? g : null;            // 'x'/onbekend telt als onbepaald
  }
  function mag(key) {
    const u = accountVanKey(key);
    if (!u) return { ok: false, reden: 'Alleen voor RTG-leden met een eigen account.' };
    if (u.verified !== 'verified') return { ok: false, reden: 'Activeer eerst uw RTG-geverifieerde paspoort.' };
    const md = memberState(u);
    const lft = md.geboren ? leeftijdVan(md.geboren) : null;
    if (lft == null || lft < MIN_LEEFTIJD) return { ok: false, reden: 'Ontmoetingen zijn vanaf ' + MIN_LEEFTIJD + ' jaar.' };
    return { ok: true };
  }

  /* ---- de aan/uit-knop (elk lid zelf) ---- */
  function staatAan(key) { lijsten(); const v = db.data.ontmoetVoorkeur[key]; return !!(v && v.aan); }
  function zet(key, aan) {
    lijsten();
    if (aan) {
      const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
      db.data.ontmoetVoorkeur[key] = { aan: true, at: nu() };
    } else {
      db.data.ontmoetVoorkeur[key] = { aan: false, at: nu() };
      delete db.data.ontmoetPosities[key];
      // openstaande voorstellen van/aan dit lid vervallen
      for (const v of db.data.ontmoetVoorstellen) if (v.status === 'open' && (v.a === key || v.b === key)) v.status = 'afgewezen';
    }
    save();
    return { status: 200, ok: true, aan: !!aan };
  }

  /* ---- positie doorgeven en de radar laten lopen ----
     Terwijl de functie aanstaat stuurt de app af en toe de positie mee. We
     bewaren alleen de laatste positie (kort houdbaar) en kijken of een verbonden
     vriend die ook aanstaat vlakbij is. Zo ja, dan ontstaat er een voorstel. */
  function pos(key, lat, lng) {
    lijsten();
    if (!staatAan(key)) return { status: 409, error: 'Zet Ontmoetingen eerst aan.' };
    const m = mag(key); if (!m.ok) { zet(key, false); return { status: 403, error: m.reden }; }
    if (Number.isFinite(lat) && Number.isFinite(lng)) db.data.ontmoetPosities[key] = { lat, lng, at: nu() };
    const nieuwe = radar(key);
    save();
    return { status: 200, ok: true, nieuwe };
  }
  function versePositie(key) {
    const p = db.data.ontmoetPosities[key];
    if (!p || !Number.isFinite(p.lat)) return null;
    if (Date.now() - new Date(p.at).getTime() > POS_TTL_MS) return null;
    return p;
  }
  function radar(key) {
    const mij = versePositie(key);
    if (!mij) return [];
    const nieuw = [];
    for (const c of db.data.connections) {
      if (!verbActief(c)) continue;
      if (c.a !== key && c.b !== key) continue;
      const ander = c.a === key ? c.b : c.a;
      if (!staatAan(ander)) continue;
      const m2 = mag(ander); if (!m2.ok) continue;
      const zij = versePositie(ander);
      if (!zij) continue;
      if (haversine(mij, zij) > RADIUS_M) continue;
      // is er al een open of lopend voorstel/afspraak? dan niets nieuws
      if (lopendVoorstel(key, ander) || lopendeDate(key, ander)) continue;
      const v = {
        id: id(), a: key, b: ander, at: nu(), status: 'open',
        vervalt: new Date(Date.now() + VOORSTEL_TTL_MS).toISOString(),
        keuzes: {}, dateId: null
      };
      db.data.ontmoetVoorstellen.unshift(v);
      db.data.ontmoetVoorstellen = db.data.ontmoetVoorstellen.slice(0, 4000);
      for (const k of [key, ander]) {
        sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
        notify(k, { icon: '\u{1F31F}', title: 'Iemand in de buurt', body: 'Een connectie is vlakbij. Kies samen: Wandelen, Borrelen of Jetset.', scope: 'ontmoeting' });
      }
      nieuw.push(v.id);
    }
    return nieuw;
  }
  function lopendVoorstel(a, b) {
    return db.data.ontmoetVoorstellen.find(v => v.status === 'open' && paar(v.a, v.b) === paar(a, b) && !verlopenVoorstel(v));
  }
  function lopendeDate(a, b) {
    return db.data.ontmoetDates.find(d => ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status) && paar(d.a, d.b) === paar(a, b));
  }
  function verlopenVoorstel(v) { return v.vervalt && new Date(v.vervalt).getTime() < Date.now(); }

  /* ---- een keuze maken (of niets doen = afwijzen) ---- */
  function kies(key, voorstelId, keuze) {
    lijsten();
    const v = db.data.ontmoetVoorstellen.find(x => x.id === voorstelId);
    if (!v || (v.a !== key && v.b !== key)) return { status: 404, error: 'Voorstel niet gevonden.' };
    if (v.status !== 'open' || verlopenVoorstel(v)) { if (v.status === 'open') v.status = 'verlopen'; save(); return { status: 409, error: 'Dit voorstel is verlopen.' }; }
    if (keuze === 'afwijzen') {
      v.status = 'afgewezen'; save();
      const ander = v.a === key ? v.b : v.a;
      sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
      return { status: 200, ok: true, status2: 'afgewezen' };
    }
    if (!ACT_IDS.includes(keuze)) return { status: 400, error: 'Kies Wandelen, Borrelen of Jetset.' };
    v.keuzes[key] = keuze;
    const ander = v.a === key ? v.b : v.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    // pas matchen als allebei gekozen hebben
    if (v.keuzes[v.a] && v.keuzes[v.b]) {
      const gekozen = beslisActiviteit(v.keuzes[v.a], v.keuzes[v.b], geslachtVan(v.a), geslachtVan(v.b));
      v.status = 'gematcht'; v.activiteit = gekozen;
      const d = maakDate(v.a, v.b, gekozen, v.id);
      v.dateId = d.id;
      save();
      for (const k of [v.a, v.b]) {
        sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
        notify(k, { icon: actIcon(gekozen), title: 'Het is een match', body: 'Jullie gaan ' + actLabel(gekozen).toLowerCase() + '. Teken het veiligheidscontract om te starten.', scope: 'ontmoeting' });
      }
      return { status: 200, ok: true, status2: 'gematcht', activiteit: gekozen, dateId: d.id };
    }
    save();
    return { status: 200, ok: true, status2: 'gekozen' };
  }

  // De kern van de regel: gelijk = dat; anders naar de vrouw; anders de rustigste.
  function beslisActiviteit(kA, kB, gA, gB) {
    if (kA === kB) return kA;
    const vrouwA = gA === 'v', vrouwB = gB === 'v';
    if (vrouwA && !vrouwB) return kA;
    if (vrouwB && !vrouwA) return kB;
    const rang = x => (ACTIVITEITEN.find(a => a.id === x) || { rust: 99 }).rust;
    return rang(kA) <= rang(kB) ? kA : kB;
  }
  const actLabel = x => (ACTIVITEITEN.find(a => a.id === x) || {}).label || x;
  const actIcon = x => (ACTIVITEITEN.find(a => a.id === x) || {}).icon || '\u{1F31F}';

  /* ---- het veiligheidscontract ---- */
  function contractTekst(activiteit) {
    return [
      'RTG Salon-ontmoeting, veiligheidsafspraak',
      '',
      'Jullie spreken af om samen te ' + actLabel(activiteit).toLowerCase() + '. Door te tekenen ga je akkoord met:',
      '1. RTG-kantoor mag jullie live-locatie zien vanaf de start tot de afspraak is afgerond. Alleen het RTG-veiligheidsteam, niet de andere deelnemer of derden.',
      '2. Druk je op de SOS-knop, dan mag RTG-kantoor meteen meeluisteren en meekijken via de camera van je telefoon en direct de hulpdiensten (112) inschakelen.',
      '3. De locatie wordt niet langer bewaard dan nodig voor jullie veiligheid en wordt na de afspraak gewist, tenzij er een incident is gemeld.',
      '4. Elk van beiden kan de afspraak op elk moment beeindigen; daarmee stopt ook het meekijken.',
      '',
      'Deze afspraak geldt alleen tussen jullie tweeen en RTG. Tekenen kan alleen als je 18 jaar of ouder bent met een geverifieerd paspoort.'
    ].join('\n');
  }
  function maakDate(a, b, activiteit, voorstelId) {
    const d = {
      id: id(), a, b, activiteit, voorstelId,
      status: 'wacht-op-tekenen', at: nu(),
      contract: { tekst: contractTekst(activiteit), ondertekend: {} },
      posities: {}, sos: [], afgerondAt: null
    };
    db.data.ontmoetDates.unshift(d);
    db.data.ontmoetDates = db.data.ontmoetDates.slice(0, 4000);
    return d;
  }
  function dateVoor(key, dateId) {
    lijsten();   // borgt db.data.ontmoetDates ook als die collectie nog nooit is opgeslagen (Postgres-boot)
    const d = db.data.ontmoetDates.find(x => x.id === dateId);
    if (!d || (d.a !== key && d.b !== key)) return null;
    return d;
  }
  function teken(key, dateId) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (d.status !== 'wacht-op-tekenen') return { status: 409, error: 'Deze afspraak is al gestart of afgerond.' };
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    d.contract.ondertekend[key] = nu();
    const ander = d.a === key ? d.b : d.a;
    if (d.contract.ondertekend[d.a] && d.contract.ondertekend[d.b]) {
      d.status = 'actief'; d.gestartAt = nu();
      for (const k of [d.a, d.b]) { sseToCustomer(k, 'sync', { scope: 'ontmoeting' }); notify(k, { icon: '✅', title: 'Afspraak gestart', body: 'Het veiligheidscontract is getekend. RTG kijkt mee voor jullie veiligheid.', scope: 'ontmoeting' }); }
      sseToOffice('sync', { scope: 'ontmoeting' });
    } else {
      sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
      notify(ander, { icon: '✍️', title: 'Contract getekend', body: codenaamVan(key) + ' tekende het veiligheidscontract. Teken jij ook om te starten?', scope: 'ontmoeting' });
    }
    save();
    return { status: 200, ok: true, status2: d.status };
  }
  // live-positie tijdens een lopende afspraak (gaat naar RTG-kantoor)
  function dateHier(key, dateId, lat, lng) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['actief', 'noodgeval'].includes(d.status)) return { status: 409, error: 'Deze afspraak is niet actief.' };
    if (Number.isFinite(lat) && Number.isFinite(lng)) d.posities[key] = { lat, lng, at: nu() };
    save();
    sseToOffice('sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true };
  }
  function stop(key, dateId) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (['afgerond', 'geannuleerd'].includes(d.status)) return { status: 200, ok: true, status2: d.status };
    const gestart = d.status === 'actief' || d.status === 'noodgeval';
    d.status = gestart ? 'afgerond' : 'geannuleerd';
    d.afgerondAt = nu();
    if (!d.sos.some(x => !x.ok)) d.posities = {};   // locatie wissen tenzij er een open SOS is
    const ander = d.a === key ? d.b : d.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    sseToOffice('sync', { scope: 'ontmoeting' });
    notify(ander, { icon: '\u{1F3C1}', title: 'Afspraak beeindigd', body: codenaamVan(key) + ' heeft de afspraak afgerond.', scope: 'ontmoeting' });
    save();
    return { status: 200, ok: true, status2: d.status };
  }

  /* ---- SOS tijdens een afspraak ---- */
  function sos(key, dateId, bericht, lat, lng) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['actief', 'noodgeval'].includes(d.status)) return { status: 409, error: 'SOS kan alleen tijdens een lopende afspraak.' };
    const s = { id: id(), door: key, codenaam: codenaamVan(key), bericht: String(bericht || '').replace(/[<>]/g, '').slice(0, 200) || 'Noodsignaal', at: nu(), ok: null, camera: false };
    if (Number.isFinite(lat) && Number.isFinite(lng)) { s.lat = lat; s.lng = lng; d.posities[key] = { lat, lng, at: nu() }; }
    d.sos.unshift(s);
    d.status = 'noodgeval';
    save();
    // RTG-kantoor: rood alarm, mag meeluisteren/meekijken en 112 bellen (contract punt 2)
    sseToOffice('ontmoeting-sos', { dateId: d.id, sosId: s.id, codenaam: s.codenaam, bericht: s.bericht });
    sseToOffice('sync', { scope: 'ontmoeting' });
    // de andere deelnemer weet dat er een SOS loopt
    const ander = d.a === key ? d.b : d.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    notify(ander, { icon: '\u{1F6A8}', title: 'SOS', body: s.codenaam + ' heeft een noodsignaal gegeven. RTG-kantoor kijkt nu mee.', scope: 'ontmoeting' });
    sseToCustomer(key, 'sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true, sosId: s.id };
  }
  // RTG-kantoor handelt een SOS af
  function sosAf(dateId, sosId, door) {
    lijsten();
    const d = db.data.ontmoetDates.find(x => x.id === dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    const s = d.sos.find(x => x.id === sosId);
    if (!s) return { status: 404, error: 'SOS niet gevonden.' };
    s.ok = { door: String(door || 'RTG-kantoor').slice(0, 60), at: nu() };
    if (!d.sos.some(x => !x.ok) && d.status === 'noodgeval') d.status = 'actief';
    save();
    for (const k of [d.a, d.b]) sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
    sseToOffice('sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true };
  }
  // WebRTC-signaal doorgeven (lid <-> kantoor) voor het live meekijken bij een SOS
  function signaalNaarKantoor(key, dateId, payload) {
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    sseToOffice('ontmoeting-signaal', { dateId: d.id, van: key, codenaam: codenaamVan(key), payload });
    return { status: 200, ok: true };
  }
  function signaalNaarLid(dateId, naarKey, payload) {
    const d = dateVoor(naarKey, dateId);   // zelfde controle, met de lijsten()-borging (geen crash op een lege collectie)
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    sseToCustomer(naarKey, 'ontmoeting-signaal', { dateId, vanKantoor: true, payload });
    return { status: 200, ok: true };
  }

  /* ---- overzichten ---- */
  function opschonen() {
    lijsten();
    let veranderd = false;
    for (const v of db.data.ontmoetVoorstellen) if (v.status === 'open' && verlopenVoorstel(v)) { v.status = 'verlopen'; veranderd = true; }
    if (veranderd) save();
  }
  function publiekVoorstel(v, key) {
    const ander = v.a === key ? v.b : v.a;
    return { id: v.id, met: codenaamVan(ander), status: v.status, mijnKeuze: v.keuzes[key] || null, anderKoos: !!v.keuzes[ander], at: v.at, vervalt: v.vervalt, activiteit: v.activiteit || null, dateId: v.dateId || null };
  }
  function publiekeDate(d, key) {
    const ander = d.a === key ? d.b : d.a;
    return {
      id: d.id, met: codenaamVan(ander), activiteit: d.activiteit,
      activiteitLabel: actLabel(d.activiteit), icon: actIcon(d.activiteit), status: d.status,
      ikTekende: !!d.contract.ondertekend[key], anderTekende: !!d.contract.ondertekend[ander],
      contract: d.contract.tekst, at: d.at,
      sos: d.sos.filter(s => !s.ok).map(s => ({ id: s.id, door: s.codenaam, bericht: s.bericht, at: s.at, vanMij: s.door === key }))
    };
  }
  // alles wat een lid nu ziet: aan/uit, of het mag, en open voorstellen + lopende afspraken
  function mijnState(key) {
    lijsten(); opschonen();
    const m = mag(key);
    const voorstellen = db.data.ontmoetVoorstellen.filter(v => (v.a === key || v.b === key) && v.status === 'open').map(v => publiekVoorstel(v, key));
    const dates = db.data.ontmoetDates.filter(d => (d.a === key || d.b === key) && ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status)).map(d => publiekeDate(d, key));
    return { aan: staatAan(key), mag: m.ok, reden: m.ok ? null : m.reden, geslachtBekend: geslachtVan(key) != null, activiteiten: ACTIVITEITEN, voorstellen, dates };
  }
  // RTG-kantoor: alle lopende afspraken met live-locatie, plus de open SOS-en
  function kantoorState() {
    lijsten(); opschonen();
    const lopend = db.data.ontmoetDates.filter(d => ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status));
    const dates = lopend.map(d => ({
      id: d.id, activiteit: d.activiteit, activiteitLabel: actLabel(d.activiteit), icon: actIcon(d.activiteit),
      status: d.status, at: d.at, gestartAt: d.gestartAt || null,
      deelnemers: [d.a, d.b].map(k => ({ codenaam: codenaamVan(k), getekend: !!d.contract.ondertekend[k], pos: d.posities[k] || null })),
      sos: d.sos.filter(s => !s.ok).map(s => ({ id: s.id, door: s.codenaam, bericht: s.bericht, at: s.at, lat: s.lat, lng: s.lng }))
    }));
    const alarmen = dates.filter(d => d.sos.length).length;
    return { totaal: dates.length, alarmen, dates };
  }

  return {
    ONTMOET_ACTIVITEITEN: ACTIVITEITEN,
    ontmoetMag: mag, ontmoetZet: zet, ontmoetStaatAan: staatAan, ontmoetPos: pos,
    ontmoetKies: kies, ontmoetTeken: teken, ontmoetHier: dateHier, ontmoetStop: stop,
    ontmoetSos: sos, ontmoetSosAf: sosAf, ontmoetSignaalKantoor: signaalNaarKantoor,
    ontmoetSignaalLid: signaalNaarLid, ontmoetMijnState: mijnState, ontmoetKantoorState: kantoorState,
    ontmoetBeslisActiviteit: beslisActiviteit
  };
}

module.exports = { ONTMOET_RADIUS_M: RADIUS_M, ONTMOET_MIN_LEEFTIJD: MIN_LEEFTIJD, maakOntmoeting };
