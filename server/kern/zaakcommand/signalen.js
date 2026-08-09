/* WAT ER IN DEZE ZAAK OP EEN MENS WACHT.

   Dit is de tegenhanger van ./runbooks.js. Daar staat wat de machine zélf mag
   rechtzetten (administratieve drift); hier staat wat een MENS moet beslissen:
   een boeking bevestigen, een chauffeur toewijzen, verlof toekennen, een
   gastchat beantwoorden. De machine mag dat zien, tellen en voorstellen -- doen
   mag hij het niet, en daarom is het geen runbook.

   WAAROM DIT BESTAND ER IS EN NIET ALLEEN IN HET SCHERM STAAT. Deze lijst
   bestond al, met de hand geschreven in routes/supplier/backoffice.js, als
   `alerts`. Dat werkte prima voor één scherm en werd een probleem zodra er een
   tweede lezer kwam: de commandolaag zou dan een eigen, bijna-gelijke lijst
   krijgen, en binnen een maand zeggen de twee schermen iets anders over
   dezelfde zaak. LAT.md regel 4. Dus staat hij nu één keer, hier, en leest de
   backoffice hem net zo goed als de operator.

   DE TEKST IS TWEETALIG omdat de backoffice dat is. Een signaal draagt zijn
   eigen nl- en en-zin, zodat er geen tweede vertaaltabel ontstaat.

   DE DREMPELS staan in het beleid van de zaak (zaak.*), niet hier: een
   restaurant en een jachthaven vinden niet hetzelfde "te lang". */
'use strict';

const s = (v) => (v == null ? '' : String(v));
const norm = (v) => s(v).trim().toUpperCase();
const min = (iso, nu) => Math.round((nu - new Date(iso).getTime()) / 60000);

/* Elk signaal: welk object, hoe erg, en wat de mens moet beslissen. `beslissing`
   is wat er in de uitzonderingenrij komt te staan als iemand hem oppakt -- de
   vraag, niet de opdracht. */
