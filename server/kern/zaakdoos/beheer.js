/* Zaakdoos (deelmodule): het beheer op afstand. Het principe blijft dat de
   doos altijd ZELF naar buiten belt; de cloud hoeft het kastje nooit te
   kunnen bereiken. Drie lagen:

   - Software-update: het kantoor zet een doelversie. Meldt de doos bij het
     meetstation een oudere versie, dan krijgt hij de update-opdracht mee en
     draait hij zijn update-hook (RTG_DOOS_UPDATE_CMD; op echte hardware
     bijv. "git pull && npm ci && systemctl restart rtg-doos"). De uitslag
     gaat als statusmelding terug naar de cloud.
   - Netwerkrol: de doos is behalve zaakserver ook accesspoint of
     wifi-versterker, met los gastwifi. Het kantoor zet rol en SSID's op
     afstand; de doos schrijft dooswifi.json en draait de wifi-hook
     (RTG_DOOS_WIFI_CMD; op hardware past die hostapd/wpa_supplicant aan).
   - Stroomwacht: een UPS-daemon schrijft "net" of "batterij <pct>" naar
     RTG_DOOS_STROOM_BESTAND; de doos meldt dat mee en het wereldbord
     kleurt oranje zodra een zaak op batterij draait. */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = ({ dataDir, cloud, sleutel, doosNaam }) => {
  const VERSIE = process.env.RTG_DOOS_VERSIE || (() => {
    try { return require('../../../package.json').version || '0.0.0'; } catch (e) { return '0.0.0'; }
  })();

  /* ---------- de netwerkrol ---------- */
  const WIFI_BESTAND = path.join(dataDir || '.', 'dooswifi.json');
  let wifiCache = null;
  function wifiStand() {
    if (wifiCache) return wifiCache;
    try { wifiCache = JSON.parse(fs.readFileSync(WIFI_BESTAND, 'utf8')); } catch (e) { wifiCache = { rol: 'uit' }; }
    return wifiCache;
  }
  /* De instellingen komen met de eigen melding mee terug uit de cloud; alleen
     een NIEUWERE stand (at) wordt toegepast, zodat een herhaalde melding niet
     telkens de hook draait. */
  function pasNetwerkToe(cfg) {
    if (!cfg || typeof cfg !== 'object') return false;
    const oud = wifiStand();
    if (oud.at && cfg.at && cfg.at <= oud.at) return false;
    const schoon = {
      rol: ['accesspoint', 'versterker', 'uit'].includes(cfg.rol) ? cfg.rol : 'uit',
      ssid: String(cfg.ssid || '').slice(0, 32),
      gastwifi: cfg.gastwifi === true,
      gastSsid: String(cfg.gastSsid || '').slice(0, 32),
      kanaal: Math.max(1, Math.min(13, Math.round(Number(cfg.kanaal) || 6))),
      at: cfg.at || Date.now()
    };
    try { fs.mkdirSync(path.dirname(WIFI_BESTAND), { recursive: true }); fs.writeFileSync(WIFI_BESTAND, JSON.stringify(schoon)); } catch (e) { return false; }
    wifiCache = schoon;
    const cmd = process.env.RTG_DOOS_WIFI_CMD || '';
    if (cmd) exec(cmd, { timeout: 120000, env: { ...process.env, DOOS_WIFI_ROL: schoon.rol, DOOS_WIFI_SSID: schoon.ssid, DOOS_WIFI_GAST: schoon.gastwifi ? schoon.gastSsid : '', DOOS_WIFI_KANAAL: String(schoon.kanaal) } },
      err => { if (err) console.warn('[doos] wifi-hook faalde:', err.message); else console.log('[doos] netwerkrol toegepast: ' + schoon.rol); });
    else console.log('[doos] netwerkrol bewaard (' + schoon.rol + '); geen wifi-hook (RTG_DOOS_WIFI_CMD) op dit kastje');
    return true;
  }
  function wifiRol() { return wifiStand().rol || 'uit'; }

  /* ---------- de stroomwacht ---------- */
  let stroomCache = { at: 0, waarde: null };
  function stroom() {
    const bestand = process.env.RTG_DOOS_STROOM_BESTAND || '';
    if (!bestand) return null;
    if (Date.now() - stroomCache.at < 30000) return stroomCache.waarde;
    stroomCache.at = Date.now();
    try {
      const m = /^(net|batterij)(?:\s+(\d{1,3}))?/.exec(fs.readFileSync(bestand, 'utf8').trim());
      stroomCache.waarde = m ? { bron: m[1], pct: m[2] == null ? null : Math.min(100, Number(m[2])) } : null;
    } catch (e) { stroomCache.waarde = null; }
    return stroomCache.waarde;
  }

  /* ---------- de update zelf ---------- */
  async function meldUpdateStatus(naar, gelukt, melding) {
    try {
      await fetch(cloud() + '/api/doos/update/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': sleutel },
        body: JSON.stringify({ doos: doosNaam, van: VERSIE, naar: naar || null, gelukt, melding }),
        signal: AbortSignal.timeout(10000)
      });
    } catch (e) { /* geen lijn; de uitslag blijkt uit de volgende versie-melding */ }
  }
  async function doeUpdate() {
    let doel = null;
    try {
      const r = await fetch(cloud() + '/api/doos/update', { headers: { 'x-doos-sleutel': sleutel }, signal: AbortSignal.timeout(15000) });
      if (r.ok) doel = await r.json();
    } catch (e) { /* geen lijn */ }
    if (!doel || !doel.versie) return meldUpdateStatus(null, false, 'geen doelversie bij de cloud gevonden');
    if (doel.versie === VERSIE) return meldUpdateStatus(doel.versie, true, 'al op de doelversie');
    const cmd = process.env.RTG_DOOS_UPDATE_CMD || '';
    if (!cmd) return meldUpdateStatus(doel.versie, false, 'geen update-hook (RTG_DOOS_UPDATE_CMD) op dit kastje');
    console.log('[doos] update-opdracht: van ' + VERSIE + ' naar ' + doel.versie + '; hook draait');
    return new Promise(klaar => {
      exec(cmd, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
        meldUpdateStatus(doel.versie, !err, err ? String(stderr || err.message).slice(0, 300) : 'update-hook gedraaid; de herstart meldt de nieuwe versie')
          .then(() => klaar(!err));
      });
    });
  }

  return { versie: VERSIE, wifiRol, pasNetwerkToe, stroom, doeUpdate };
};
