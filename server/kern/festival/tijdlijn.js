/* RTG Festival (deelmodule): DE EDITIE-TIJDLIJN. De vijfde laag.

   PLATFORM.md noemt hem de ACTIELOG, en FESTIVAL.md par. 6 zegt wat hij hier
   is: de tijdlijn van de editie -- elke inzet, elke beslissing, elk bewijs --
   die aangroeit, nooit wordt herschreven, en daarmee de reconstructie achteraf
   is. Hij stond in par. 7 bij de vijf dingen die nieuw moesten, en was als
   enige van die vijf nooit gebouwd.

   HIJ BEZIT NIETS EN LEEST ALLES. Dat is de graaf-regel uit PLATFORM.md, en
   hier is hij geen stijlkeuze maar de enige werkbare vorm: een eigen logtabel
   naast de scans, de controls en de boekingen zou een tweede waarheid zijn over
   dingen die al een stempel dragen (LAT-regel 4), en die twee lopen uit elkaar
   op de dag dat er een offline bundel binnenkomt of een back-up wordt hersteld.
   Wat hier gebeurt is samenvoegen en sorteren, en verder niets.

   WAT DAT BETEKENT VOOR "WORDT NOOIT HERSCHREVEN". Deze laag is precies zo
   onherschrijfbaar als de bron eronder, en daarom draagt elke regel zijn BRON.
   Drie bronnen zijn echt aangroeiend: de scans, de geschiedenis van een control
   (./gereed.js) en de afdruk van een afgesloten dag (./geheugen.js). Een
   bevestiging op een boeking is een stempel dat opnieuw gezet kan worden -- dan
   verandert het moment mee. Dat is te weten en het staat hier, in plaats van
   dat de tijdlijn een garantie suggereert die de data niet geeft.

   DE SCANS STAAN ER GETELD IN EN NIET EEN VOOR EEN. Par. 6 zegt "elke scan",
   par. 5.1 zegt dat een bezoeker een telling is en geen spoor. Par. 5 weegt
   zwaarder dan par. 6 -- dat staat er met zoveel woorden -- dus komen scans hier
   per poort per kwartier binnen als aantal. Een tijdlijn met "pas 4f2a om 21:03
   bij Noord, om 22:40 bij Alpha" IS het spoor dat par. 5.1 verbiedt, en het is
   ook nog eens onleesbaar: op een terrein van 40.000 mensen wordt de
   reconstructie dan een muur waar niemand meer iets in terugvindt.

   DE GROEPEN STAAN ER NIET IN. Een groep is tussen gasten (./groep.js), en de
   organisatie leest daar niets van -- ook niet achteraf, ook niet geteld. */
'use strict';

const KWARTIER = 15;
const MAX = 500;

