(function (w) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initialen(naam) {
    var d = String(naam || 'RTG').trim().split(/\s+/).filter(Boolean);
    return ((d[0] || 'R')[0] + (d.length > 1 ? d[d.length - 1][0] : (d[0] || 'T')[1] || '')).toUpperCase();
  }
  function klokUitDienst(v) {
    var m = String(v || '').match(/(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})/);
    return m ? m[1] + ' \u2013 ' + m[2] : String(v || 'Geen dienst vastgelegd');
  }
  function kort(v, n) {
    var s = String(v || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function datumKort(v) {
    var d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }) : String(v || 'Niet vastgelegd');
  }
  function dagVan(stand, index) {
    return stand.week && stand.week.days && stand.week.days[index] || null;
  }
  function lidOpDag(stand, lid, index) {
    var dag = dagVan(stand, index);
    return dag && (dag.staff || []).find(function (m) { return Number(m.id) === Number(lid.id); }) || null;
  }
  function verlofOp(stand, lid, dag) {
    if (!dag) return null;
    return ((stand.state && stand.state.verlof) || []).find(function (v) {
      var zelfde = Number(v.staffId) === Number(lid.id) || String(v.name || v.naam || '') === String(lid.name || '');
      var van = String(v.van || v.datum || '').slice(0, 10), tot = String(v.tot || v.van || v.datum || '').slice(0, 10);
      return zelfde && v.status !== 'afgewezen' && van && van <= dag.date && (!tot || tot >= dag.date);
    }) || null;
  }
  function taken(stand) {
    var uit = [];
    (stand.missies || []).filter(function (x) { return x.status !== 'klaar'; }).forEach(function (x) {
      uit.push({ soort: 'missie', id: x.id, status: x.status, titel: x.titel, regel: [x.sectie, x.minuten ? x.minuten + ' min' : '', x.detail].filter(Boolean).join(' · '), kan: true });
    });
    ((stand.state && stand.state.tickets) || []).filter(function (x) { return x.status !== 'klaar'; }).forEach(function (x) {
      uit.push({ soort: 'ticket', id: x.id, status: x.status, titel: x.text, regel: [x.room, x.status === 'bezig' ? 'wordt opgepakt' : 'open'].filter(Boolean).join(' · '), kan: true });
    });
    ((stand.state && stand.state.rooms) || []).filter(function (x) { return x.hk && x.hk.status === 'vuil'; }).forEach(function (x) {
      uit.push({ soort: 'kamer', id: x.id, status: 'open', titel: x.name, regel: 'Schoonmaak vraagt aandacht', kan: false });
    });
    ((stand.state && stand.state.orders) || []).filter(function (x) { return x.status === 'nieuw'; }).forEach(function (x) {
      uit.push({ soort: 'order', id: x.ref, status: 'open', titel: 'Nieuwe bestelling', regel: x.customerCodename || x.pickup || '', kan: false });
    });
    return uit;
  }

  function vandaag(root, stand) {
    var me = stand.me || {}, dag = dagVan(stand, 0), eigen = lidOpDag(stand, { id: me.staffId }, 0);
    var shift = eigen && eigen.shift || null, plaats = stand.state && stand.state.supplier && stand.state.supplier.city;
    var lijst = taken(stand), eerste = lijst[0], binnen = ((stand.state && stand.state.klok && stand.state.klok.binnen) || []).indexOf(me.name) >= 0;
    root.querySelector('#trmInitialen').textContent = initialen(me.name);
    root.querySelector('#trmGroet').textContent = (new Date().getHours() < 12 ? 'Goedemorgen ' : new Date().getHours() < 18 ? 'Goedemiddag ' : 'Goedenavond ') + (String(me.name || '').split(' ')[0] || '') + '.';
    root.querySelector('#trmVandaagRegel').textContent = dag ? datumKort(dag.date) + ' · ' + (binnen ? 'u bent aan het werk' : 'dit is wat vandaag telt') : 'Dit is wat vandaag telt.';
    root.querySelector('#trmDienst').innerHTML = '<div class="trm-dienst"><div class="trm-dienstdeel"><span class="trm-diensticoon">◫</span><span><small class="trm-label">Vandaag</small><b class="trm-waarde">' + esc(klokUitDienst(shift)) + '</b></span></div><div class="trm-dienstdeel"><span class="trm-diensticoon">⌖</span><span><small class="trm-label">Locatie</small><b class="trm-waarde">' + esc(plaats || 'Niet vastgelegd') + '</b></span></div></div>';
    root.querySelector('#trmVolgende').innerHTML = eerste ? '<article class="trm-focus"><div class="trm-focuskop"><span class="trm-focustijd">NU</span><div><h2>' + esc(kort(eerste.titel, 54)) + '</h2><p>' + esc(eerste.regel || 'Open de taak voor de volledige context.') + '</p></div><span class="trm-pijl">›</span></div>' + (eerste.kan ? '<button class="trm-primair" type="button" data-trm-start="0">' + (eerste.status === 'bezig' ? 'Markeer als gereed' : 'Start taak') + '</button>' : '<button class="trm-primair" type="button" data-trm-diep="taken">Open taak</button>') + '</article>' : '<div class="trm-leeg"><b>Uw aandacht is vrij.</b>Er staat nu geen open taak. Nieuw werk verschijnt hier vanzelf.</div>';
    root.querySelector('#trmTijdlijn').innerHTML = lijst.length ? lijst.slice(0, 5).map(function (t, i) {
      return '<div class="trm-moment"><time>' + (i ? 'Daarna' : 'Nu') + '</time><b>' + esc(kort(t.titel, 64)) + '</b><span>' + esc(t.regel || 'De volledige context staat bij Taken.') + '</span></div>';
    }).join('') : '<div class="trm-moment"><time>Nu</time><b>Alles is bij</b><span>Uw werkdag bevat geen open taken.</span></div>';
    stand.taken = lijst;
  }

  w.RTGTeamRoomBeeld = { vandaag: vandaag, initialen: initialen,
    helpers: { esc: esc, klokUitDienst: klokUitDienst, datumKort: datumKort,
      dagVan: dagVan, lidOpDag: lidOpDag, verlofOp: verlofOp } };
}(window));
