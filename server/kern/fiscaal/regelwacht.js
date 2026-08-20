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
const { keur } = require('./regelwacht-keuring');

module.exports = ({ db, save, LANDEN, peiljaar, fetchImpl, nu, bronnen }) => {
  const haal = fetchImpl || ((...a) => fetch(...a));
  const { jaargangen } = require('./jaargangen').maakJaargangen({ db, save, LANDEN, peiljaar, nu });

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
      const wijz = keur(LANDEN[cc], velden);
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
  /* HET BRONNENREGISTER ERBIJ (./bronnen/). De oude weg -- EEN url in
     FISCAAL_BRON_URL die precies onze vorm spreekt -- blijft werken; daarnaast
     loopt de controle nu alle GEREGISTREERDE bronnen af, elk met zijn eigen
     adapter en zijn eigen gezag. Wat zo'n bron wel ziet veranderen maar niet
     zelf mag toewijzen, komt terug als SIGNAAL en niet als wijziging; zie de
     kop van ./bronnen/tedb.js voor waarom dat onderscheid er moet zijn. */
  async function checkBronnen(st) {
    if (!bronnen) return [];
    const uit = [];
    for (const b of bronnen.status()) {
      if (!b.geconfigureerd) continue;
      const r = await bronnen.haal(b.sleutel);
      if (!r.ok) { uit.push({ bron: b.sleutel, ok: false, uitslag: r.uitslag }); continue; }
      const toe = pasToe({ landen: r.landen }, { soort: 'bron', naam: r.naam, url: r.url, gezag: r.gezag }, r.versie);
      uit.push({ bron: b.sleutel, ok: true, gezag: r.gezag, bijgewerkt: toe.landen, signalen: r.signalen.length });
    }
    if (uit.length) st.bronnenUitslag = uit;
    return uit;
  }

  async function check() {
    const url = process.env.FISCAAL_BRON_URL || '';
    const st = staat();
    st.laatsteCheck = new Date().toISOString();
    const uitBronnen = await checkBronnen(st);
    if (!url) {
      st.checkUitslag = uitBronnen.length
        ? uitBronnen.map(b => b.bron + ': ' + (b.ok ? b.bijgewerkt + ' land(en), ' + b.signalen + ' signaal/signalen' : b.uitslag)).join(' · ')
        : 'geen externe bron gekoppeld; ingebouwd peiljaar ' + peiljaar + ' plus doorgevoerde updates';
      save();
      return { ok: true, bron: null, bronnen: uitBronnen };
    }
    try {
      const r = await haal(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) throw new Error('bron gaf ' + r.status);
      const data = await r.json();
      const uit = pasToe(data, { soort: 'bron', naam: url, url }, data.versie,
        { geldigVanaf: data.geldigVanaf, bekendgemaaktOp: data.bekendgemaaktOp });
      st.checkUitslag = 'bron opgehaald; ' + uit.landen + ' land(en) bijgewerkt';
      save();
      return { ok: true, bron: url, bijgewerkt: uit.landen, bronnen: uitBronnen };
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
      bronnen: bronnen ? bronnen.status() : [], signalen: bronnen ? bronnen.signalen() : [],
      wijzigingen: tl.wijzigingen, ongecontroleerd: tl.ongecontroleerd, wachtend: tl.wachtend,
      totaal: Object.keys(LANDEN).length,
      landen: Object.entries(LANDEN).map(([cc, l]) => ({ code: cc, naam: l.naam, regio: l.regio || '', uurloonMin: l.uurloonMin,
        lasten: l.lasten, vakantiegeld: l.vakantiegeld, standaardBtw: l.tarieven && l.tarieven.standaard,
        bijgewerkt: (bak[cc] || []).length > 0 })).sort((a, b) => a.naam.localeCompare(b.naam)) };
  }

  return { regelwacht: { pasToe, herstelOverlay, migreerOverlay, check, status, jaargangen } };
};
