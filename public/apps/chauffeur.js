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
  function leeg(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function toonDialoog(el) { if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', ''); }
  function sluitDialoog(el) { if (typeof el.close === 'function') el.close(); else el.removeAttribute('open'); }

  var toastTimer;
  function toast(tekst) {
    var el = $('#toast'); el.textContent = tekst; el.classList.add('toon');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('toon'); }, 3600);
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
  /* Bedragen, tijden en datums volgen de taal van de pagina (Intl). */
  function taal() { return document.documentElement.lang || 'nl'; }
  function geld(centen) {
    return new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR' }).format((Number(centen) || 0) / 100);
  }
  function km(rit) { return Number.isFinite(rit && rit.km) ? String(rit.km).replace('.', ',') + ' KM' : 'AFSTAND VOLGT'; }
  function minuten(rit) { return Number.isFinite(rit && rit.minuten) ? rit.minuten + ' MIN' : 'DUUR VOLGT'; }
  function tijdKort(iso) {
    var d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(taal(), { hour: '2-digit', minute: '2-digit' });
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

  /* De stand staat in woorden (LIVE, AANMELDEN, STORING), niet in een lampje. */
  function zetVerbinding(goed, tekst) {
    var el = $('#verbinding'); el.textContent = tekst || (goed ? 'LIVE' : 'OFFLINE');
    el.setAttribute('data-stand', goed ? 'aan' : 'uit');
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

  /* De kaarten van de werkvloer, in de vorm van /ds/. Wat een toets of een
     mens moet terugvinden, draagt een data-attribuut: data-rit (nieuw, actief,
     leeg, fout), data-volgende (de ene volgende stap) en data-passagier. */
  function ritFeiten(rit) {
    return maak('p', 'ds-meta', [minuten(rit), km(rit), geld(rit.prijs)].join(' · '));
  }
  function routeRegel(rit) {
    return maak('h2', 'ds-kaart__titel', plaats(rit.van, 'Vertrek') + ' → ' + plaats(rit.naar, 'Bestemming'));
  }
  function knop(klasse, tekst, doe) {
    var b = maak('button', 'ds-knop ds-knop--breed ' + klasse); b.type = 'button';
    b.appendChild(maak('span', '', tekst)); if (doe) b.addEventListener('click', doe); return b;
  }
  function voorleesKnop(rit) {
    return knop('ds-knop--stil ds-knop--klein', 'WORDT VOORGELEZEN', function () { spreekRit(rit, true); });
  }
  function kaartMet(soort) {
    var kaart = maak('article', 'ds-kaart'); kaart.setAttribute('data-rit', soort);
    var binnen = maak('div', 'ds-kaart__inhoud'); kaart.appendChild(binnen); return { kaart: kaart, binnen: binnen };
  }

  function tekenAanvraag(rit) {
    var k = kaartMet('nieuw'), b = k.binnen;
    b.appendChild(maak('p', 'ds-label', 'NIEUWE RITAANVRAAG'));
    b.appendChild(maak('p', 'ds-meta', geleden(rit.gemaakt)));
    b.appendChild(routeRegel(rit)); b.appendChild(ritFeiten(rit)); b.appendChild(voorleesKnop(rit));
    var bekijken = knop('ds-knop--primair', 'BEKIJK RIT', function () { openRitDialoog(rit); });
    bekijken.setAttribute('data-ds-actie', 'Bekijk rit'); bekijken.setAttribute('data-bekijk', '');
    b.appendChild(bekijken);
    b.appendChild(knop('ds-knop--stil', 'LAAT LOPEN', function () { laatLopen(rit); }));
    return k.kaart;
  }

  function tekenActief(rit) {
    var k = kaartMet('actief'), b = k.binnen;
    b.appendChild(maak('p', 'ds-label', 'ACTIEVE RIT · ' + rit.ref));
    b.appendChild(maak('h2', 'ds-kaart__titel', rit.reizigerCodenaam || 'RTG-reiziger'));
    var stand = maak('p', 'ds-detail__status', STATUS_NAAM[rit.status] || rit.status); stand.setAttribute('data-status', rit.status);
    b.appendChild(stand);
    b.appendChild(maak('p', 'ds-meta', plaats(rit.van, 'Vertrek') + ' → ' + plaats(rit.naar, 'Bestemming')));
    b.appendChild(ritFeiten(rit));
    /* De fase als rustige meter, met het woord erbij: een balk alleen zegt niets. */
    var fase = FASE[rit.status] || 1, LABELS = ['TOEGEWEZEN', 'ONDERWEG', 'AANGEKOMEN', 'AAN BOORD', 'KLAAR'];
    var meter = maak('progress', 'ds-voortgang'); meter.max = 5; meter.value = fase;
    meter.setAttribute('aria-label', 'Fase ' + fase + ' van 5: ' + LABELS[fase - 1]); b.appendChild(meter);
    b.appendChild(maak('p', 'ds-label', LABELS.slice(0, fase).join(' · ')));
    /* Op de luchthaven staat de ophaalzone bij het vertrekpunt. */
    if (rit.notitie) b.appendChild(maak('p', 'ds-meta', rit.notitie));
    else if (/ibiza airport/i.test(plaats(rit.van))) b.appendChild(maak('p', 'ds-meta', 'Volg de officiële ophaalzone in de ritinformatie.'));
    if (['aangekomen', 'ingestapt', 'rijdt'].includes(rit.status)) {
      var passagier = maak('ul', 'ds-detail__gegevens'); passagier.setAttribute('data-passagier', '');
      var n = rit.reizigers || 1;
      passagier.appendChild(lijstRij('PASSAGIER', rit.reizigerCodenaam || 'RTG-reiziger', n + ' reiziger' + (n === 1 ? '' : 's') + ' · ' + (rit.bagage || 0) + ' bagage'));
      if (rit.ophaalcode) passagier.appendChild(lijstRij('OPHAALCODE', String(rit.ophaalcode), ''));
      b.appendChild(passagier);
    }
    var volgende = STATUS[rit.status];
    if (volgende) {
      var actie = knop('ds-knop--primair', volgende[1]);
      actie.setAttribute('data-volgende', volgende[0]); actie.setAttribute('data-ds-actie', volgende[1]);
      actie.addEventListener('click', function () { zetRitStatus(rit, volgende[0], actie); }); b.appendChild(actie);
    } else {
      b.appendChild(maak('p', 'ds-lijst__titel', 'Rit veilig vastgelegd'));
      b.appendChild(maak('p', 'ds-meta', 'De centrale handelt de financiële afronding af.'));
    }
    return k.kaart;
  }
  /* Een gegeven: het label klein ervoor, de waarde erachter (ds-detail__gegeven). */
  function lijstRij(label, titel, tekst) {
    var li = maak('li', 'ds-detail__gegeven'); li.appendChild(maak('span', 'ds-label', label));
    var t = maak('span'); t.appendChild(maak('strong', '', titel));
    if (tekst) t.appendChild(maak('span', 'ds-lijst__tekst', tekst));
    li.appendChild(t); return li;
  }

  function statusVak(soort, label, titel, tekst) {
    var s = maak('section', 'ds-status ds-status--binnen'); s.setAttribute('data-rit', soort);
    if (label) s.appendChild(maak('p', 'ds-label', label));
    s.appendChild(maak('h2', 'ds-status__titel', titel)); s.appendChild(maak('p', 'ds-status__tekst', tekst));
    return s;
  }
  function tekenLeeg() {
    return statusVak('leeg', 'RTG MOBILITY', 'Geen open aanvragen',
      staat.demo ? 'Gebruik Hulp om een nieuwe ritaanvraag te simuleren.' : 'Nieuwe aanvragen van uw vervoerder verschijnen hier automatisch.');
  }
  function tekenFout() {
    var aanmelden = staat.foutsoort === 'aanmelden';
    var kaart = statusVak('fout', aanmelden ? 'AANMELDEN NODIG' : 'VERBINDING NODIG',
      aanmelden ? 'U bent niet aangemeld als chauffeur' : 'Ritten konden niet worden geladen',
      staat.fout || 'Controleer uw verbinding en probeer opnieuw.');
    /* Een knop die niets kan doen, hoort er niet te staan: opnieuw proberen
       lost een ontbrekende aanmelding nooit op. */
    if (aanmelden) {
      var a = maak('a', 'ds-knop ds-knop--primair ds-status__actie', 'NAAR DE PERSONEELSLOGIN'); a.href = '/apps/leverancier.html';
      kaart.appendChild(a);
    } else {
      var b = maak('button', 'ds-knop ds-knop--primair ds-status__actie', 'PROBEER OPNIEUW'); b.type = 'button';
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
    $('#vandaagDatum').textContent = new Date().toLocaleDateString(taal(), { weekday: 'long', day: 'numeric', month: 'long' });
    $('#cijferRitten').textContent = String(klaar.length);
    $('#cijferKm').textContent = klaar.reduce(function (n, r) { return n + (Number(r.km) || 0); }, 0).toLocaleString(taal(), { maximumFractionDigits: 1 });
    $('#cijferOmzet').textContent = geld(klaar.reduce(function (n, r) { return n + (Number(r.prijs) || 0); }, 0));
    var log = $('#ritlog'); leeg(log);
    if (!klaar.length) { log.appendChild(maak('li', 'ds-meta', 'Nog geen ritten afgerond tijdens deze dienst.')); return; }
    klaar.forEach(function (r) {
      var regel = maak('li', 'ds-lijst__rij'); regel.insertAdjacentHTML('beforeend', '<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m5 12 4 4 10-10"/></svg>');
      var tekst = maak('span'); tekst.appendChild(maak('span', 'ds-lijst__titel', ritNaam(r))); tekst.appendChild(maak('span', 'ds-lijst__tekst', r.ref)); regel.appendChild(tekst);
      regel.appendChild(maak('span', 'ds-lijst__tijd', geld(r.prijs))); log.appendChild(regel);
    });
  }

  function tekenNavigatie() {
    var rit = actieveRit(), kaart = $('#navigatiekaart'); leeg(kaart);
    var open = $('#openNavigatie'), deel = $('#deelPositie'); open.disabled = !rit; deel.disabled = !rit;
    if (!rit) {
      kaart.appendChild(maak('p', 'ds-label', 'GEEN ACTIEVE ROUTE')); kaart.appendChild(maak('h2', 'ds-titel', 'Neem eerst een rit aan.'));
      kaart.appendChild(maak('p', 'ds-meta', 'Daarna verschijnen vertrek, bestemming en de veilige locatiedeling hier.')); return;
    }
    var route = maak('ul', 'ds-detail__gegevens');
    [['OPHALEN', plaats(rit.van)], ['BESTEMMING', plaats(rit.naar)]].forEach(function (rij) { route.appendChild(lijstRij(rij[0], rij[1], '')); });
    kaart.appendChild(maak('p', 'ds-label', STATUS_NAAM[rit.status] || rit.status)); kaart.appendChild(maak('h2', 'ds-titel', minuten(rit) + ' · ' + km(rit))); kaart.appendChild(route);
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
  function tik() { var k = $('#klok'); if (k) { var nu = new Date(); k.dateTime = nu.toISOString(); k.textContent = nu.toLocaleTimeString(taal(), { hour: '2-digit', minute: '2-digit' }); } }
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
      feiten.appendChild(lijstRij(rij[0], rij[1], ''));
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
    // eerst de koppeling op teamlid (kern/mobiliteit/bestuurder.js), dan de oude naamvergelijking
    var eigen = inzetbaar.find(function (v) { return a.staffId != null && v.bestuurderStaffId === Number(a.staffId); }) ||
      inzetbaar.find(function (v) { return v.bestuurder && norm(v.bestuurder) === norm(a.name); });
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
        var toe = await api('/api/supplier/mob/toewijzen', { ref: rit.ref, assetId: voertuig.id, bevestigd: true });
        await laad();
      }
      sluitDialoog($('#ritDialoog')); toast((toe && toe.afwezigWaarschuwing) || 'Rit veilig aan u toegewezen.'); render();
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
    $$('[data-blad]').forEach(function (el) { el.hidden = el.dataset.blad !== naam; });
    $$('[data-naar]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.naar === naam)); });
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

  zetModus(); tik(); setInterval(tik, 15000); laad();
})();
