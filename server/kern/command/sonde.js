/* DE SONDE -- nepgebruikers die de keten lopen terwijl er niemand kijkt.

   SLO.md noemt dit sinds de eerste versie als het eerste gat: "Alles hierboven
   wordt door de app zelf geteld. Ligt de app plat, dan telt er niets, en dan
   ziet de grafiek er prima uit." Dat is geen theoretisch bezwaar. Een meter die
   zwijgt tijdens een storing meldt achteraf een perfecte maand.

   HET VERSCHIL TUSSEN BINNEN EN BUITEN IS HIER HET HELE PUNT, en daarom draagt
   elk monster het. Draait de sonde in het serverproces zelf en klopt hij op
   127.0.0.1, dan bewijst een groen bolletje dat de HTTP-laag antwoordt -- niet
   dat een klant erbij kan. TLS, de reverse proxy, DNS en het netwerk zitten er
   niet in. Draait scripts/sonde.js vanaf een andere machine tegen het echte
   adres, dan zit dat er wel in, en die monsters heten 'buiten'. De twee worden
   nergens bij elkaar opgeteld, want dan zou het strengere cijfer verdwijnen in
   het makkelijke.

   DE REIZEN STAAN IN SLO.json en niet hier: een reis is gegevens (pad, methode,
   wat je terug hoort te krijgen, hoe lang het mag duren), geen code. Ze raken
   met opzet niets aan. De inlogreis logt BEWUST verkeerd in en verwacht een
   afwijzing -- de sonde toetst dat het pad antwoordt, niet dat hij binnenkomt.
   Een 200 daar zou een bevinding zijn en geen succes.

   DE MONSTERS BLIJVEN LIGGEN, en dat is waarom deze laag naast meting.js
   bestaat en niet erin: de tellers in meting.js beginnen bij elke herstart op
   nul, en juist een herstart is wat je wilt kunnen zien. */
'use strict';
const klok = require('../../lib/klok');   // sinds()/verstreken(): duur hoort op de monotone klok

const MAX_MONSTERS = 3000;
const STANDAARD_UREN = 24;

const binnenlands = (basis) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(String(basis));

