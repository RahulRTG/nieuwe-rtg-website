/* RTG Chauffeur -- de werkende PDA bovenop dezelfde Mobility OS-keten als de
   reizigersapp en dispatch. De browser tekent geen eigen waarheid: open ritten,
   bedragen, voertuigen en toegestane statusstappen komen van de server.

   Zonder personeelssessie blijft de werkvloer leeg en vraagt de app om een
   persoonlijke aanmelding. Alleen de expliciete Magnaat-trainingskopie krijgt
   synthetische ritten; die sandbox blokkeert API-, geld- en locatieverkeer. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var token = null;
  try { token = localStorage.getItem('rtg_pda_token') || localStorage.getItem('rtg_sup_token'); } catch (e) {}

  var DEMO_RIT = {
    ref: 'RTG-TEST-2408', ritsoort: 'direct', boeking: 'direct', categorie: 'taxi',
    van: { label: 'Ibiza Airport' }, naar: { label: 'Sal de Mar' }, reizigers: 2,
    bagage: 2, km: 8.4, minuten: 23, prijs: 1240, status: 'aangevraagd',
    reizigerCodenaam: 'Zonvogel', gemaakt: new Date(Date.now() - 2 * 60000).toISOString(),
    vertrekWens: null, notitie: 'Ophalen bij aankomsthal 1.', ophaalcode: '6109'
  };
  var DEMO_GEPLAND = {
    ref: 'RTG-TEST-1640', ritsoort: 'reservering', boeking: 'op-aanvraag', categorie: 'taxi',
    van: { label: 'Marina Botafoch' }, naar: { label: 'Ibiza Airport' }, reizigers: 1,
    bagage: 1, km: 10.2, minuten: 26, prijs: 1890, status: 'aangevraagd',
    reizigerCodenaam: 'Maanlicht', gemaakt: new Date().toISOString(), vertrekWens: vandaagOm(16, 40)
  };

  var staat = {
    /* DEMO IS VAN MAGNAAT, NIET VAN RTG. Hier stond `!token ||
       ?demo=1`: wie niet was aangemeld kreeg dus vanzelf een verzonnen
       ritaanvraag te zien, met een codenaam en een bedrag erbij. Een chauffeur
       die de app opent hoort te zien wat er echt voor hem klaarstaat, of dat
       hij niet is aangemeld -- die tekst stond er al ("Niet aangemeld").
       Simuleren doet Magnaat, en die houdt zijn eigen ingang. */
    demo: window.RTG_MAGNAAT_PROEF === true,
    gegevens: null, fout: null, bezig: false, gekozen: null, blad: 'ritten',
    genegeerd: new Set(), laatsteOpen: null, eersteLading: true, poll: null,
    positieWatch: null, laatstePositieAt: 0, laatstePositie: null,
    automatischVoorlezen: leesKeuze('rtg_chauffeur_voorlezen'),
    demoVoltooid: []
  };

  function vandaagOm(uur, minuut) {
    var d = new Date(); d.setHours(uur, minuut, 0, 0); return d.toISOString();
  }
  function leesKeuze(sleutel) {
    try { return localStorage.getItem(sleutel) === '1'; } catch (e) { return false; }
  }
  function bewaarKeuze(sleutel, waarde) {
    try { localStorage.setItem(sleutel, waarde ? '1' : '0'); } catch (e) {}
  }
  function maak(tag, klasse, tekst) {
    var el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (tekst != null) el.textContent = tekst;
    return el;
  }
  function icoon(paden) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    paden.forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d); s.appendChild(p);
    });
    return s;
  }
  function leeg(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function toonDialoog(el) { if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', ''); }
  function sluitDialoog(el) { if (typeof el.close === 'function') el.close(); else el.removeAttribute('open'); }

  var toastTimer;
  function toast(tekst) {
    var el = $('#toast'); el.textContent = tekst; el.classList.add('zichtbaar');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('zichtbaar'); }, 3600);
  }
  function api(pad, body) {
    return fetch(pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token
    }, body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var fout = new Error(d.error || 'RTG Mobility is niet bereikbaar.'); fout.status = r.status; throw fout; }
        return d;
      });
    });
  }

  function demoGegevens() {
    return {
      ok: true, vervoerder: 'RTG-MAGNAAT', demo: true,
      actor: { name: 'Yara El Idrissi', staffId: 'test-yara', manager: false },
      vloot: [{ id: 'RTG-E1', naam: 'RTG Executive 01', bestuurder: 'Yara El Idrissi', inzetbaar: true }],
      open: [Object.assign({}, DEMO_RIT), Object.assign({}, DEMO_GEPLAND)],
      lopend: [], klaar: staat.demoVoltooid.slice()
    };
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLocaleLowerCase('nl-NL'); }
  function plaats(v, terugval) {
    if (!v) return terugval || 'Onbekend';
    if (typeof v === 'string') return v;
    return v.label || v.naam || v.code || v.adres || terugval || 'Onbekend';
  }
  function geld(centen) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format((Number(centen) || 0) / 100);
  }
  function km(rit) { return Number.isFinite(rit && rit.km) ? String(rit.km).replace('.', ',') + ' KM' : 'AFSTAND VOLGT'; }
  function minuten(rit) { return Number.isFinite(rit && rit.minuten) ? rit.minuten + ' MIN' : 'DUUR VOLGT'; }
  function tijdKort(iso) {
    var d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function geleden(iso) {
    var min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return min < 1 ? 'NU' : min + ' MIN VAN U';
  }
  function ritNaam(rit) { return plaats(rit && rit.van, 'Vertrek') + ' → ' + plaats(rit && rit.naar, 'Bestemming'); }

  var STATUS = {
    geaccepteerd: ['onderweg', 'VERTREK NAAR KLANT'],
    onderweg: ['aangekomen', 'IK BEN BIJ DE KLANT'],
    aangekomen: ['ingestapt', 'KLANT AAN BOORD'],
    ingestapt: ['rijdt', 'START DE RIT'],
    rijdt: ['voltooid', 'RIT VOLTOOID'],
    incident: ['rijdt', 'HERVAT DE RIT']
  };
  var STATUS_NAAM = {
    aangevraagd: 'Nieuwe aanvraag', geprijsd: 'Geprijsd', aangeboden: 'Aangeboden',
    geaccepteerd: 'Rit aangenomen', onderweg: 'Naar de klant', aangekomen: 'Bij de klant',
    ingestapt: 'Klant aan boord', rijdt: 'Rit bezig', voltooid: 'Voltooid',
    afgerekend: 'Afgerekend', incident: 'Incident actief', geannuleerd: 'Geannuleerd',
    'no-show': 'Niet verschenen'
  };
  var FASE = { geaccepteerd: 1, onderweg: 2, aangekomen: 3, ingestapt: 4, rijdt: 4, voltooid: 5, afgerekend: 5, incident: 3 };

  function actor() { return (staat.gegevens && staat.gegevens.actor) || null; }
  function openRitten() {
    return ((staat.gegevens && staat.gegevens.open) || []).filter(function (r) { return !staat.genegeerd.has(r.ref); });
  }
  function actieveRit() {
    var lijst = (staat.gegevens && staat.gegevens.lopend) || [];
    if (!lijst.length) return null;
    var a = actor();
    if (!a || !a.staffId || a.manager) return lijst[0];
    return lijst.find(function (r) { return r.chauffeur && norm(r.chauffeur) === norm(a.name); }) || null;
  }
  function gekozenRit() {
    var ref = staat.gekozen;
    return openRitten().concat((staat.gegevens && staat.gegevens.lopend) || []).find(function (r) { return r.ref === ref; }) || null;
  }

  function zetVerbinding(goed, tekst) {
    var el = $('#verbinding'); el.lastChild.textContent = ' ' + (tekst || (goed ? 'LIVE' : 'OFFLINE'));
    el.classList.toggle('uit', !goed); el.querySelector('i').style.background = goed ? 'var(--groen)' : 'var(--rood)';
    $('#apiStand').textContent = goed ? 'Verbonden' : 'Niet bereikbaar';
    $('#apparaatStand').textContent = navigator.onLine ? 'Online' : 'Offline';
  }
  function zetModus() {
    $('#modusLabel').textContent = staat.demo ? 'MAGNAAT TEST' : 'LIVE';
    $('#demoKnop').hidden = !staat.demo;
    $('#sessieStand').textContent = staat.demo ? 'Geïsoleerde trainingskopie' : (token ? 'Persoonlijk aangemeld' : 'Niet aangemeld');
    $('#meldingStand').textContent = !('Notification' in window) ? 'Niet beschikbaar op dit apparaat'
      : Notification.permission === 'granted' ? 'Ingeschakeld' : Notification.permission === 'denied' ? 'Geblokkeerd in apparaatinstellingen' : 'Schakel apparaatmeldingen in';
    $('#voorleesStand').textContent = staat.automatischVoorlezen ? 'Aan' : 'Uit';
  }

  function ritFeiten(rit) {
    var vak = maak('p', 'ritfeiten');
    [minuten(rit), km(rit), geld(rit.prijs)].forEach(function (tekst, i) {
      if (i) vak.appendChild(maak('i'));
      vak.appendChild(maak('span', i === 2 ? 'prijs' : '', tekst));
    });
    return vak;
  }
  function routeRegel(rit) {
    var route = maak('div', 'ritroute');
    route.appendChild(maak('span', '', plaats(rit.van, 'Vertrek')));
    route.appendChild(maak('b', '', '→'));
    route.appendChild(maak('span', '', plaats(rit.naar, 'Bestemming')));
    return route;
  }
  function voorleesKnop(rit) {
    var b = maak('button', 'voorleesactie'); b.type = 'button';
    b.appendChild(icoon(['M5 9v6h4l5 4V5L9 9H5Z', 'M17 9c1 1 1 5 0 6', 'M20 6c3 3 3 9 0 12']));
    b.appendChild(maak('span', '', 'WORDT VOORGELEZEN'));
    b.addEventListener('click', function () { spreekRit(rit, true); }); return b;
  }

  function tekenAanvraag(rit) {
    var kaart = maak('article', 'ritkaart nieuw');
    var kop = maak('div', 'nieuwe-kop'); kop.appendChild(maak('i')); kop.appendChild(maak('span', '', 'NIEUWE RITAANVRAAG')); kaart.appendChild(kop);
    kaart.appendChild(maak('p', 'afstand', geleden(rit.gemaakt)));
    kaart.appendChild(routeRegel(rit)); kaart.appendChild(ritFeiten(rit)); kaart.appendChild(voorleesKnop(rit));
    var bekijken = maak('button', 'hoofdactie'); bekijken.type = 'button'; bekijken.appendChild(maak('span', '', 'BEKIJK RIT')); bekijken.appendChild(maak('b', '', '→'));
    bekijken.addEventListener('click', function () { openRitDialoog(rit); }); kaart.appendChild(bekijken);
    var lopen = maak('button', 'stille-actie', 'LAAT LOPEN'); lopen.type = 'button'; lopen.addEventListener('click', function () { laatLopen(rit); }); kaart.appendChild(lopen);
    return kaart;
  }

  function tekenActief(rit) {
    var luchthavenrit = /ibiza airport/i.test(plaats(rit.van));
    var kaart = maak('article', 'ritkaart actief' + (luchthavenrit ? ' met-beeld' : ''));
    if (luchthavenrit) {
      var beeld = maak('div', 'ritbeeld');
      var beeldtekst = maak('div');
      beeldtekst.appendChild(maak('small', '', 'OPHAALPUNT'));
      beeldtekst.appendChild(maak('strong', '', plaats(rit.van)));
      beeldtekst.appendChild(maak('span', '', rit.notitie || 'Volg de officiële ophaalzone in de ritinformatie.'));
      beeld.appendChild(beeldtekst); kaart.appendChild(beeld);
    }
    var kop = maak('div', 'actiefkop'), titels = maak('div');
    titels.appendChild(maak('p', 'kaartlabel', 'ACTIEVE RIT'));
    titels.appendChild(maak('h2', '', rit.reizigerCodenaam || 'RTG-reiziger'));
    kop.appendChild(titels); kop.appendChild(maak('span', 'statuschip', STATUS_NAAM[rit.status] || rit.status)); kaart.appendChild(kop);
    kaart.appendChild(maak('p', 'afstand', rit.ref)); kaart.appendChild(routeRegel(rit)); kaart.appendChild(ritFeiten(rit));
    var balk = maak('div', 'fasebalk'), fase = FASE[rit.status] || 1;
    for (var i = 1; i <= 5; i++) balk.appendChild(maak('i', i <= fase ? 'gedaan' : ''));
    kaart.appendChild(balk);
    var fasen = maak('div', 'faselabels');
    ['TOEGEWEZEN', 'ONDERWEG', 'AANGEKOMEN', 'AAN BOORD', 'KLAAR'].forEach(function (label, index) {
      fasen.appendChild(maak('span', index + 1 <= fase ? 'gedaan' : '', label));
    });
    kaart.appendChild(fasen);
    if (rit.notitie && !luchthavenrit) kaart.appendChild(maak('p', 'afstand', rit.notitie));
    if (['aangekomen', 'ingestapt', 'rijdt'].includes(rit.status)) {
      var passagier = maak('div', 'passagierkaart');
      var persoon = maak('div');
      persoon.appendChild(maak('small', '', 'PASSAGIER'));
      persoon.appendChild(maak('strong', '', rit.reizigerCodenaam || 'RTG-reiziger'));
      persoon.appendChild(maak('span', '', (rit.reizigers || 1) + ' reiziger' + ((rit.reizigers || 1) === 1 ? '' : 's') + ' · ' + (rit.bagage || 0) + ' bagage'));
      passagier.appendChild(persoon);
      if (rit.ophaalcode) {
        var code = maak('div', 'ophaalcode');
        code.appendChild(maak('small', '', 'OPHAALCODE'));
        code.appendChild(maak('b', '', String(rit.ophaalcode)));
        passagier.appendChild(code);
      }
      kaart.appendChild(passagier);
    }
    var volgende = STATUS[rit.status];
    if (volgende) {
      var actie = maak('button', 'hoofdactie'); actie.type = 'button'; actie.appendChild(maak('span', '', volgende[1])); actie.appendChild(maak('b', '', '→'));
      actie.addEventListener('click', function () { zetRitStatus(rit, volgende[0], actie); }); kaart.appendChild(actie);
    } else {
      var klaar = maak('div', 'veiligheidsnoot'); klaar.appendChild(icoon(['M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z']));
      var p = maak('p'); p.appendChild(maak('b', '', 'Rit veilig vastgelegd')); p.appendChild(maak('span', '', 'De centrale handelt de financiële afronding af.')); klaar.appendChild(p); kaart.appendChild(klaar);
    }
    return kaart;
  }

  function tekenLeeg() {
    var kaart = maak('article', 'ritkaart leeg'); kaart.appendChild(maak('p', 'kaartlabel', 'RTG MOBILITY'));
    kaart.appendChild(maak('h2', '', 'Geen open aanvragen'));
    kaart.appendChild(maak('p', '', staat.demo ? 'Gebruik Hulp om een nieuwe ritaanvraag te simuleren.' : 'Nieuwe aanvragen van uw vervoerder verschijnen hier automatisch.'));
    return kaart;
  }
  function tekenFout() {
    var aanmelden = staat.foutsoort === 'aanmelden';
    var kaart = maak('article', 'ritkaart leeg foutkaart');
    kaart.appendChild(maak('p', 'kaartlabel', aanmelden ? 'AANMELDEN NODIG' : 'VERBINDING NODIG'));
    kaart.appendChild(maak('h2', '', aanmelden ? 'U bent niet aangemeld als chauffeur' : 'Ritten konden niet worden geladen'));
    kaart.appendChild(maak('p', '', staat.fout || 'Controleer uw verbinding en probeer opnieuw.'));
    /* Een knop die niets kan doen, hoort er niet te staan: opnieuw proberen
       lost een ontbrekende aanmelding nooit op. */
    if (aanmelden) {
      var a = maak('a', 'hoofdactie'); a.href = '/apps/leverancier.html';
      a.appendChild(maak('span', '', 'NAAR DE PERSONEELSLOGIN')); a.appendChild(maak('b', '', '\u2192'));
      kaart.appendChild(a);
    } else {
      var b = maak('button', 'hoofdactie'); b.type = 'button';
      b.appendChild(maak('span', '', 'PROBEER OPNIEUW')); b.appendChild(maak('b', '', '\u2192'));
      b.addEventListener('click', laad); kaart.appendChild(b);
    }
    return kaart;
  }

  function tekenWerk() {
    var vak = $('#werkstapel'); leeg(vak); vak.setAttribute('aria-busy', String(staat.bezig));
    if (staat.fout && !staat.gegevens) { vak.appendChild(tekenFout()); return; }
    var actief = actieveRit();
    if (actief) vak.appendChild(tekenActief(actief));
    else if (openRitten().length) vak.appendChild(tekenAanvraag(openRitten()[0]));
    else vak.appendChild(tekenLeeg());
    tekenReservering(actief);
  }
  function tekenReservering(actief) {
    var kaart = $('#volgendeReservering');
    var gepland = openRitten().filter(function (r) { return r.ref !== (actief && actief.ref) && r.vertrekWens; })
      .sort(function (a, b) { return new Date(a.vertrekWens) - new Date(b.vertrekWens); })[0];
    kaart.hidden = !gepland;
    if (gepland) $('#reserveringTekst').textContent = tijdKort(gepland.vertrekWens) + ' · ' + plaats(gepland.van);
  }

  function tekenVandaag() {
    var klaar = (staat.gegevens && staat.gegevens.klaar) || [];
    $('#vandaagDatum').textContent = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#cijferRitten').textContent = String(klaar.length);
    $('#cijferKm').textContent = klaar.reduce(function (n, r) { return n + (Number(r.km) || 0); }, 0).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
    $('#cijferOmzet').textContent = geld(klaar.reduce(function (n, r) { return n + (Number(r.prijs) || 0); }, 0));
    var log = $('#ritlog'); leeg(log);
    if (!klaar.length) { log.appendChild(maak('p', 'leegregel', 'Nog geen ritten afgerond tijdens deze dienst.')); return; }
    klaar.forEach(function (r) {
      var regel = maak('div', 'logregel klaar'); regel.appendChild(maak('i'));
      var tekst = maak('div'); tekst.appendChild(maak('b', '', ritNaam(r))); tekst.appendChild(maak('span', '', r.ref)); regel.appendChild(tekst);
      regel.appendChild(maak('time', '', geld(r.prijs))); log.appendChild(regel);
    });
  }

  function tekenNavigatie() {
    var rit = actieveRit(), kaart = $('#navigatiekaart'); leeg(kaart);
    var open = $('#openNavigatie'), deel = $('#deelPositie'); open.disabled = !rit; deel.disabled = !rit;
    if (!rit) {
      var kompas = maak('div', 'kompas'); kompas.appendChild(icoon(['m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'])); kaart.appendChild(kompas);
      kaart.appendChild(maak('p', '', 'GEEN ACTIEVE ROUTE')); kaart.appendChild(maak('h2', '', 'Neem eerst een rit aan.'));
      kaart.appendChild(maak('span', '', 'Daarna verschijnen vertrek, bestemming en de veilige locatiedeling hier.')); return;
    }
    var route = maak('div', 'navroute');
    [['OPHALEN', plaats(rit.van)], ['BESTEMMING', plaats(rit.naar)]].forEach(function (rij) {
      var div = maak('div'); div.appendChild(maak('i')); var tekst = maak('span'); tekst.appendChild(maak('small', '', rij[0])); tekst.appendChild(maak('b', '', rij[1])); div.appendChild(tekst); route.appendChild(div);
    });
    kaart.appendChild(maak('p', '', STATUS_NAAM[rit.status] || rit.status)); kaart.appendChild(maak('h2', '', minuten(rit) + ' · ' + km(rit))); kaart.appendChild(route);
  }

  function render() {
    zetModus(); tekenWerk(); tekenVandaag(); tekenNavigatie();
    var actief = actieveRit();
    var titels = {
      geaccepteerd: 'RIT TOEGEWEZEN', onderweg: 'U BENT ONDERWEG', aangekomen: 'U BENT ER',
      ingestapt: 'PASSAGIER AAN BOORD', rijdt: 'RIT IN UITVOERING', voltooid: 'RIT VOLTOOID', incident: 'INCIDENT ACTIEF'
    };
    $('#pda').setAttribute('data-ritfase', actief ? actief.status : 'beschikbaar');
    $('#rittenTitel').textContent = actief ? (titels[actief.status] || 'ACTIEVE RIT') : 'U BENT BESCHIKBAAR';
    var naam = actor() && actor().name ? actor().name.split(/\s+/)[0] : 'chauffeur';
    $('#groet').textContent = groet() + ', ' + naam.toLocaleUpperCase('nl-NL');
  }
  function groet() { var uur = new Date().getHours(); return uur < 12 ? 'GOEDEMORGEN' : uur < 18 ? 'GOEDEMIDDAG' : 'GOEDEAVOND'; }

  function nieuweRitSignaal(rit) {
    if (!rit || staat.eersteLading || rit.ref === staat.laatsteOpen) return;
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      var n = new Notification('Nieuwe RTG-ritaanvraag', { body: ritNaam(rit) + ' · ' + minuten(rit), icon: '/icon-192.png', tag: 'rtg-rit-' + rit.ref });
      n.onclick = function () { window.focus(); wisselBlad('ritten'); };
    }
    if (staat.automatischVoorlezen) spreekRit(rit, false);
  }

  async function laad() {
    if (staat.bezig) return;
    staat.bezig = true; staat.fout = null;
    if (staat.demo) {
      if (!staat.gegevens) staat.gegevens = demoGegevens();
      staat.bezig = false; zetVerbinding(true, 'MAGNAAT TEST'); render(); staat.eersteLading = false; return;
    }
    try {
      var gegevens = await api('/api/staff/mob/mijn', {});
      var nieuwste = (gegevens.open || [])[0]; nieuweRitSignaal(nieuwste);
      staat.gegevens = gegevens; staat.laatsteOpen = nieuwste && nieuwste.ref; staat.fout = null;
      zetVerbinding(true, 'LIVE');
      if (!staat.poll) staat.poll = setInterval(function () { if (!document.hidden) laad(); }, 12000);
    } catch (e) {
      /* NIET AANGEMELD IS GEEN STORING. Dat verschil stond in de tekst maar
         niet in de kop en niet in de verbindingschip: wie deze PDA opende
         zonder personeelssessie las "VERBINDING NODIG -- ritten konden niet
         worden geladen" met daaronder een storingslampje, terwijl er niets mis
         was met de verbinding. Een chauffeur langs de weg gaat dan zijn
         netwerk zoeken in plaats van zich aan te melden. */
      staat.fout = e.status === 401 ? 'Meld u aan via de persoonlijke RTG-personeelslogin.' : e.message;
      staat.foutsoort = e.status === 401 ? 'aanmelden' : 'verbinding';
      zetVerbinding(false, e.status === 401 ? 'AANMELDEN' : (navigator.onLine ? 'STORING' : 'OFFLINE'));
    } finally {
      staat.bezig = false; render(); staat.eersteLading = false;
    }
  }

  function openRitDialoog(rit) {
    staat.gekozen = rit.ref;
    $('#dialoogLabel').textContent = rit.status === 'aangevraagd' ? 'NIEUWE RITAANVRAAG' : (STATUS_NAAM[rit.status] || rit.status).toLocaleUpperCase('nl-NL');
    $('#dialoogTitel').textContent = rit.reizigerCodenaam || 'Rit bekijken';
    $('#dialoogVan').textContent = plaats(rit.van); $('#dialoogNaar').textContent = plaats(rit.naar);
    var feiten = $('#dialoogFeiten'); leeg(feiten);
    [['Duur', minuten(rit)], ['Afstand', km(rit)], ['Ritprijs', geld(rit.prijs)], ['Reizigers', String(rit.reizigers || 1)], ['Bagage', String(rit.bagage || 0)], ['Referentie', rit.ref]].forEach(function (rij) {
      var div = maak('div'), dt = maak('dt', '', rij[0]), dd = maak('dd', '', rij[1]); div.appendChild(dt); div.appendChild(dd); feiten.appendChild(div);
    });
    $('#accepteerRit').hidden = !['aangevraagd', 'geprijsd', 'aangeboden'].includes(rit.status);
    $('#laatLopenDialoog').hidden = $('#accepteerRit').hidden;
    toonDialoog($('#ritDialoog'));
  }
  function laatLopen(rit) {
    staat.genegeerd.add(rit.ref); sluitDialoog($('#ritDialoog')); toast('Deze aanvraag blijft beschikbaar voor een andere chauffeur.'); render();
  }

  function eigenVoertuig() {
    var a = actor(), vloot = (staat.gegevens && staat.gegevens.vloot) || [];
    var inzetbaar = vloot.filter(function (v) { return v.inzetbaar; });
    if (!a) return inzetbaar[0] || null;
    var eigen = inzetbaar.find(function (v) { return v.bestuurder && norm(v.bestuurder) === norm(a.name); });
    if (eigen) return eigen;
    return a.manager || !a.staffId ? (inzetbaar[0] || null) : null;
  }

  async function accepteer(rit, knop) {
    if (!rit || staat.bezig) return;
    knop.disabled = true; knop.querySelector('span').textContent = 'RIT WORDT TOEGEWEZEN…';
    try {
      if (staat.demo) {
        rit.status = 'geaccepteerd'; rit.chauffeur = actor().name; rit.voertuig = 'RTG-E1';
        staat.gegevens.open = staat.gegevens.open.filter(function (r) { return r.ref !== rit.ref; }); staat.gegevens.lopend = [rit];
      } else {
        var voertuig = eigenVoertuig();
        if (!voertuig) throw new Error('Er is geen inzetbaar voertuig aan uw chauffeursprofiel gekoppeld. Vraag de centrale om een voertuig toe te wijzen.');
        await api('/api/supplier/mob/toewijzen', { ref: rit.ref, assetId: voertuig.id, bevestigd: true });
        await laad();
      }
      sluitDialoog($('#ritDialoog')); toast('Rit veilig aan u toegewezen.'); render();
    } catch (e) { toast(e.message); }
    finally { knop.disabled = false; knop.querySelector('span').textContent = 'NEEM RIT AAN'; }
  }

  async function zetRitStatus(rit, status, knop) {
    if (staat.bezig) return; staat.bezig = true; knop.disabled = true;
    try {
      if (staat.demo) {
        rit.status = status;
        if (status === 'voltooid') {
          staat.gegevens.lopend = []; staat.demoVoltooid.unshift(rit); staat.gegevens.klaar = staat.demoVoltooid.slice(); stopPositie();
        }
      } else {
        await api('/api/staff/mob/status', { ref: rit.ref, status: status });
        if (status === 'onderweg' || status === 'rijdt') startPositie();
        if (status === 'voltooid') stopPositie();
        /* laad() beschermt zichzelf tegen dubbele polls. Deze handeling heeft
           die grendel zelf gezet, dus geef hem vrij voordat de nieuwe waarheid
           na de mutatie wordt opgehaald. */
        staat.bezig = false;
        await laad();
      }
      toast(STATUS_NAAM[status] || status); render();
    } catch (e) { toast(e.message); }
    finally { staat.bezig = false; knop.disabled = false; }
  }

  function spreekRit(rit, handmatig) {
    if (!('speechSynthesis' in window)) { if (handmatig) toast('Voorlezen is op dit apparaat niet beschikbaar.'); return; }
    window.speechSynthesis.cancel();
    var tekst = 'Nieuwe ritaanvraag. Van ' + plaats(rit.van) + ' naar ' + plaats(rit.naar) + '. ' + minuten(rit) + ', ' + km(rit) + ', ritprijs ' + geld(rit.prijs) + '.';
    var u = new SpeechSynthesisUtterance(tekst); u.lang = 'nl-NL'; u.rate = .93; window.speechSynthesis.speak(u);
    if (handmatig) toast('Rit wordt voorgelezen.');
  }

  function startPositie() {
    if (staat.demo || staat.positieWatch != null || !navigator.geolocation) return;
    staat.positieWatch = navigator.geolocation.watchPosition(function (p) {
      staat.laatstePositie = { lat: p.coords.latitude, lng: p.coords.longitude };
      var nu = Date.now(); if (nu - staat.laatstePositieAt < 15000) return; staat.laatstePositieAt = nu;
      var rit = actieveRit(); if (!rit) return stopPositie();
      api('/api/staff/mob/positie', { ref: rit.ref, lat: p.coords.latitude, lng: p.coords.longitude }).catch(function () {});
    }, function (e) { toast(e.code === 1 ? 'Locatietoegang is uitgeschakeld.' : 'Positie kon niet worden bepaald.'); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  }
  function stopPositie() {
    if (staat.positieWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(staat.positieWatch);
    staat.positieWatch = null; staat.laatstePositie = null;
  }
  function deelEenPositie() {
    var rit = actieveRit(); if (!rit || !navigator.geolocation) { toast('Geen actieve rit of locatiefunctie beschikbaar.'); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      staat.laatstePositie = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (staat.demo) { toast('Testpositie lokaal bijgewerkt; er zijn geen gegevens verstuurd.'); return; }
      api('/api/staff/mob/positie', { ref: rit.ref, lat: p.coords.latitude, lng: p.coords.longitude })
        .then(function () { toast('Huidige positie veilig gedeeld.'); }).catch(function (e) { toast(e.message); });
    }, function () { toast('Geef locatietoegang om uw positie te delen.'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 });
  }
  function openRoute() {
    var rit = actieveRit(); if (!rit) return;
    var doel = ['geaccepteerd', 'onderweg'].includes(rit.status) ? plaats(rit.van) : plaats(rit.naar);
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(doel), '_blank', 'noopener,noreferrer');
  }

  function wisselBlad(naam) {
    staat.blad = naam;
    $$('[data-blad]').forEach(function (el) { var aan = el.dataset.blad === naam; el.hidden = !aan; el.classList.toggle('actief', aan); });
    $$('[data-naar]').forEach(function (b) { var aan = b.dataset.naar === naam; b.classList.toggle('actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (naam === 'navigatie') tekenNavigatie(); if (naam === 'vandaag') tekenVandaag();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function vraagMeldingen() {
    if (!('Notification' in window)) { toast('Apparaatmeldingen zijn hier niet beschikbaar.'); return; }
    if (Notification.permission === 'granted') { toast('Ritmeldingen staan al aan.'); return; }
    Notification.requestPermission().then(function (toestemming) { zetModus(); toast(toestemming === 'granted' ? 'Ritmeldingen ingeschakeld.' : 'Meldingen zijn niet ingeschakeld.'); });
  }
  function simuleerRit() {
    if (!staat.demo) return;
    var rit = Object.assign({}, DEMO_RIT, { ref: 'RTG-TEST-' + Date.now().toString().slice(-5), gemaakt: new Date().toISOString() });
    staat.gegevens.lopend = []; staat.gegevens.open = [rit, Object.assign({}, DEMO_GEPLAND)]; staat.genegeerd.clear(); staat.laatsteOpen = rit.ref;
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]); if (staat.automatischVoorlezen) spreekRit(rit, false);
    wisselBlad('ritten'); render(); toast('Nieuwe Magnaat-testrit ontvangen.');
  }

  $$('[data-naar]').forEach(function (b) { b.addEventListener('click', function () { wisselBlad(b.dataset.naar); }); });
  $('#veiligKnop').addEventListener('click', function () { toonDialoog($('#veiligDialoog')); });
  $('#sluitVeilig').addEventListener('click', function () { sluitDialoog($('#veiligDialoog')); });
  $('#sluitDialoog').addEventListener('click', function () { sluitDialoog($('#ritDialoog')); });
  $('#laatLopenDialoog').addEventListener('click', function () { var rit = gekozenRit(); if (rit) laatLopen(rit); });
  $('#accepteerRit').addEventListener('click', function () { accepteer(gekozenRit(), $('#accepteerRit')); });
  $('#openNavigatie').addEventListener('click', openRoute); $('#deelPositie').addEventListener('click', deelEenPositie);
  $('#verversVandaag').addEventListener('click', function () { laad().then(function () { toast('Ritoverzicht bijgewerkt.'); }); });
  $('#meldingenKnop').addEventListener('click', vraagMeldingen);
  $('#voorlezenKnop').addEventListener('click', function () { staat.automatischVoorlezen = !staat.automatischVoorlezen; bewaarKeuze('rtg_chauffeur_voorlezen', staat.automatischVoorlezen); zetModus(); toast(staat.automatischVoorlezen ? 'Nieuwe aanvragen worden automatisch voorgelezen.' : 'Automatisch voorlezen staat uit.'); });
  $('#demoKnop').addEventListener('click', simuleerRit);
  $('#noodKnop').addEventListener('click', function () { toonDialoog($('#noodDialoog')); });
  $('#sluitNood').addEventListener('click', function () { sluitDialoog($('#noodDialoog')); });
  $('#meldIncident').addEventListener('click', function () {
    var rit = actieveRit(); if (!rit) { toast('Er is geen actieve rit om een incident bij vast te leggen.'); return; }
    sluitDialoog($('#noodDialoog'));
    var nep = { disabled: false }; zetRitStatus(rit, 'incident', nep);
  });
  [$('#ritDialoog'), $('#veiligDialoog'), $('#noodDialoog')].forEach(function (d) { d.addEventListener('click', function (e) { if (e.target === d) sluitDialoog(d); }); });
  window.addEventListener('online', function () { zetVerbinding(true); laad(); });
  window.addEventListener('offline', function () { zetVerbinding(false, 'OFFLINE'); zetModus(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !staat.demo) laad(); });
  window.addEventListener('beforeunload', stopPositie);

  zetModus(); laad();
})();
