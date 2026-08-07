    API.call('/rekening', { supplierCode: code }).then(d => {
      const r = d.rekening;
      if (!r || !r.aantal) return toast(T('app.rek.leeg','Er staat geen lopende rekening open.'));
      const oud = document.getElementById('rekOverlay'); if (oud) oud.remove();
      const ov = document.createElement('div'); ov.className = 'rek-ov'; ov.id = 'rekOverlay';
      const regels = r.regels.map(o => (o.items || []).map(it =>
        '<div class="rek-reg"><span><span class="q">' + it.qty + '× </span>' + esc(it.name) + '</span><span>' + eur(it.price * it.qty) + '</span></div>').join('')).join('');
      ov.innerHTML = '<div class="rek-sheet" role="dialog" aria-modal="true" aria-label="' + T('app.rek.k','De rekening') + '">' +
        '<h3>' + T('app.rek.k','De rekening') + '</h3>' +
        '<div class="sub2" style="color:var(--soft);margin-bottom:0.6rem;">' + esc(r.supplierName) + (r.tafel ? ' · ' + esc(r.tafel) : '') + ' · ' + r.aantal + ' ' + T('app.rek.bonnen','bon(nen) lopen') + '</div>' +
        regels +
        '<div class="rek-sub"><span>' + T('app.rek.totaal','Totaal') + '</span><span>' + eur(r.subtotaal) + '</span></div>' +
        '<select class="rek-fooi" id="rekFooi" aria-label="' + T('erv.fooi','Fooi') + '">' +
          '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
          '<option value="p5">' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
          '<option value="p10">' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
          '<option value="e5">' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
          '<option value="e10">' + T('erv.fooi.team','Fooi voor het team') + ': € 10</option>' +
        '</select>' +
        '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0;">' + T('app.rek.uitleg','U rekent alle bonnen van dit bezoek in een keer af. De betaling gaat rechtstreeks naar de zaak.') + '</div>' +
        '<button class="rek-pay" id="rekBetaal">' + T('app.rek.betaal','Betaal de rekening') + '</button>' +
        '<button id="rekSluit" style="margin-top:0.5rem;width:100%;background:none;border:none;text-align:center;color:var(--soft);cursor:pointer;font-family:inherit;font-size:0.8rem;padding:0.5rem;">' + T('app.later','Later') + '</button>' +
      '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      document.getElementById('rekSluit').addEventListener('click', () => ov.remove());
      document.getElementById('rekBetaal').addEventListener('click', () => {
        const keus = document.getElementById('rekFooi').value;
        const fooi = keus === 'p5' ? Math.round(r.subtotaal * 5) / 100 : keus === 'p10' ? Math.round(r.subtotaal * 10) / 100 : keus === 'e5' ? 5 : keus === 'e10' ? 10 : 0;
        ov.remove();
        payWithFaceId(eur(r.subtotaal + fooi), async () => {
          const res = await API.call('/rekening/betaal', { supplierCode: code, fooi });
          return res.rekening;
        }, { message: () => '' + T('app.rek.voldaan','De rekening is voldaan bij') + ' ' + r.supplierName + '.' + (fooi ? '  ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
      });
    }).catch(e => toast(e.message));
  }
/* ============================== RTG OS-schil ==============================
   De leden-app als besturingssysteem. Het beginscherm is één scherm met vier
   lagen, van boven naar beneden:

     1. de mappen met apps
     2. de ronde RTG-klok, in het midden
     3. de functierij: bellen, berichten, videobellen, je wallet
     4. de balk van Rahul

   Verder is er een bedieningspaneel (thema, taal, push, helderheid,
   uitloggen), Spotlight-zoeken en herschikken met een lange druk
   (wiebel-modus, volgorde in localStorage). Geen tweede beginscherm, geen
   dock, geen App Store: alles waar je pas je recht op geeft staat er al, en
   in de Boardroom zet je uit wat je niet wilt zien.

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const rijen = [$('#osMappen'), $('#osFuncties')];
  if (!tabbar || !app || !rijen[0] || !rijen[1]) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  // Elke app kent zijn eigen huisstijl-glyf (shared/glyf.js) op naam van de
  // sleutel; de tegel tekent die als dunne lijn-icoon (geen emoji meer).
  const LINKS = {
    ontdek:      { naam: 'Ontdekken',     url: '/apps/rtg.html' },
    spelen:      { naam: 'Spelen',       url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       url: '/apps/camera.html' },
    muziek:      { naam: 'Muziek',    url: '/apps/muziek.html' },
    podium:      { naam: 'Live',       url: '/apps/podium.html' },
    flits:       { naam: 'Onderweg',        url: '/apps/flits.html' },
    navigatie:   { naam: 'Navigatie',    url: '/apps/navigatie.html' },
    theater:     { naam: 'Films en series',      url: '/apps/theater.html' },
    residentie:  { naam: 'Verblijven', url: '/apps/residentie.html' },
    wbw:         { naam: 'Samen betalen', url: '/apps/wbw.html' },
    passkeys:    { naam: 'Passkeys',     url: '/apps/passkeys.html' },
