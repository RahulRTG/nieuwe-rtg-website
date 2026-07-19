/* De Zaakdoos: een klein kastje in de zaak (strandclub, boot, afgelegen
   locatie) waarop de eigen schermen (keuken, bar, bediening, kassa) via het
   lokale wifi-netwerk werken, ook als de satelliet- of internetlijn wegvalt.

   Hetzelfde server.js draait erop, in doosmodus (RTG_DOOS_CLOUD gezet):
   - ONLINE is de doos een doorgeefluik: alles onder /api/ en /media/ gaat
     een-op-een door naar de cloud (de cloud blijft de waarheid), en op de
     achtergrond haalt de doos regelmatig een verse kloon van de data op.
   - VALT DE LIJN WEG dan schakelt hij naar lokaal: dezelfde routes draaien
     op de laatste kloon, de zaak werkt gewoon door, en elke schrijfactie
     van de zaak komt in een journaal.
   - KOMT DE LIJN TERUG dan wordt het journaal in volgorde nagespeeld naar
     de cloud, daarna een verse kloon, en de doos is weer doorgeefluik.

   Bewust klein gehouden: alleen /api/supplier/-schrijfacties komen in het
   journaal (de zaakkant). Dit is de orkestrator: hij houdt de gedeelde staat
   (st) en de config vast, wekt de deelbestanden (kas, proxy, netwerk) met een
   gedeelde ctx, en draait de pinger (tik) die de lijn bewaakt en vanzelf
   herstelt. De doorgeefluik/kloon/naspelen woont in ./proxy, de randcache in
   ./kas, het meetstation/nachtwerk in ./netwerk en het beheer op afstand in
   ./beheer. */

const fs = require('fs');
const path = require('path');

