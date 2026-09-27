/* Magnaat na 1.0: SAMEN IN EEN OUDWIJK (MAGNAAT.md, "Na 1.0: samen spelen").

   Twee tot vier spelers delen een stad. Ieder heeft zijn EIGEN leven en zijn
   eigen grootboek -- er gaat geen geld tussen spelers, dus het grootboek blijft
   precies wat het was. Wat ze delen is de markt: de andere spelers nemen de
   plekken van verzonnen concurrenten in (./bereik.js).

   Drie regels die de vorm van dit bestand bepalen:
     - DE DAG GAAT DOOR ALS IEDEREEN KLAAR IS. Geen klok die voor de een
       doorloopt terwijl de ander slaapt: wie zijn dag afsluit, wacht op de
       rest, en de laatste die klaar is, zet de stad een dag verder.
     - ALLEEN JE EIGEN KRING. Je komt binnen met een code die iemand je geeft,
       en alleen zolang de stad nog niet begonnen is. Een speler heet zijn
       codenaam; een sessiesleutel verlaat deze module nooit.
     - GEEN RANGLIJST. Aan het eind staan de verhalen naast elkaar, in de
       volgorde waarin mensen binnenkwamen, en niet op winst. Een stad is een
       potje: na afloop verdwijnt hij, met de levens erin. */
'use strict';
const R = require('./regels');
const { zetKring } = require('./bereik');
const { reputatie, kwaliteit } = require('./markt');

const MAX = 4, MIN = 2, DUUR = 112, BEWAAR_MS = 28 * 86400000;
const NIET_IN_STAD = ['opnieuw', 'start', 'moeilijkheid', 'tempo', 'doorspoelen'];
const fout = (error, status = 400) => ({ status, error });

