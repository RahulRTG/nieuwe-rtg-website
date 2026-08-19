/* De Regelwacht: belastingen en regels worden AUTOMATISCH bijgewerkt in
   plaats van een keer per jaar met de hand. Het ontwerp:

   - De ingebouwde landtabellen (./landen.js, het peiljaar) blijven de
     veilige basis: zonder bron draait alles gewoon door.
   - Een UPDATE (uit de gekoppelde bron, of door het kantoor doorgevoerd)
     wordt hier streng gevalideerd -- alleen bekende velden, alleen zinnige
     waardes -- en daarna VASTGELEGD ALS JAARGANG (./jaargangen.js) en op de
     gedeelde LANDEN-tabel geprojecteerd. Elke rekenplek in het systeem (btw,
     loonrun, zzp, minimumloon) gebruikt dezelfde tabel en rekent dus per
     direct met de nieuwe regels.
   - Een herstart verliest nooit een regel-update: de jaargangen staan in de
     database en worden bij het opstarten opnieuw geprojecteerd.
   - Met FISCAAL_BRON_URL gezet haalt de dagelijkse controle de nieuwste
     tabellen op (JSON: { versie, landen: { NL: { uurloonMin: ... } } });
     zonder bron meldt de status eerlijk dat het peiljaar de basis is.

   DE TAAKVERDELING met ./jaargangen.js. Hier staat WAT EEN BRON MAG LEVEREN (de
   validatie hieronder); daar staat hoe een wijziging wordt bewaard en
   teruggevonden. Dat is niet altijd zo geweest: dit bestand hield zijn overlay
   bij als platte kaart van laatste waarden, en overschreef daarmee de oude --
   zie de kop daar voor wat dat onbeantwoordbaar maakte. */
