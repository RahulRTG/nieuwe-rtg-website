/* ============================================================================
   DE ETALAGE -- wat een lid van de App Store TE ZIEN krijgt.

   Apart van ./winkel.js omdat dat bestand met beide helften over de
   10 kB-keuringsgrens ging, en omdat de naad hier loopt waar hij hoort: dit
   bestand LEEST alleen. Bladeren, een kaart samenstellen en "mijn apps" tonen
   veranderen niets; verlenen, installeren en openen wel, en die staan hiernaast.

   Twee dingen die hier met opzet NIET staan.

   Er is geen beoordeling, geen sterrensysteem en geen ranglijst. CLAUDE.md
   verbiedt kunstmatige urgentie en ranglijsten buiten het potje; een winkel
   waarin apps elkaar verdringen is precies zo'n mechaniek. Wat er wel staat is
   wat een app doet, van wie hij is, wat hij vraagt, wat hij kost en wanneer hij
   is gekeurd.

   En er wordt hier niet gerekend. De prijs komt uit het manifest van de LIVE
   versie; wat een lid werkelijk betaalt (btw naar zijn land, de afdracht) rekent
   ./geld.js uit, en dat gebeurt op EEN plek zodat wat een lid ziet en wat hij
   betaalt niet uit elkaar kunnen lopen.
   ========================================================================== */
'use strict';

const { toonbaar } = require('./machtigingen');
const { bereik } = require('./bereik');