function maakStad({ eigen, leven, crypto, codenaamVan = () => null, sseToCustomer = null, nu = () => Date.now() }) {
  const steden = () => eigen.bak('magnaatSteden');
  const levenKey = (s, lid) => 'stad:' + s.code + ':' + lid.plek;
  const naamVan = (key) => { try { return String(codenaamVan(key) || '').slice(0, 60) || 'Speler'; } catch (e) { return 'Speler'; } };
  const actief = (s) => s.leden.filter(l => !l.weg && !leven.intern.haal(levenKey(s, l)).voorbij);

  function mijnStad(key) {
    const lijst = Object.values(steden()).filter(s => s.leden.some(l => l.key === key && !l.weg));
    return lijst.find(s => s.status !== 'klaar') || lijst.sort((a, b) => b.gemaakt - a.gemaakt)[0] || null;
  }
  function code() {
    let c;
    do { c = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 6).toUpperCase(); }
    while (c.length < 6 || steden()[c]);
    return c;
  }
  function opruimen() {
    const alle = steden(), levens = eigen.bak('magnaatLeven');
    for (const s of Object.values(alle)) {
      if (s.status !== 'klaar' || nu() - s.eindOp < BEWAAR_MS) continue;
      for (const l of s.leden) delete levens[levenKey(s, l)];
      delete alle[s.code];
    }
  }
  function sein(s) {
    if (typeof sseToCustomer !== 'function') return;
    for (const l of s.leden) {
      try { sseToCustomer(l.key, 'sync', { scope: 'magnaat-stad', code: s.code, dag: s.dag, revisie: s.revisie }); } catch (e) {}
    }
  }
  const wijzig = (s) => { s.revisie += 1; sein(s); };

  /* Wat de andere spelers van elkaar op de markt zien: naam, wijk, naam bij
     klanten, prijs als ze handelen, en of ze deze week te laat leverden. */
  function kringVan(s, ik) {
    return s.leden.filter(l => l !== ik && !l.weg).map(l => {
      const st = leven.intern.haal(levenKey(s, l));
      return { naam: st.onderneming ? st.onderneming.naam : l.naam, wijk: st.vestiging.wijk, kwaliteit: kwaliteit(st),
        prijsVast: st.handel ? st.handel.prijs : null, tarief: 100,
        laat: st.deals.some(d => d.laatGeleverd && d.geleverdOp > st.dag - 7), reputatie: reputatie(st) };
    });
  }
  const metKring = (s, lid) => { const st = leven.intern.haal(levenKey(s, lid)); zetKring(st, kringVan(s, lid)); return st; };

  function publiek(s, key) {
    const ik = s.leden.find(l => l.key === key);
    const nog = s.status === 'loopt' ? actief(s) : [];
    return {
      code: s.status === 'wacht' ? s.code : null, status: s.status, dag: s.dag, tot: s.eindDag, revisie: s.revisie,
      moeilijkheid: s.moeilijkheid, begin: s.begin, host: !!ik && s.leden[0] === ik, max: MAX, min: MIN,
      spelers: s.leden.map(l => ({ naam: l.naam, ik: l === ik, weg: !!l.weg,
        klaar: !!s.klaar[l.plek], meedoen: nog.includes(l) })),
      wachtOp: nog.filter(l => !s.klaar[l.plek]).length,
      verhalen: s.status === 'klaar' ? s.leden.map(l => {
        const st = leven.intern.haal(levenKey(s, l));
        return { naam: l.naam, bedrijf: st.onderneming ? st.onderneming.naam : null, mijlpalen: (st.mijlpalen || []).map(m => ({ dag: m.dag, tekst: m.tekst })),
          einde: st.voorbij ? 'voorbij op dag ' + st.voorbij.dag : st.zelfstandig ? 'leeft van zijn bedrijf sinds dag ' + st.zelfstandig : 'werkt nog in loondienst' };
      }) : null,
      grens: 'Geen ranglijst: de verhalen staan in de volgorde waarin spelers binnenkwamen. Een stad verdwijnt ' + (BEWAAR_MS / 86400000) + ' dagen na afloop.'
    };
  }
  const beeld = (s, key) => {
    const lid = s.leden.find(l => l.key === key);
    return { stad: publiek(s, key), leven: s.status === 'wacht' || !lid || lid.weg ? null : leven.intern.toon(levenKey(s, lid)) };
  };

  function maak(key, b) {
    opruimen();
    const lopend = mijnStad(key);
    if (lopend && lopend.status !== 'klaar') return fout('Je speelt al in een stad. Verlaat die eerst.', 409);
    const niveau = b.moeilijkheid || 'normaal', begin = b.begin || 'keuken';
    if (!R.MOEILIJKHEID[niveau]) return fout('Kies licht, normaal of zwaar.');
    if (!Object.prototype.hasOwnProperty.call(R.STARTPOSITIES, begin)) return fout('Kies waar iedereen begint: ' + Object.keys(R.STARTPOSITIES).join(', ') + '.');
    const s = { code: code(), status: 'wacht', moeilijkheid: niveau, begin, dag: 0, eindDag: null, klaar: {}, revisie: 1,
      gemaakt: nu(), eindOp: null, plekken: 1, leden: [{ key, naam: naamVan(key), plek: 0 }] };
    steden()[s.code] = s;
    return beeld(s, key);
  }

  function doe(key, b) {
    const s = steden()[String(b.code || '').trim().toUpperCase()];
    if (!s || s.status !== 'wacht') return fout('Die code klopt niet, of die stad is al begonnen.', 404);
    if (s.leden.some(l => l.key === key)) return beeld(s, key);
    const lopend = mijnStad(key);
    if (lopend && lopend.status !== 'klaar') return fout('Je speelt al in een stad. Verlaat die eerst.', 409);
    if (s.leden.length >= MAX) return fout('Deze stad is vol: hooguit ' + MAX + ' spelers.', 409);
    s.leden.push({ key, naam: naamVan(key), plek: s.plekken++ });
    wijzig(s);
    return beeld(s, key);
  }

  function start(key) {
    const s = mijnStad(key);
    if (!s || s.status !== 'wacht') return fout('Er is geen stad die op je wacht.', 404);
    if (s.leden[0].key !== key) return fout('Wie de stad maakte, zet hem in gang.', 403);
    if (s.leden.length < MIN) return fout('Samen spelen kan vanaf ' + MIN + ' spelers. Geef je code aan iemand.', 409);
    for (const l of s.leden) {
      const st = leven.intern.haal(levenKey(s, l), false, s.moeilijkheid, s.begin);
      st.stad = { code: s.code, plek: l.plek };
    }
    Object.assign(s, { status: 'loopt', dag: 1, eindDag: 1 + DUUR });
    wijzig(s);
    return beeld(s, key);
  }

  function verlaatStad(key) {
    const s = mijnStad(key), lid = s && s.leden.find(l => l.key === key);
    if (!lid || s.status === 'klaar') return fout('Je speelt niet in een stad.', 404);
    if (s.status === 'wacht') {
      if (s.leden[0] === lid) { delete steden()[s.code]; sein(s); return { ok: true, stad: null }; }
      s.leden.splice(s.leden.indexOf(lid), 1);
    } else {
      lid.weg = true;
      if (!actief(s).length) sluit(s); else volgendeAlsKlaar(s);
    }
    wijzig(s);
    return { ok: true, stad: null };
  }

  function sluit(s) { Object.assign(s, { status: 'klaar', eindOp: nu(), klaar: {} }); }

  /* De laatste die klaar is, zet de stad een dag verder -- iedereen tegelijk. */
  function volgendeAlsKlaar(s) {
    const nog = actief(s);
    if (nog.some(l => !s.klaar[l.plek])) return false;
    for (const l of nog) { metKring(s, l); leven.intern.dag(levenKey(s, l)); }
    s.dag += 1;
    s.klaar = {};
    if (s.dag >= s.eindDag || !actief(s).length) sluit(s);
    return true;
  }

  function staat(key) {
    const s = mijnStad(key);
    if (!s) return { stad: null, leven: null };
    const lid = s.leden.find(l => l.key === key);
    if (s.status === 'loopt' && lid && !lid.weg) metKring(s, lid);
    return beeld(s, key);
  }

  function actie(key, b) {
    const s = mijnStad(key), lid = s && s.leden.find(l => l.key === key);
    if (!lid || s.status !== 'loopt') return fout(s && s.status === 'klaar' ? 'Deze stad is afgelopen.' : 'Je speelt niet in een lopende stad.', 409);
    if (NIET_IN_STAD.includes(b.actie)) return fout('In een gedeelde stad beginnen, versnellen en overdoen kan niet: de dag gaat door als iedereen klaar is.');
    if (b.actie === 'slaap') {
      if (s.klaar[lid.plek]) return Object.assign(beeld(s, key), { herhaald: true });
      s.klaar[lid.plek] = true;
      volgendeAlsKlaar(s);
      wijzig(s);
      return beeld(s, key);
    }
    metKring(s, lid);
    const r = leven.intern.actie(levenKey(s, lid), b);
    if (r && r.error) return r;
    if (!actief(s).includes(lid) && volgendeAlsKlaar(s)) wijzig(s);
    return { stad: publiek(s, key), leven: r };
  }

  return { maak, doe, start, verlaat: verlaatStad, staat, actie };
}

module.exports = { maakStad, MAX, MIN, DUUR };