module.exports = ({ db, save, LANDEN, peiljaar, fetchImpl, nu }) => {
  const haal = fetchImpl || ((...a) => fetch(...a));
  const { jaargangen } = require('./jaargangen').maakJaargangen({ db, save, LANDEN, peiljaar, nu });
  const GETALLEN = { lasten: [0, 0.6], vakantiegeld: [0, 0.25], uurloonMin: [1, 100], alcoholLeeftijd: [16, 25] };
  const TEKSTEN = ['aangifte', 'extra'];
  // de reisregels (kern/reis.js zet ze op LANDEN[cc].reis) zijn net zo
  // automatisch bij te werken als de belastingen: streng gevalideerd
  const REIS_ENUM = { visum: ['geen', 'vrij', 'toestemming', 'aankomst', 'evisum', 'visum'], rijden: ['links', 'rechts'] };
  const REIS_TEKST = { alarm: [2, 8], fooi: [1, 200], letOp: [0, 400] };

  const staat = () => (db.data.fiscaalRegels = db.data.fiscaalRegels || { versie: null, bron: null, at: null, wijzigingen: {} });

  /* Valideer een update en leg hem vast; geeft per land terug wat er echt
     veranderde. Onbekende landen en velden worden genegeerd, gekke waardes
     geweigerd -- een slechte bron kan de tabellen nooit slopen.

     De vergelijking loopt tegen de LOPENDE tabel: alleen een waarde die echt
     afwijkt van wat er nu geldt, is een wijziging. Een bron die elke dag
     dezelfde tabel levert, stapelt daardoor geen jaargangen. */
  function pasToe(update, bron, versie, opties) {
    const o = opties || {};
    const gedaan = {};
    for (const [cc, velden] of Object.entries((update && update.landen) || update || {})) {
      if (!LANDEN[cc] || typeof velden !== 'object') continue;
      const wijz = {};
      for (const [veld, waarde] of Object.entries(velden)) {
        if (GETALLEN[veld]) {
          const n = Number(waarde);
          const [min, max] = GETALLEN[veld];
          if (Number.isFinite(n) && n >= min && n <= max && LANDEN[cc][veld] !== n) wijz[veld] = n;
        } else if (veld === 'tarieven' && typeof waarde === 'object') {
          for (const [t, w] of Object.entries(waarde)) {
            const n = Number(w);
            if (LANDEN[cc].tarieven && t in LANDEN[cc].tarieven && Number.isFinite(n) && n >= 0 && n <= 30 && LANDEN[cc].tarieven[t] !== n) {
              (wijz.tarieven = wijz.tarieven || {})[t] = n;
            }
          }
        } else if (TEKSTEN.includes(veld) && typeof waarde === 'string' && waarde.trim()) {
          const s = waarde.replace(/[<>]/g, '').slice(0, 400);
          if (LANDEN[cc][veld] !== s) wijz[veld] = s;
        } else if (veld === 'reis' && typeof waarde === 'object' && LANDEN[cc].reis) {
          const rs = LANDEN[cc].reis;
          for (const [rv, rw] of Object.entries(waarde)) {
            if (REIS_ENUM[rv] && REIS_ENUM[rv].includes(rw) && rs[rv] !== rw) (wijz.reis = wijz.reis || {})[rv] = rw;
            else if (rv === 'dagen') { const n = Number(rw); if (Number.isFinite(n) && n >= 0 && n <= 365 && rs.dagen !== n) (wijz.reis = wijz.reis || {}).dagen = n; }
            else if (rv === 'water') { const b = rw === true; if (typeof rw === 'boolean' && rs.water !== b) (wijz.reis = wijz.reis || {}).water = b; }
            else if (REIS_TEKST[rv] && typeof rw === 'string') {
              const [min, max] = REIS_TEKST[rv];
              const s = rw.replace(/[<>]/g, '').trim().slice(0, max);
              if (s.length >= min && rs[rv] !== s) (wijz.reis = wijz.reis || {})[rv] = s;
            }
          }
          if (wijz.reis && !Object.keys(wijz.reis).length) delete wijz.reis;
        }
      }
      if (Object.keys(wijz).length) {
        /* VASTLEGGEN VOOR PROJECTEREN. De jaargang moet weten wat hij verving,
           en dat kan alleen zolang de oude waarde nog op de tabel staat. */
        const r = jaargangen.neemOp({ land: cc, wijzigingen: wijz, geldigVanaf: o.geldigVanaf,
          bron: typeof bron === 'string' ? { soort: bron } : bron, versie,
          rechtsgrond: o.rechtsgrond, bekendgemaaktOp: o.bekendgemaaktOp, door: o.door });
        if (r && r.ok) gedaan[cc] = wijz;
      }
    }
    /* De projectie zet de stand van vandaag op de gedeelde tabel. Een wijziging
       met een ingangsdatum in de toekomst ligt daarna klaar en doet nog niets. */
    if (Object.keys(gedaan).length) jaargangen.projecteer();
    const st = staat();
    if (Object.keys(gedaan).length || versie) {
      st.versie = versie || st.versie;
      st.bron = (typeof bron === 'string' ? bron : bron && bron.naam) || st.bron || 'kantoor';
      st.at = new Date().toISOString();
      save();
    }
    return { ok: true, gedaan, landen: Object.keys(gedaan).length };
  }

  /* DE OUDE PLATTE OVERLAY, EEN KEER. Wat er vóór de jaargangen is
     doorgevoerd, staat als kaart van laatste waarden in db.data.fiscaalRegels.
     Die wordt hier omgezet naar één jaargang per land.

     EERLIJK OVER WAT NIET TE REDDEN IS: wanneer elk veld veranderde, is nooit
     vastgelegd. De omzetting zet ze daarom allemaal op de laatst bekende
     updatedatum, met de herkomst 'overlay-migratie' erbij. Dat is geen
     geschiedenis maar een beginstand -- en zo staat het er ook bij, want een
     verzonnen ingangsdatum is erger dan een grove. */
  function migreerOverlay() {
    const st = staat();
    const oud = st.wijzigingen || {};
    if (!Object.keys(oud).length) return { gemigreerd: 0 };
    const vanaf = String(st.at || '').slice(0, 10) || (peiljaar + '-01-01');
    let n = 0;
    for (const [cc, wijz] of Object.entries(oud)) {
      if (!LANDEN[cc] || !wijz || !Object.keys(wijz).length) continue;
      const r = jaargangen.neemOp({ land: cc, wijzigingen: wijz, geldigVanaf: vanaf,
        bron: { soort: 'overlay-migratie', naam: st.bron || null }, versie: st.versie,
        rechtsgrond: 'Omgezet uit de platte overlay; de werkelijke ingangsdatum per veld is nooit vastgelegd.' });
      if (r && r.ok) n++;
    }
    st.wijzigingen = {};
    st.gemigreerdOp = new Date().toISOString();
    save();
    return { gemigreerd: n };
  }

  /* Bij het opstarten: de bewaarde jaargangen opnieuw op de tabellen zetten. */
  function herstelOverlay() {
    migreerOverlay();
    return jaargangen.projecteer();
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
      const uit = pasToe(data, { soort: 'bron', naam: url, url }, data.versie,
        { geldigVanaf: data.geldigVanaf, bekendgemaaktOp: data.bekendgemaaktOp });
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
    const tl = jaargangen.stand();
    const bak = db.data.fiscaalJaargangen || {};
    const metUpdates = Object.keys(bak).filter(cc => (bak[cc] || []).length);
    return { peiljaar, versie: st.versie, bron: st.bron, laatsteUpdate: st.at,
      laatsteCheck: st.laatsteCheck || null, checkUitslag: st.checkUitslag || null,
      landenMetUpdates: metUpdates,
      wijzigingen: tl.wijzigingen, ongecontroleerd: tl.ongecontroleerd, wachtend: tl.wachtend,
      totaal: Object.keys(LANDEN).length,
      landen: Object.entries(LANDEN).map(([cc, l]) => ({ code: cc, naam: l.naam, regio: l.regio || '', uurloonMin: l.uurloonMin,
        lasten: l.lasten, vakantiegeld: l.vakantiegeld, standaardBtw: l.tarieven && l.tarieven.standaard,
        bijgewerkt: (bak[cc] || []).length > 0 })).sort((a, b) => a.naam.localeCompare(b.naam)) };
  }

  return { regelwacht: { pasToe, herstelOverlay, migreerOverlay, check, status, jaargangen } };
};
