/* PROCESGEGEVENS, OP ELK PLATFORM: starttijd, ouder, zombie, kinderen, geheugen
   en rekentijd van een proces.

   Deze vragen werden op zes plekken rechtstreeks uit /proc gelezen
   (scripts/lib/afbouw-afloop.js, scripts/afbouw-slot.js, scripts/lib/belasting.js,
   scripts/tot-crash.js, scripts/beproeving.js, scripts/spreidingsproef.js), elk
   met een eigen -- of zonder -- terugval. Op macOS en de BSD's bestaat /proc niet:
   daar gaf de ene plek `null` ("geen meting"), de andere viel stil terug op het
   oude gedrag, en een toets sloeg zichzelf zonder melding over. Een antwoord dat
   per plek anders terugvalt is geen antwoord (LAT.md regel 4).

   Hier staat het een keer: eerst /proc (goedkoop, nauwkeurig), anders `ps` of
   `pgrep` (elke Unix kent ze), en pas als ook dat niets zegt `null` -- en `null`
   betekent dan "op dit platform niet vast te stellen", nooit "nee" of "nul".

   EEN STARTTIJD IS ALLEEN BINNEN EEN BRON VERGELIJKBAAR: /proc geeft klokticks
   sinds de boot, `ps lstart` epoch-milliseconden. Een aanroeper vergelijkt
   daarom alleen starttijden die op dezelfde machine en in hetzelfde proces van
   deze module kwamen; dat is precies hoe het afloopdossier en het slot ze
   gebruiken.

   `maak({ procWortel })` bestaat voor de toets: met een wortel die niet bestaat
   loopt elke vraag langs de terugval, zodat die ook op Linux beproefd wordt
   (test/procinfo.test.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function maak({ procWortel = '/proc' } = {}) {
  const CLK = (() => {
    try { return Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim()) || 100; }
    catch (e) { return 100; }
  })();
  const ps = (velden, pid) => execFileSync('ps', ['-o', velden + '=', '-p', String(pid)], {
    encoding: 'utf8', env: Object.assign({}, process.env, { LC_ALL: 'C' }), stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  /* De velden NA de procesnaam: die naam kan spaties en haakjes bevatten, dus
     er wordt geknipt vanaf de laatste ")". Index 0 is de stand (veld 3). */
  function stat(pid) {
    try {
      const s = fs.readFileSync(path.join(procWortel, String(pid), 'stat'), 'utf8');
      return s.slice(s.lastIndexOf(')') + 2).split(' ');
    } catch (e) { return null; }
  }
  const heeftProc = () => { try { return fs.existsSync(path.join(procWortel, 'self', 'stat')); } catch (e) { return false; } };

  /* De starttijd (veld 22, of `ps lstart`), of null. */
  function procesStart(pid) {
    const s = stat(pid);
    if (s) return Number(s[19]) || null;
    try { const t = Date.parse(ps('lstart', pid)); return Number.isFinite(t) ? t : null; } catch (e) { return null; }
  }
  /* De ouder (veld 4, of `ps ppid`), of 0 als hij niet te lezen is. */
  function ouderVan(pid) {
    const s = stat(pid);
    if (s) return Number(s[1]) || 0;
    try { return Number(ps('ppid', pid)) || 0; } catch (e) { return 0; }
  }
  /* Is dit een zombie (defunct)? null als het platform het niet zegt. */
  function isZombie(pid) {
    const s = stat(pid);
    if (s) return s[0] === 'Z';
    try { return /^Z/.test(ps('stat', pid)); } catch (e) { return null; }
  }
  /* De directe kinderen van een proces. `viaProc` zegt welke bron sprak: een
     kind dat tussen lijst en starttijd verdwijnt, betekent onder /proc dat het
     weg is. */
  function kinderen(pid) {
    try {
      const t = fs.readFileSync(path.join(procWortel, String(pid), 'task', String(pid), 'children'), 'utf8');
      return { viaProc: true, pids: t.trim().split(/\s+/).filter(Boolean).map(Number) };
    } catch (e) {
      try {
        const t = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return { viaProc: false, pids: t.trim().split(/\s+/).filter(Boolean).map(Number) };
      } catch (geen) { return { viaProc: false, pids: [] }; }   // pgrep zonder treffer geeft exitcode 1
    }
  }
  /* Het werkgeheugen (RSS) in kilobytes, of null. */
  function rssKB(pid) {
    try {
      const m = fs.readFileSync(path.join(procWortel, String(pid), 'status'), 'utf8').match(/VmRSS:\s+(\d+) kB/);
      if (m) return Number(m[1]);
    } catch (e) { /* geen /proc: hieronder verder */ }
    try { const kb = Number(ps('rss', pid).split(/\s+/)[0]); return Number.isFinite(kb) && kb > 0 ? kb : null; }
    catch (e) { return null; }
  }
  /* De verbruikte rekentijd (gebruiker + systeem) in seconden, of null. Uit
     /proc op klokticks nauwkeurig, uit `ps time` soms alleen op hele seconden. */
  function cpuSeconden(pid) {
    const s = stat(pid);
    if (s) return (Number(s[11]) + Number(s[12])) / CLK;
    try {
      const d = ps('time', pid).split('-');
      const stukken = d[d.length - 1].split(':').map(Number);
      let sec = stukken.pop() || 0;
      if (stukken.length) sec += (stukken.pop() || 0) * 60;
      if (stukken.length) sec += (stukken.pop() || 0) * 3600;
      if (d.length > 1) sec += Number(d[0]) * 86400;
      return Number.isFinite(sec) ? sec : null;
    } catch (e) { return null; }
  }
  return { heeftProc, procesStart, ouderVan, isZombie, kinderen, rssKB, cpuSeconden, CLK };
}

module.exports = Object.assign(maak(), { maak });