module.exports = (ctx) => {
  const { editieVind, dagVind, plekVind } = ctx;

  const kwartierVan = (iso) => {
    const m = String(iso || '').match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)/);
    if (!m) return null;
    const min = Number(m[3]) - (Number(m[3]) % KWARTIER);
    return m[1] + 'T' + m[2] + ':' + String(min).padStart(2, '0');
  };

  /* De scans, per poort en per kwartier. */
  function scans(e, dagId, uit) {
    const per = new Map();
    for (const s of e.scans || []) {
      if (dagId && s.dag !== dagId) continue;
      const bak = kwartierVan(s.at);
      if (!bak) continue;
      const sleutel = bak + '|' + s.poort + '|' + s.richting;
      const r = per.get(sleutel) || { op: bak + ':00', poort: s.poort, richting: s.richting, n: 0 };
      r.n++;
      per.set(sleutel, r);
    }
    for (const r of per.values()) {
      uit.push({ op: r.op, soort: 'scan', door: null, bron: 'scans (groeit aan)',
        zin: r.n + (r.n === 1 ? ' scan ' : ' scans ') + (r.richting === 'in' ? 'naar binnen' : 'naar buiten')
          + ' bij ' + r.poort });
    }
  }

  /* De passen, ook geteld: wie ze een voor een opsomt, koppelt een codenaam aan
     een tijdstip en maakt er alsnog een dossier van. */
  function passen(e, uit) {
    const per = new Map();
    for (const p of Object.values(e.passen || {})) {
      const bak = kwartierVan(p.at);
      if (!bak) continue;
      per.set(bak, (per.get(bak) || 0) + 1);
    }
    for (const [bak, n] of per) {
      uit.push({ op: bak + ':00', soort: 'pas', door: null, bron: 'passen (stempel bij uitgifte)',
        zin: n + (n === 1 ? ' pas uitgegeven' : ' passen uitgegeven') });
    }
  }

  function programma(e, dagId, uit) {
    for (const b of Object.values(e.boekingen || {})) {
      if (dagId && b.dag !== dagId) continue;
      const podium = (plekVind(e, b.podium) || {}).naam || 'onbekend podium';
      if (b.at) {
        uit.push({ op: b.at, soort: 'boeking', door: null, bron: 'boeking (stempel bij aanmaken)',
          zin: b.artiest + ' in het schema gezet op ' + podium + ' (' + b.van + '-' + b.tot + ')' });
      }
      if (b.bevestigd && b.bevestigd.at) {
        uit.push({ op: b.bevestigd.at, soort: 'boeking', door: b.bevestigd.door,
          bron: 'bevestiging (stempel, kan opnieuw gezet worden)',
          zin: b.artiest + ' bevestigd -- ' + b.bevestigd.hoe });
      }
      for (const r of b.rider || []) {
        if (!r.klaar || !r.at) continue;
        uit.push({ op: r.at, soort: 'rider', door: r.door, bron: 'riderpunt (stempel bij afvinken)',
          zin: r.wat + ' klaargezet voor ' + b.artiest });
      }
    }
  }

  function keuring(e, uit) {
    for (const c of Object.values(e.controls || {})) {
      for (const g of c.geschiedenis || []) {
        if (!g.at) continue;
        uit.push({ op: g.at, soort: 'bewijs', door: g.door || null,
          bron: 'controlgeschiedenis (groeit aan)',
          zin: c.naam + ' ' + g.wat + (g.reden ? ' -- ' + g.reden : '') });
      }
    }
  }

  function banden(e, uit) {
    for (const p of Object.values(e.partners || {})) {
      if (p.at) {
        uit.push({ op: p.at, soort: 'partner', door: p.voorgesteldDoor || null,
          bron: 'partnerband (stempel bij voorstellen)',
          zin: p.zaak + ' voorgesteld als ' + p.rol });
      }
      if (p.bevestigd && p.bevestigd.at) {
        uit.push({ op: p.bevestigd.at, soort: 'partner', door: p.bevestigd.door,
          bron: 'partnerband (stempel bij bevestigen)', zin: p.zaak + ' bevestigde de band' });
      }
      if (p.beeindigd && p.beeindigd.at) {
        uit.push({ op: p.beeindigd.at, soort: 'partner', door: p.beeindigd.door,
          bron: 'partnerband (stempel bij beeindigen)',
          zin: p.zaak + ' beeindigd door de ' + p.beeindigd.kant });
      }
    }
  }

  function afsluitingen(e, dagId, uit) {
    for (const a of Object.values(e.afgesloten || {})) {
      if (dagId && a.dag !== dagId) continue;
      uit.push({ op: a.at, soort: 'afsluiting', door: a.door, bron: 'afdruk (groeit aan)',
        zin: 'Dag ' + a.datum + ' afgesloten: ' + a.passenBinnen + ' van de ' + a.passenGeldig
          + ' geldige passen binnen geweest' + (a.herzien ? ' (herzien, ronde ' + a.herzien + ')' : '') });
    }
  }

  /* HET NIEUWSTE BOVENAAN. Een reconstructie leest van achteren naar voren:
     je begint bij wat er misging en loopt terug. Wie hem chronologisch wil,
     draait hem om -- maar de standaard hoort de vraag te bedienen die iemand
     werkelijk heeft als hij dit scherm opent. */
  function tijdlijn(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dagId = v.dag ? String(v.dag) : null;
    if (dagId && !dagVind(e, dagId)) return { status: 404, error: 'Deze dag staat niet in de editie.' };

    const uit = [];
    scans(e, dagId, uit);
    passen(e, uit);
    programma(e, dagId, uit);
    keuring(e, uit);
    banden(e, uit);
    afsluitingen(e, dagId, uit);

    const soorten = Array.isArray(v.soorten) && v.soorten.length ? v.soorten.map(String) : null;
    const gefilterd = soorten ? uit.filter(x => soorten.includes(x.soort)) : uit;
    gefilterd.sort((a, b) => String(b.op).localeCompare(String(a.op)));

    /* GEEN STILLE AFKAPPING. Wat er niet getoond wordt, wordt geteld en
       gemeld; een lijst die stilzwijgend op 500 stopt, leest als "dit was
       alles". */
    return { ok: true, editie: e.id, dag: dagId, aantal: gefilterd.length,
      meer: Math.max(0, gefilterd.length - MAX), gebeurtenissen: gefilterd.slice(0, MAX) };
  }

  return { tijdlijn };
};