function maakSonde({ db, save, vak, reizen }) {
  const V = typeof vak === 'function' ? vak : (() => db.data);

  function lijst() {
    const v = V();
    if (!Array.isArray(v.sondeMonsters)) v.sondeMonsters = [];
    return v.sondeMonsters;
  }

  const REIZEN = () => (typeof reizen === 'function' ? reizen() : (reizen || []));

  function bewaar(monsters) {
    const l = lijst();
    for (const m of monsters) l.push(m);
    if (l.length > MAX_MONSTERS) l.splice(0, l.length - MAX_MONSTERS);
    if (typeof save === 'function') save();
    return monsters;
  }

  /* Eén reis lopen. Elk foutgeval is hier een uitslag en geen uitzondering: een
     verbinding die weigert is precies wat gemeten moet worden, dus vangt hij en
     boekt hij dat als niet gelukt met de reden erbij. */
  async function loop(reis, basis) {
    const begin = klok.sinds();
    const opties = { method: reis.methode || 'GET', redirect: 'manual', headers: { 'x-rtg-sonde': '1' } };
    if (reis.body) {
      opties.headers['content-type'] = 'application/json';
      opties.body = JSON.stringify(reis.body);
    }
    let status = 0, reden = null;
    try {
      const controle = AbortSignal.timeout ? AbortSignal.timeout(Math.max(2000, (reis.maxMs || 2000) * 4)) : undefined;
      const r = await fetch(basis + reis.pad, controle ? Object.assign({ signal: controle }, opties) : opties);
      status = r.status;
      await r.arrayBuffer();
    } catch (e) {
      reden = String((e && e.message) || e).slice(0, 120);
    }
    const ms = Math.round(klok.verstreken(begin));
    const verwacht = Array.isArray(reis.verwacht) ? reis.verwacht : [200];
    const gelukt = verwacht.includes(status);
    return {
      at: new Date().toISOString(), reis: reis.id, status, ms, gelukt,
      traag: gelukt && ms > (reis.maxMs || 2000),
      reden: reden || (gelukt ? null : 'status ' + status + ' terwijl ' + verwacht.join('/') + ' werd verwacht')
    };
  }

  /* Een ronde: alle reizen achter elkaar, niet parallel. Vijf verzoeken tegelijk
     meten vooral elkaar. */
  async function draai(opties) {
    const o = opties || {};
    const basis = String(o.basis || ('http://127.0.0.1:' + (process.env.PORT || 3000))).replace(/\/+$/, '');
    const van = o.van || (binnenlands(basis) ? 'binnen' : 'buiten');
    const alle = REIZEN();
    const kies = o.reis ? alle.filter(r => r.id === o.reis) : alle;
    if (!kies.length) return { error: 'geen reis met die naam', status: 404 };

    const monsters = [];
    for (const reis of kies) monsters.push(Object.assign(await loop(reis, basis), { van }));
    bewaar(monsters);
    return {
      basis, van, monsters,
      gelukt: monsters.filter(m => m.gelukt).length, van_totaal: monsters.length,
      let: van === 'binnen'
        ? 'deze ronde liep vanaf de machine zelf: dit bewijst dat de HTTP-laag antwoordt, niet dat een klant erbij kan'
        : 'deze ronde liep van buitenaf, dus TLS, de proxy en het netwerk zitten erin'
    };
  }

  /* Meldingen van scripts/sonde.js, dat op een andere machine draait. Wordt
     gewantrouwd zoals alle invoer: alleen bekende reizen, en de kant staat
     vast op 'buiten' omdat een melder die zelf zijn kant mag kiezen het hele
     onderscheid waardeloos maakt. */
  function meld(rapport) {
    const rijen = Array.isArray(rapport && rapport.monsters) ? rapport.monsters : [];
    const bekend = new Set(REIZEN().map(r => r.id));
    const nu = new Date().toISOString();
    const schoon = [];
    for (const m of rijen.slice(0, 200)) {
      if (!m || !bekend.has(String(m.reis))) continue;
      schoon.push({
        at: typeof m.at === 'string' && m.at.length <= 30 ? m.at : nu,
        reis: String(m.reis), status: Number(m.status) || 0,
        ms: Math.max(0, Math.min(600000, Number(m.ms) || 0)),
        gelukt: !!m.gelukt, traag: !!m.traag,
        reden: m.reden ? String(m.reden).slice(0, 120) : null,
        van: 'buiten'
      });
    }
    if (!schoon.length) return { error: 'geen bruikbaar monster in deze melding', status: 400 };
    bewaar(schoon);
    return { aangenomen: schoon.length, geweigerd: rijen.length - schoon.length };
  }

  function tel(monsters) {
    const gelukt = monsters.filter(m => m.gelukt).length;
    const duren = monsters.map(m => m.ms).sort((a, b) => a - b);
    return {
      pogingen: monsters.length, gelukt, mislukt: monsters.length - gelukt,
      traag: monsters.filter(m => m.traag).length,
      deel: monsters.length ? Number((gelukt / monsters.length).toFixed(4)) : null,
      p50Ms: duren.length ? duren[Math.floor(duren.length * 0.5)] : null,
      p90Ms: duren.length ? duren[Math.min(duren.length - 1, Math.floor(duren.length * 0.9))] : null
    };
  }

  function stand(uren) {
    const u = Math.max(1, Math.min(Number(uren || STANDAARD_UREN), 24 * 30));
    const grens = Date.now() - u * 3600000;
    const alle = lijst().filter(m => Date.parse(m.at) >= grens);
    const perKant = {};
    for (const kant of ['binnen', 'buiten']) {
      const m = alle.filter(x => x.van === kant);
      perKant[kant] = Object.assign(tel(m), {
        reizen: REIZEN().map(r => Object.assign({ id: r.id, naam: r.naam, waarom: r.waarom },
          tel(m.filter(x => x.reis === r.id)))).filter(x => x.pogingen)
      });
    }
    const storingen = alle.filter(m => !m.gelukt).slice(-12).reverse();
    return {
      uren: u, monsters: alle.length, bewaard: lijst().length, max: MAX_MONSTERS,
      binnen: perKant.binnen, buiten: perKant.buiten, storingen,
      reizen: REIZEN().map(r => ({ id: r.id, naam: r.naam, pad: r.pad, methode: r.methode || 'GET',
        verwacht: r.verwacht, maxMs: r.maxMs, waarom: r.waarom })),
      let: perKant.buiten.pogingen
        ? null
        : 'er is in dit venster niets van buitenaf gemeten. Alles hieronder komt van de machine zelf, ' +
          'en dat kan per definitie niets zeggen over een storing waarbij de machine niet bereikbaar is.'
    };
  }

  /* Wat de SLO-meter hiervan wil weten: is er van buitenaf gemeten, en zo ja
     hoe vaak ging het mis. Kort, want daar hoort het niet uitgebreid te staan. */
  function buitenkort() {
    const grens = Date.now() - 30 * 86400000;
    const buiten = lijst().filter(m => m.van === 'buiten' && Date.parse(m.at) >= grens);
    if (!buiten.length) {
      return { gemeten: false, uitleg: 'er is niets van buitenaf gemeten; de cijfers hiernaast zijn ' +
        'alleen wat de app over zichzelf telt' };
    }
    const t = tel(buiten);
    return { gemeten: true, pogingen: t.pogingen, mislukt: t.mislukt, deel: t.deel,
      uitleg: 'van buitenaf gemeten over de laatste 30 dagen' };
  }

  return { draai, meld, stand, buitenkort, REIZEN, binnenlands };
}

module.exports = { maakSonde, MAX_MONSTERS, binnenlands };
