/* Kern-module "wbw": Wie betaalt wat. Het gedeelde lijstje van een groep
   vrienden: wie betaalde wat, voor wie, en wie staat er hoe voor. Geen
   spelletje en geen gezeur: een lijst, een balans, en verrekenen in een tik
   via RTG Pay.

   Spelregels:
   - Een groep bestaat uit Salon-vrienden van de oprichter (echte connecties);
     alleen leden zien de lijst. Alles op codenaam.
   - Elke uitgave wordt sluitend verdeeld in centen (de resterende centen
     liggen bij de eersten in het rijtje, zodat de som altijd klopt).
   - Geld beweegt ALLEEN door een tik van de eigenaar zelf: wie rood staat
     betaalt het eigen deel met een knop (pay.stuur, zo min mogelijk
     overboekingen), wie tegoed heeft kan de anderen een Klompje
     (betaalverzoek) sturen. Niemand kan bij andermans wallet.

   maakWbw(state) volgt het vaste kern-patroon. */

const GROEPEN_MAX = 50;          // groepen per lid
const LEDEN_MAX = 12;
const REGELS_MAX = 500;          // uitgaven + verrekeningen per groep
const UITGAVE_MAX_CENTEN = 2500000;

function maakWbw({ db, save, crypto, schoon, codenaamVan, connectieTussen, verbActief, pay, notify }) {
  const id = () => 'wb' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!Array.isArray(db.data.wbwGroepen)) db.data.wbwGroepen = [];
    return db.data.wbwGroepen;
  }
  const groepMet = gid => lijsten().find(g => g.id === gid) || null;
  const isLid = (g, key) => (g.leden || []).includes(key);

  /* ---- de groep ---- */
  function maak(key, data) {
    lijsten();
    if (db.data.wbwGroepen.filter(g => isLid(g, key)).length >= GROEPEN_MAX)
      return { status: 409, error: 'Tot ' + GROEPEN_MAX + ' lijstjes per lid.' };
    const naam = schoon(data.naam, 40); if (!naam) return { status: 400, error: 'Geef het lijstje een naam.' };
    const leden = [key];
    for (const ander of (Array.isArray(data.leden) ? data.leden.slice(0, LEDEN_MAX) : [])) {
      const k = String(ander);
      if (k === key || leden.includes(k)) continue;
      if (!verbActief(connectieTussen(key, k))) return { status: 403, error: 'Alleen Salon-vrienden kunnen in het lijstje.' };
      leden.push(k);
    }
    if (leden.length < 2) return { status: 400, error: 'Een lijstje begint met minstens een vriend erbij.' };
    const g = { id: id(), naam, leden, regels: [], door: key, at: nu() };
    db.data.wbwGroepen.push(g); save();
    for (const k of leden) if (k !== key)
      notify(k, { title: 'Wie betaalt wat', body: codenaamVan(key) + ' heeft u toegevoegd aan "' + naam + '".', scope: 'wbw' });
    return { status: 200, ok: true, groep: beeld(g, key) };
  }

  /* ---- uitgaven: sluitend verdeeld in centen ---- */
  function uitgave(key, gid, data) {
    const g = groepMet(gid); if (!g || !isLid(g, key)) return { status: 404, error: 'Lijstje niet gevonden.' };
    const centen = Math.round(Number(data.centen));
    if (!Number.isFinite(centen) || centen <= 0 || centen > UITGAVE_MAX_CENTEN)
      return { status: 400, error: 'Geef een bedrag tussen 1 cent en ' + (UITGAVE_MAX_CENTEN / 100) + ' euro.' };
    const oms = schoon(data.oms, 80) || 'Uitgave';
    let voor = Array.isArray(data.voor) && data.voor.length ? data.voor.map(String).filter(k => isLid(g, k)) : g.leden.slice();
    voor = [...new Set(voor)];
    if (!voor.length) return { status: 400, error: 'Voor wie was dit?' };
    const regel = { id: id(), soort: 'uitgave', door: key, oms, centen, voor, at: nu() };
    g.regels.push(regel); if (g.regels.length > REGELS_MAX) g.regels = g.regels.slice(-REGELS_MAX);
    save();
    for (const k of g.leden) if (k !== key)
      notify(k, { title: g.naam, body: codenaamVan(key) + ' betaalde ' + (centen / 100).toFixed(2).replace('.', ',') + ': ' + oms, scope: 'wbw' });
    return { status: 200, ok: true, regel: regelBeeld(regel) };
  }

  /* ---- de balans: betaald minus eigen deel, plus verrekeningen ---- */
  function balansVan(g) {
    const saldo = {};
    for (const k of g.leden) saldo[k] = 0;
    for (const r of g.regels) {
      if (r.soort === 'uitgave') {
        saldo[r.door] = (saldo[r.door] || 0) + r.centen;
        const n = r.voor.length, deel = Math.floor(r.centen / n), rest = r.centen - deel * n;
        r.voor.forEach((k, i) => { saldo[k] = (saldo[k] || 0) - deel - (i < rest ? 1 : 0); });
      } else if (r.soort === 'verrekening') {
        saldo[r.door] = (saldo[r.door] || 0) + r.centen;
        saldo[r.aan] = (saldo[r.aan] || 0) - r.centen;
      }
    }
    return saldo;
  }

  /* ---- verrekenen: de eigen schuld, met zo min mogelijk overboekingen ---- */
  async function verreken(key, gid, idem) {
    const g = groepMet(gid); if (!g || !isLid(g, key)) return { status: 404, error: 'Lijstje niet gevonden.' };
    const saldo = balansVan(g);
    let schuld = -(saldo[key] || 0);
    if (schuld <= 0) return { status: 409, error: 'U staat niet rood in dit lijstje.' };
    const tegoed = g.leden.filter(k => (saldo[k] || 0) > 0).sort((a, b) => saldo[b] - saldo[a]);
    const betalingen = [];
    for (const aan of tegoed) {
      if (schuld <= 0) break;
      const bedrag = Math.min(schuld, saldo[aan]);
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(aan), centen: bedrag,
        oms: 'Wie betaalt wat · ' + g.naam, idem: idem ? 'wbw:' + g.id + ':' + key + ':' + aan + ':' + idem : undefined, soort: 'wbw' });
      if (r.error) return { status: r.status || 400, error: r.error, betalingen };
      const regel = { id: id(), soort: 'verrekening', door: key, aan, centen: bedrag, at: nu() };
      g.regels.push(regel);
      betalingen.push({ aan: codenaamVan(aan), centen: bedrag });
      notify(aan, { title: g.naam, body: codenaamVan(key) + ' heeft ' + (bedrag / 100).toFixed(2).replace('.', ',') + ' verrekend.', scope: 'wbw' });
      schuld -= bedrag;
    }
    if (g.regels.length > REGELS_MAX) g.regels = g.regels.slice(-REGELS_MAX);
    save();
    return { status: 200, ok: true, betalingen, groep: beeld(g, key) };
  }

  /* ---- tegoed innen: nette Klompjes naar wie rood staat ---- */
  async function verzoek(key, gid) {
    const g = groepMet(gid); if (!g || !isLid(g, key)) return { status: 404, error: 'Lijstje niet gevonden.' };
    const saldo = balansVan(g);
    if ((saldo[key] || 0) <= 0) return { status: 409, error: 'U heeft niets tegoed in dit lijstje.' };
    const rood = g.leden.filter(k => (saldo[k] || 0) < 0);
    if (!rood.length) return { status: 409, error: 'Niemand staat rood.' };
    let tegoed = saldo[key], verzoeken = 0;
    for (const k of rood) {
      if (tegoed <= 0) break;
      const bedrag = Math.min(tegoed, -saldo[k]);
      const r = await pay.verzoekMaak({ van: codenaamVan(key), aan: [codenaamVan(k)], perCenten: bedrag,
        oms: 'Wie betaalt wat · ' + g.naam });
      if (!r.error) { verzoeken += 1; tegoed -= bedrag; }
    }
    return { status: 200, ok: true, verzoeken };
  }

  /* ---- de beelden ---- */
  const regelBeeld = r => r.soort === 'uitgave'
    ? { id: r.id, soort: r.soort, door: codenaamVan(r.door), oms: r.oms, centen: r.centen, voor: r.voor.length, at: r.at }
    : { id: r.id, soort: r.soort, door: codenaamVan(r.door), aan: codenaamVan(r.aan), centen: r.centen, at: r.at };
  function beeld(g, key) {
    const saldo = balansVan(g);
    return { id: g.id, naam: g.naam,
      leden: g.leden.map(k => ({ key: k, codenaam: codenaamVan(k), saldo: saldo[k] || 0, ik: k === key })),
      regels: g.regels.slice(-40).reverse().map(regelBeeld),
      mijnSaldo: saldo[key] || 0, at: g.at };
  }
  function mijn(key) {
    lijsten();
    const rijen = db.data.wbwGroepen.filter(g => isLid(g, key));
    return { status: 200, groepen: rijen.map(g => {
      const saldo = balansVan(g);
      return { id: g.id, naam: g.naam, leden: g.leden.length, mijnSaldo: saldo[key] || 0, at: g.at };
    }).sort((a, b) => String(b.at).localeCompare(String(a.at))) };
  }
  function groep(key, gid) {
    const g = groepMet(gid); if (!g || !isLid(g, key)) return { status: 404, error: 'Lijstje niet gevonden.' };
    return { status: 200, groep: beeld(g, key) };
  }

  return { wbwMaak: maak, wbwMijn: mijn, wbwGroep: groep, wbwUitgave: uitgave, wbwVerreken: verreken, wbwVerzoek: verzoek };
}

module.exports = { maakWbw };