module.exports = function maakEtalage(kern) {
  const { S, app, versie, uitgever, eigen, geld } = kern;

  /* Wat een app kost, en of dit lid hem al heeft. Zonder betaallaag is elke app
     gratis, en dat zegt dit ook -- er wordt geen prijs verzonnen die niemand kan
     innen (zie ./naad.js). */
  const prijsVan = (v) => (geld ? Number(v.manifest.prijsCenten || 0) : 0);
  const heeftGekocht = (key, sleutel) => !!(geld && key && geld.gekocht(key, sleutel));

  /* Wat een nieuwe versie MEER vraagt dan dit lid heeft verleend: een machtiging
     die hij niet gaf, of dezelfde machtiging voor een ANDER doel. Dat tweede is
     precies waarom een doel een gesloten lijst is -- anders is er niets te
     vergelijken. */
  function diff(verleend, v) {
    const had = Array.isArray(verleend.machtigingen) ? verleend.machtigingen : [];
    const hadDoel = verleend.doelen || {};
    const wil = v.manifest.machtigingen || [];
    const wilDoel = v.manifest.doelen || {};
    const uit = [];
    for (const id of wil) {
      if (!had.includes(id)) { uit.push({ id, doel: wilDoel[id] || null, soort: 'nieuw' }); continue; }
      if (hadDoel[id] && wilDoel[id] && hadDoel[id] !== wilDoel[id]) {
        uit.push({ id, doel: wilDoel[id], eerderDoel: hadDoel[id], soort: 'ander-doel' });
      }
    }
    return toonbaar(uit.map(x => x.id), wilDoel).map((m, i) => Object.assign(m, { soort: uit[i].soort, eerderDoel: uit[i].eerderDoel || null }));
  }

  /* De verleningen van een lid. Ze worden hier GELEZEN en in ./winkel.js
     geschreven; dat die twee uit elkaar staan is de hele reden dat dit bestand
     bestaat. */
  function rijVan(key) {
    const v = S().verleend;
    const k = String(key || '');
    if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    return v[k];
  }
  const verleendeVan = (key, sleutel) => (key ? eigen(rijVan(key), sleutel) : null);

  const live = () => Object.values(S().apps).filter(a => a.live && versie(a.live) && versie(a.live).status === 'gepubliceerd');

  /* Wat een lid over een app te zien krijgt VOORDAT hij iets verleent. De
     uitgever staat er met naam bij: een app zonder aanspreekbare partij erachter
     hoort niet in een officiele store. */
  function kaart(a, key) {
    const v = versie(a.live);
    const u = uitgever(a.org);
    const verleend = verleendeVan(key, a.sleutel);
    return {
      sleutel: a.sleutel, naam: v.manifest.naam, uitleg: v.manifest.uitleg,
      categorie: v.manifest.categorie, taal: v.manifest.taal, versie: v.manifest.versie,
      uitgever: u ? { org: u.org, naam: u.naam } : null,
      vraagt: toonbaar(v.manifest.machtigingen, v.manifest.doelen),
      gekeurd: v.besluit ? v.besluit.at : v.at,
      grootte: v.maten ? v.maten.totaal : null,
      icoon: v.manifest.icoon ? celPad(a.sleutel, v.hash, v.manifest.icoon) : null,
      bron: 'derden',
      prijsCenten: prijsVan(v),
      gekocht: prijsVan(v) > 0 ? heeftGekocht(key, a.sleutel) : true,
      geinstalleerd: !!verleend,
      verleend: verleend ? toonbaar(verleend.machtigingen, verleend.doelen) : [],
      /* HOE VER DEZE APP KOMT, in een woord. Twee keer dezelfde rekensom over
         twee verschillende vragen: wat het manifest VRAAGT, en wat dit lid
         werkelijk heeft VERLEEND. Die twee door elkaar halen is grens 4, dus ze
         staan hier onder twee namen en nooit onder een. Afgeleid in
         ./bereik.js; er is geen veld waarmee een uitgever dit zet. */
      vraagtBereik: bereik(v.manifest.machtigingen),
      verleendBereik: verleend ? bereik(verleend.machtigingen) : null,
      /* WAT DEZE UPDATE MEER VRAAGT DAN JE HEBT GEGEVEN. Zonder dit kan een app
         stilletjes groeien in bevoegdheden: een nieuwe versie zet een machtiging
         in zijn manifest en niemand die het ziet. Hij wordt hier UITGEREKEND en
         niet bewaard -- een opgeslagen diff loopt achter zodra er een versie
         bijkomt (LAT-regel 4). */
      updateVraagt: verleend ? diff(verleend, v) : []
    };
  }

  const celPad = (sleutel, hash, pad) => '/appcel/' + sleutel + '/' + hash + '/' + pad;

  function catalogus({ zoek, categorie, pagina, per } = {}, key) {
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const c = String(categorie || '').trim();
    let alles = live().map(a => kaart(a, key));
    if (c) alles = alles.filter(a => a.categorie === c);
    if (q) alles = alles.filter(a => (a.naam + ' ' + a.uitleg + ' ' + (a.uitgever ? a.uitgever.naam : '')).toLowerCase().includes(q));
    alles.sort((x, y) => (x.naam.toLowerCase() < y.naam.toLowerCase() ? -1 : 1));
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    return { items: alles.slice((p - 1) * n, (p - 1) * n + n), totaal: alles.length, pagina: p,
      paginas: Math.max(1, Math.ceil(alles.length / n)) };
  }

  /* Mijn apps. Een ingetrokken of geschorste app valt hier VANZELF weg: er wordt
     niets opgeruimd bij het intrekken, want opruimen is een tweede plek waar de
     waarheid kan achterlopen (LAT-regel 4). De verlening blijft staan zodat een
     nieuwe versie van dezelfde app niet opnieuw om alles hoeft te vragen. */
  function mijn(key) {
    const rij = rijVan(key);
    const uit = [];
    for (const sleutel of Object.keys(rij)) {
      const a = app(sleutel);
      if (!a || !a.live) continue;
      const v = versie(a.live);
      if (!v || v.status !== 'gepubliceerd') continue;
      uit.push(kaart(a, key));
    }
    return uit.sort((x, y) => (x.naam.toLowerCase() < y.naam.toLowerCase() ? -1 : 1));
  }

  return { live, kaart, celPad, catalogus, mijn, prijsVan, heeftGekocht, rijVan, verleendeVan, diff };
};
