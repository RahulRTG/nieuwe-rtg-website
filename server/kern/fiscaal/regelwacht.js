/* De Regelwacht: belastingen en regels worden AUTOMATISCH bijgewerkt in
   plaats van een keer per jaar met de hand. Het ontwerp:

   - De ingebouwde landtabellen (./landen.js, het peiljaar) blijven de
     veilige basis: zonder bron draait alles gewoon door.
   - Een UPDATE (uit de gekoppelde bron, of door het kantoor doorgevoerd)
     wordt streng gevalideerd -- alleen bekende velden, alleen zinnige
     waardes -- en dan IN PLACE op de gedeelde LANDEN-tabel gezet. Elke
     rekenplek in het systeem (btw, loonrun, zzp, minimumloon) gebruikt
     dezelfde tabel en rekent dus per direct met de nieuwe regels.
   - De overlay wordt bewaard (db.data.fiscaalRegels) en bij het opstarten
     opnieuw toegepast: een herstart verliest nooit een regel-update.
   - Met FISCAAL_BRON_URL gezet haalt de dagelijkse controle de nieuwste
     tabellen op (JSON: { versie, landen: { NL: { uurloonMin: ... } } });
     zonder bron meldt de status eerlijk dat het peiljaar de basis is. */
module.exports = ({ db, save, LANDEN, peiljaar, fetchImpl }) => {
  const haal = fetchImpl || ((...a) => fetch(...a));
  const GETALLEN = { lasten: [0, 0.6], vakantiegeld: [0, 0.25], uurloonMin: [1, 100], alcoholLeeftijd: [16, 25] };
  const TEKSTEN = ['aangifte', 'extra'];

  const staat = () => (db.data.fiscaalRegels = db.data.fiscaalRegels || { versie: null, bron: null, at: null, wijzigingen: {} });

  /* Valideer en pas een update toe; geeft per land terug wat er echt
     veranderde. Onbekende landen en velden worden genegeerd, gekke waardes
     geweigerd -- een slechte bron kan de tabellen nooit slopen. */
  function pasToe(update, bron, versie) {
    const gedaan = {};
    for (const [cc, velden] of Object.entries((update && update.landen) || update || {})) {
      if (!LANDEN[cc] || typeof velden !== 'object') continue;
      const wijz = {};
      for (const [veld, waarde] of Object.entries(velden)) {
        if (GETALLEN[veld]) {
          const n = Number(waarde);
          const [min, max] = GETALLEN[veld];
          if (Number.isFinite(n) && n >= min && n <= max && LANDEN[cc][veld] !== n) { LANDEN[cc][veld] = n; wijz[veld] = n; }
        } else if (veld === 'tarieven' && typeof waarde === 'object') {
          for (const [t, w] of Object.entries(waarde)) {
            const n = Number(w);
            if (LANDEN[cc].tarieven && t in LANDEN[cc].tarieven && Number.isFinite(n) && n >= 0 && n <= 30 && LANDEN[cc].tarieven[t] !== n) {
              LANDEN[cc].tarieven[t] = n; (wijz.tarieven = wijz.tarieven || {})[t] = n;
            }
          }
        } else if (TEKSTEN.includes(veld) && typeof waarde === 'string' && waarde.trim()) {
          const s = waarde.replace(/[<>]/g, '').slice(0, 400);
          if (LANDEN[cc][veld] !== s) { LANDEN[cc][veld] = s; wijz[veld] = s; }
        }
      }
      if (Object.keys(wijz).length) gedaan[cc] = wijz;
    }
    const st = staat();
    // de overlay stapelt: latere updates winnen per veld, zodat een herstart
    // altijd op de laatste stand uitkomt
    for (const [cc, wijz] of Object.entries(gedaan)) {
      st.wijzigingen[cc] = Object.assign(st.wijzigingen[cc] || {}, JSON.parse(JSON.stringify(wijz)));
      if (wijz.tarieven) st.wijzigingen[cc].tarieven = Object.assign((st.wijzigingen[cc] || {}).tarieven || {}, wijz.tarieven);
    }
    if (Object.keys(gedaan).length || versie) {
      st.versie = versie || st.versie;
      st.bron = bron || st.bron || 'kantoor';
      st.at = new Date().toISOString();
      save();
    }
    return { ok: true, gedaan, landen: Object.keys(gedaan).length };
  }

  /* Bij het opstarten: de bewaarde overlay opnieuw op de tabellen zetten. */
  function herstelOverlay() {
    const st = staat();
    if (Object.keys(st.wijzigingen || {}).length) pasToe({ landen: st.wijzigingen }, st.bron, st.versie);
  }

  /* De dagelijkse controle: met een bron halen we de nieuwste tabellen op;
     zonder bron is de status "peiljaar als basis". Nooit een crash: een
     onbereikbare of rare bron laat de huidige regels gewoon staan. */
  async function check() {
    const url = process.env.FISCAAL_BRON_URL || '';
    const st = staat();
    st.laatsteCheck = new Date().toISOString();
    if (!url) { st.checkUitslag = 'geen externe bron gekoppeld; ingebouwd peiljaar ' + peiljaar + ' plus doorgevoerde updates'; save(); return { ok: true, bron: null }; }
    try {
      const r = await haal(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) throw new Error('bron gaf ' + r.status);
      const data = await r.json();
      const uit = pasToe(data, url, data.versie);
      st.checkUitslag = 'bron opgehaald; ' + uit.landen + ' land(en) bijgewerkt';
      save();
      return { ok: true, bron: url, bijgewerkt: uit.landen };
    } catch (e) {
      st.checkUitslag = 'bron niet bereikbaar (' + String(e.message).slice(0, 80) + '); huidige regels blijven gelden';
      save();
      return { ok: false, fout: st.checkUitslag };
    }
  }

  function status() {
    const st = staat();
    return { peiljaar, versie: st.versie, bron: st.bron, laatsteUpdate: st.at,
      laatsteCheck: st.laatsteCheck || null, checkUitslag: st.checkUitslag || null,
      landenMetUpdates: Object.keys(st.wijzigingen || {}),
      totaal: Object.keys(LANDEN).length,
      landen: Object.entries(LANDEN).map(([cc, l]) => ({ code: cc, naam: l.naam, regio: l.regio || '', uurloonMin: l.uurloonMin,
        lasten: l.lasten, vakantiegeld: l.vakantiegeld, standaardBtw: l.tarieven && l.tarieven.standaard,
        bijgewerkt: !!(st.wijzigingen || {})[cc] })).sort((a, b) => a.naam.localeCompare(b.naam)) };
  }

  return { regelwacht: { pasToe, herstelOverlay, check, status } };
};