function maakSignalen({ db, beleid, commGast }) {
  const lijstVan = (collectie, code) => {
    const v = db.data[collectie];
    if (Array.isArray(v)) return v.filter(r => r && norm(r.supplierCode) === code);
    if (!v || typeof v !== 'object') return [];
    const sleutel = Object.keys(v).find(k => norm(k) === code);
    return Array.isArray(sleutel ? v[sleutel] : null) ? v[sleutel] : [];
  };

  /* DE HR-SIGNALEN ZIJN VOOR DE LEIDING. Een verlofaanvraag of een sollicitatie
     is geen vloerwerk; overal elders in deze app staan die achter managerOnly.
     Zonder deze grens zou de PDA van de vloer alsnog laten zien dat er verlof
     ligt te wachten -- minder erg dan de namen, maar het hoort er niet. */
  function voor(zaak, opties) {
    const leiding = !!(opties && opties.leiding);
    const code = norm(zaak && zaak.code);
    if (!code) return [];
    const nu = Date.now();
    const uit = [];
    const traag = beleid.getal('zaak.reactieMinuten', 10);
    const boekTraag = beleid.getal('zaak.boekingMinuten', 30);

    for (const o of lijstVan('orders', code)) {
      if (!o.paid || s(o.status) !== 'nieuw') continue;
      const m = min(o.paidAt || o.at, nu);
      if (m < traag) continue;
      uit.push({ id: 'bestelling-onaangeroerd:' + s(o.ref), niveau: 'rood', type: 'bestelling',
        objectId: s(o.ref), oorzaak: 'bestelling onaangeroerd',
        beslissing: 'Oppakken of weigeren?',
        nl: 'Bestelling ' + s(o.ref) + ' staat al ' + m + ' min onaangeroerd (' + s(o.customerCodename) + ').',
        en: 'Order ' + s(o.ref) + ' has been untouched for ' + m + ' min (' + s(o.customerCodename) + ').' });
    }

    for (const r of lijstVan('rides', code)) {
      if (!r.paid || s(r.status) !== 'aangevraagd' || r.driver) continue;
      const straks = r.plannedFor && (new Date(r.plannedFor) - nu) > 45 * 60000;
      if (!straks && min(r.paidAt || r.at, nu) >= traag) {
        uit.push({ id: 'rit-zonder-chauffeur:' + s(r.ref), niveau: 'rood', type: 'rit',
          objectId: s(r.ref), oorzaak: 'rit zonder chauffeur',
          beslissing: 'Welke chauffeur rijdt deze rit?',
          nl: 'Rit ' + s(r.ref) + ' wacht nog op een chauffeur.',
          en: 'Ride ' + s(r.ref) + ' is still waiting for a driver.' });
      } else if (straks && (new Date(r.plannedFor) - nu) < 24 * 3600000) {
        const wanneer = String(r.plannedFor).slice(0, 16).replace('T', ' ');
        uit.push({ id: 'rit-gepland-zonder-chauffeur:' + s(r.ref), niveau: 'amber', type: 'rit',
          objectId: s(r.ref), oorzaak: 'geplande rit zonder chauffeur',
          beslissing: 'Wie rijdt deze geplande rit?',
          nl: 'Geplande rit ' + s(r.ref) + ' (' + wanneer + ') heeft nog geen chauffeur.',
          en: 'Scheduled ride ' + s(r.ref) + ' (' + wanneer + ') has no driver yet.' });
      }
    }

    for (const b of lijstVan('boekingen', code)) {
      if (!b.paid || s(b.status) !== 'aangevraagd') continue;
      if (min(b.paidAt || b.at, nu) < boekTraag) continue;
      const naam = (b.service && b.service.name) || s(b.kind) || 'Boeking';
      uit.push({ id: 'boeking-onbevestigd:' + s(b.ref), niveau: 'amber', type: 'boeking',
        objectId: s(b.ref), oorzaak: 'boeking wacht op bevestiging',
        beslissing: 'Bevestigen of afwijzen?',
        nl: 'Boeking ' + s(b.ref) + ' (' + naam + ') wacht nog op uw bevestiging.',
        en: 'Booking ' + s(b.ref) + ' (' + naam + ') is still waiting for your confirmation.' });
    }

    const verlofN = !leiding ? 0 : lijstVan('verlof', code).filter(v => s(v.status) === 'nieuw').length;
    if (verlofN) uit.push({ id: 'verlof-open', niveau: 'amber', type: 'verlof', objectId: null,
      oorzaak: 'verlof wacht op besluit', beslissing: 'Toekennen of afwijzen?',
      nl: verlofN + ' verlofaanvraag/aanvragen wachten op uw besluit (HR & team).',
      en: verlofN + ' leave request(s) await your decision (HR & team).' });

    const sollN = !leiding ? 0 : lijstVan('applications', code).filter(a => s(a.status) === 'nieuw').length;
    if (sollN) uit.push({ id: 'sollicitatie-open', niveau: 'info', type: 'sollicitatie', objectId: null,
      oorzaak: 'sollicitatie open', beslissing: 'Uitnodigen of afwijzen?',
      nl: sollN + ' open sollicitatie(s) (HR & team).',
      en: sollN + ' open application(s) (HR & team).' });

    /* De gastchats komen niet uit db.data maar uit de communicatiekern; die
       verhuisde daarheen (kern/comm/gast.js) en heeft geen eigen collectie meer.
       Zonder deze bron zou dit signaal stil wegvallen bij het samenvoegen -- en
       een signaal dat verdwijnt zonder dat iemand het merkt, is precies wat
       samenvoegen gevaarlijk maakt. */
    const chatsN = commGast ? (commGast.voorZaak(code) || []).filter(c => c && c.unread).length : 0;
    if (chatsN) uit.push({ id: 'gastchat-open', niveau: 'amber', type: 'gastchat', objectId: null,
      oorzaak: 'gastchat wacht op antwoord', beslissing: 'Wie beantwoordt deze gasten?',
      nl: chatsN + ' gastchat(s) wachten op een antwoord.',
      en: chatsN + ' guest chat(s) waiting for a reply.' });

    const klussenN = lijstVan('tickets', code).filter(t => s(t.status) !== 'klaar').length;
    if (klussenN) uit.push({ id: 'klus-open', niveau: 'info', type: 'klus', objectId: null,
      oorzaak: 'klus open', beslissing: 'Inplannen of sluiten?',
      nl: klussenN + ' open klus(sen) of onderhoud.',
      en: klussenN + ' open job(s) or maintenance.' });

    const vuilN = (zaak.rooms || []).filter(r => r && r.hk && s(r.hk.status) === 'vuil').length;
    if (vuilN) uit.push({ id: 'kamer-vuil', niveau: 'amber', type: 'kamer', objectId: null,
      oorzaak: 'kamer nog schoon te maken', beslissing: 'Wie maakt deze kamers schoon?',
      nl: vuilN + ' kamer(s) nog schoon te maken.',
      en: vuilN + ' room(s) still to clean.' });

    const volg = { rood: 0, amber: 1, info: 2 };
    uit.sort((a, b) => volg[a.niveau] - volg[b.niveau]);
    return uit;
  }

  /* De vorm die routes/supplier/backoffice.js altijd al toonde: level + text in
     de taal van het scherm. Zo kan die route deze bron gebruiken zonder dat er
     iets aan zijn antwoord verandert. */
  const alerts = (zaak, en, opties) => voor(zaak, opties).map(x => ({ level: x.niveau, text: en ? x.en : x.nl }));

  return { voor, alerts };
}

module.exports = { maakSignalen };