module.exports = ({ db, save, log, dataDir }) => {
  // De doos praat met een of meer cloud-adressen (komma-lijst). Zijn het er
  // meer, dan zijn het replica's (trio/nood): valt de eerste weg, dan pakt de
  // doos de volgende voordat hij naar lokaal schakelt, en bij herstel keert hij
  // vanzelf terug naar de primaire (hij kiest elke tik van boven af).
  const CLOUDS = String(process.env.RTG_DOOS_CLOUD || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const CLOUD = () => CLOUDS[st.cloudIdx] || '';
  const SLEUTEL = process.env.RTG_DOOS_SLEUTEL || '';
  const GEBRUIKER = process.env.RTG_DOOS_USER || '';
  const WACHTWOORD = process.env.RTG_DOOS_WACHTWOORD || '';
  const actief = CLOUDS.length > 0;
  // 9+-hardening: een korte gedeelde sleutel is te raden; waarschuw hard
  if (SLEUTEL && SLEUTEL.length < 16) {
    console.warn('[doos] RTG_DOOS_SLEUTEL is korter dan 16 tekens; kies een lange willekeurige sleutel (bijv. openssl rand -hex 24).');
  }
  const nu = () => Date.now();

  // de gedeelde, muteerbare staat (alle deelbestanden lezen/schrijven hierin)
  const st = {
    cloudIdx: 0,
    modus: actief ? 'cloud' : 'uit', // 'cloud' (doorgeefluik) | 'lokaal' | 'uit'
    laatsteKloon: 0,
    bezig: false,
    cloudTokenCache: null,
    lokaalSinds: 0,
    laatsteMelding: 0,
    laatsteBuurMelding: 0,
    laatsteNachtDag: ''
  };
  /* Het nachtwerk houdt per dag de lijnkwaliteit bij: pings, rondreistijden,
     hoe vaak en hoe lang de lijn wegviel, en hoeveel journaalregels er zijn
     nagespeeld. Om vier uur in de nacht gaat het dagrapport naar de cloud. */
  const teller = { pings: 0, rttSom: 0, uitval: 0, lokaalMs: 0, nagespeeld: 0, sinds: Date.now() };

  function journaal() {
    if (!Array.isArray(db.data.doosJournaal)) db.data.doosJournaal = [];
    return db.data.doosJournaal;
  }
  function naarLokaal(reden) {
    if (st.modus !== 'lokaal') {
      st.modus = 'lokaal';
      teller.uitval++;
      st.lokaalSinds = nu();
      log && log.warn ? log.warn('[doos] lijn weg (' + reden + '); lokale zaakmodus aan') : console.warn('[doos] lokale zaakmodus aan:', reden);
    }
  }

  const HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'te', 'trailer', 'host', 'content-length'];
  const KAS_DIR = path.join(dataDir || '.', 'dooskas');
  const KAS_MAX_BESTAND = 4 * 1024 * 1024;
  const KAS_MAX_STUKS = 400;

  const NETWERK = process.env.RTG_DOOS_NETWERK === '1';
  const DOOS_NAAM = process.env.RTG_DOOS_NAAM || 'doos';
  const MELD_MS = Math.max(1000, Number(process.env.RTG_DOOS_MELD_MS) || 60000);
  // het beheer op afstand: software-update, netwerkrol en stroomwacht
  const beheer = require('./beheer')({ dataDir, cloud: CLOUD, sleutel: SLEUTEL, doosNaam: DOOS_NAAM });
  // de plek van de doos op de wereldkaart (met instemming van de partner)
  const PLEK = (() => {
    const m = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(process.env.RTG_DOOS_PLEK || '');
    return m ? { lat: Number(m[1]), lon: Number(m[2]) } : null;
  })();
  const BUREN = String(process.env.RTG_DOOS_BUREN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, log, fs, path, nu, st, teller, journaal, naarLokaal, beheer,
    CLOUDS, CLOUD, SLEUTEL, GEBRUIKER, WACHTWOORD, actief, HOP,
    KAS_DIR, KAS_MAX_BESTAND, KAS_MAX_STUKS,
    NETWERK, DOOS_NAAM, MELD_MS, PLEK, BUREN
  };
  // proxy levert het doorgeefluik, de kloon, het naspelen én de randcache
  const proxy = require('./proxy')(ctx);
  ctx.haalKloon = proxy.haalKloon; ctx.speelNa = proxy.speelNa; ctx.kasStats = proxy.kasStats;
  const netwerk = require('./netwerk')(ctx);

  function status() {
    const kasx = proxy.kasStats();
    return {
      doos: actief, modus: st.modus, journaal: actief ? journaal().length : 0, laatsteKloon: st.laatsteKloon,
      kloonLeeftijdMin: st.laatsteKloon ? Math.round((nu() - st.laatsteKloon) / 60000) : null,
      kasStuks: kasx.stuks, kasBytes: kasx.bytes,
      clouds: CLOUDS.length, actieveCloud: st.cloudIdx,
      versie: beheer.versie, wifi: beheer.wifiRol(), stroom: beheer.stroom()
    };
  }

  // Kies de eerste bereikbare cloud, van de primaire af. Zo springt de doos naar
  // een replica als de primaire wegvalt (zonder onnodig naar lokaal te gaan) en
  // keert hij vanzelf terug naar de primaire zodra die er weer is.
  async function kiesCloud() {
    for (let i = 0; i < CLOUDS.length; i++) {
      const start = nu();
      try {
        const r = await fetch(CLOUDS[i] + '/api/sat/ping', { signal: AbortSignal.timeout(8000) });
        if (r.ok) return { idx: i, rtt: nu() - start };
      } catch (e) { /* deze cloud niet bereikbaar; de volgende proberen */ }
    }
    return null;
  }
  async function tik() {
    if (!actief || st.bezig) return;
    st.bezig = true;
    try {
      const keus = await kiesCloud();
      if (!keus) throw new Error('geen enkele cloud bereikbaar');
      st.cloudIdx = keus.idx;
      teller.pings++;
      teller.rttSom += keus.rtt;
      netwerk.meldMeting(keus.rtt);
      if (st.modus === 'lokaal') {
        // de lijn is terug: eerst het journaal netjes naspelen, dan verse kloon
        if (await proxy.speelNa()) {
          st.modus = 'cloud';
          if (st.lokaalSinds) { teller.lokaalMs += nu() - st.lokaalSinds; st.lokaalSinds = 0; }
          console.log('[doos] lijn terug; journaal nagespeeld, doorgeefluik weer aan');
          await proxy.haalKloon();
        }
      } else if (Date.now() - st.laatsteKloon > 60000) {
        await proxy.haalKloon();
      }
      // om vier uur in de nacht: huishouding en het dagrapport
      const dag = new Date().toISOString().slice(0, 10);
      if (new Date().getHours() === 4 && dag !== st.laatsteNachtDag) { st.laatsteNachtDag = dag; netwerk.nachtwerk(); }
    } catch (e) { naarLokaal('ping: ' + (e && e.message)); netwerk.meldViaBuur(); }
    st.bezig = false;
  }
  if (actief) {
    setInterval(tik, 10000).unref();
    setTimeout(tik, 1500).unref();
  }

  return { doos: {
    actief, magProxy: proxy.magProxy, proxy: proxy.proxy, status, schrijfJournaal: proxy.schrijfJournaal,
    modusVan: () => st.modus, tik, speelNa: proxy.speelNa, haalKloon: proxy.haalKloon,
    kasLees: proxy.kasLees, buurDoorgeven: netwerk.buurDoorgeven, dagrapport: netwerk.dagrapport
  } };
};
