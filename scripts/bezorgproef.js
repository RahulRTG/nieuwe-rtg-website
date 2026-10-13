#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE BEZORGPROEF -- de tweede horecaketen: van een bestelling thuis tot de
   deur, als verhaal over actoren heen.

   WAAR DIT UIT KOMT. De tafelproef (scripts/tafelproef.js) zegt in zijn eigen
   grens: "alleen de tafel-keten; bezorging, hotel en club hebben eigen naden".
   Deze proef loopt de eerste van die drie. Hij is met opzet GEEN kopie van de
   tafel: de bezorgbestelling woont niet op een horecarekening maar in de
   bestellingen (`db.data.orders`), wordt vooraf betaald in plaats van na het
   eten, en heeft actoren die aan tafel niet bestaan -- een inpakker, een
   bezorger op eigen naam, en een lid dat thuis zit en alleen het volgscherm
   heeft. Dat verschil is de reden om hem te lopen: een keten die hetzelfde deelt
   als de tafel meet hetzelfde nog een keer.

   WAT HIJ MEET, zelfde vorm als de tafelproef:
     per SCHAKEL   handelt actor A, en ZIET actor B dat vervolgens?
     per STORING   houdt de keten zich aan wat hij belooft als het misgaat?

   WAT HIJ NIET MEET (en dat staat in de uitslag onder `grens`):
     - er wordt niet echt betaald: /api/order/pay loopt in de testomgeving
       langs de demo-provider, dus dit zegt niets over geld dat aankomt;
     - geen browser: het volgscherm en de bezorger-PDA zelf zijn niet beproefd;
     - de bezorgzones en tijdsloten (kern/horeca/bezorglaag.js) zijn een
       andere laag die de ledenbestelling vandaag NIET raadpleegt -- dat is een
       naad en geen schakel, en hij staat hieronder als bevinding.

   Draaien:  npm run bezorgproef        (print, zakt op een open schakel)
             node scripts/bezorgproef.js --json
   ============================================================================ */
const { start } = require('./lib/wegwerpserver');
const { stempel: huisStempel } = require('./lib/stempel');

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

function schakel(nr, van, naar, wat, opts) {
  return Object.assign({ nr, van, naar, wat }, opts);
}

/* De actoren. De zaak is de demozaak met twee mensen op een persoonlijke
   inlog: de manager pakt in en zet het assortiment, de bediening rijdt. Een
   rit staat op NAAM (staffId), dus de bezorger moet een eigen inlog hebben --
   met het zaakaccount is er niemand om de rit op te zetten. */
async function actoren(P) {
  const sup = await P('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const code = sup.data && sup.data.state && sup.data.state.supplier && sup.data.state.supplier.code;
  if (!code) throw new Error('geen zaaksessie (status ' + sup.status + ') -- dan meet deze proef zichzelf');
  const ploeg = (await P('/api/supplier/roster', { code })).data;
  const mgr = ploeg && ploeg.staff && ploeg.staff.find((x) => x.role === 'manager');
  const vloer = ploeg && ploeg.staff && ploeg.staff.find((x) => mgr && x.id !== mgr.id);
  if (!mgr || !vloer) throw new Error('de demozaak heeft geen twee mensen om in te pakken en te rijden');
  const inpakker = (await P('/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).data;
  const bezorger = (await P('/api/supplier/login', { code, staffId: vloer.id, pin: '5678' })).data;
  const lid = (await P('/api/login', { tier: 'rtg' })).data;
  const ander = (await P('/api/login', { tier: 'lifestyle' })).data;
  if (!inpakker || !inpakker.token || !bezorger || !bezorger.token) throw new Error('geen persoonlijke inlog voor inpakker en bezorger');
  if (!lid || !lid.token || !ander || !ander.token) throw new Error('geen lidsessies -- draait de server in de testomgeving?');
  /* Een DERDE collega, geen manager en niet de bezorger: alleen met hem is
     "alleen de eigen rit" te beproeven -- de manager mag het juist wel. */
  const nieuw = (await P('/api/supplier/staff/add', { name: 'Collega Proef' }, inpakker.token)).data;
  const collega = nieuw && nieuw.staff ? (await P('/api/supplier/login', { code, staffId: nieuw.staff.id, pin: nieuw.pin })).data : null;
  return { code, I: inpakker.token, B: bezorger.token, C: collega && collega.token, bezorgerNaam: vloer.name, M: lid.token, A: ander.token };
}

async function bestelling(P, wie) {
  const parts = await P('/api/bezorg/partners', {}, wie.M);
  const zaak = ((parts.data && parts.data.partners) || []).find((p) => p.code === wie.code);
  /* Zonder de zaak in de lijst is er niets te bestellen: zelfde regel als
     hieronder, de proef stopt met de reden (en niet met een TypeError). */
  if (!zaak) throw new Error('de zaak ' + wie.code + ' staat niet in de bezorglijst (' + parts.status + ')');
  const b = await P('/api/bezorg/bestel', { supplierCode: wie.code, levering: 'bezorgen',
    adres: 'Keizersgracht 1', lat: 52.37, lng: 4.89, items: [{ id: zaak.producten[0].id, qty: 2 }] }, wie.M);
  const ref = b.data && b.data.order && b.data.order.ref;
  /* Zonder bestelling slaagt een storing LEEG: een neem op niets geeft ook 409
     en een volg op niets ook 404. Dus geen bestelling = de proef stopt. */
  if (!ref) throw new Error('de bestelling kwam er niet (' + b.status + '): ' + JSON.stringify(b.data));
  return { zaak, b, ref, items: b.data.order.items };
}

const volg = (P, wie, ref, tok) => P('/api/bezorg/volg', { ref }, tok || wie.M);
const lopendBij = async (P, tok, ref) => {
  const o = await P('/api/supplier/bezorg/overzicht', {}, tok);
  return ((o.data && o.data.lopend) || []).find((x) => x.ref === ref) || null;
};

async function loop(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        uit.schakels.push(Object.assign({}, s, { stand: 'stuk', status: r ? r.status : 0,
          antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    const stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };

  const wie = await actoren(P);
  uit.zaak = wie.code;

  /* 1 -- de zaak zet een bezorgassortiment en de dienst aan. Ontvanger: het
     lid, dat de zaak pas in de lijst ziet als er iets te bestellen is. */
  await P('/api/supplier/bezorg/product', { name: 'Paella voor thuis', price: 18.5 }, wie.I);
  await stap(
    schakel(1, 'zaak', 'lid', 'zet de bezorgdienst aan, en het lid vindt de zaak'),
    () => P('/api/supplier/bezorg/instellingen', { aan: true, bezorgen: true }, wie.I),
    async () => {
      const p = await P('/api/bezorg/partners', {}, wie.M);
      const z = ((p.data && p.data.partners) || []).find((x) => x.code === wie.code);
      return { klopt: !!z && z.bezorgen === true && z.producten.length > 0,
        wat: z ? 'het lid ziet ' + z.name + ' met ' + z.producten.length + ' product(en)' : 'de zaak staat niet in de lijst' };
    });

  /* 2 -- het lid bestelt en betaalt. Ontvanger: de zaak. Betalen is VOORAF
     (kopen/bezorg.js): pas na de betaling hoort de zaak ervan, en dat is de
     helft die storing 1 bewaakt. */
  const best = await bestelling(P, wie);
  const ref = best.ref;
  uit.ref = ref || null;
  await stap(
    schakel(2, 'lid', 'zaak', 'bestelt en betaalt vooraf, en de bestelling staat bij de zaak'),
    () => P('/api/order/pay', { ref }, wie.M),
    async () => {
      const o = await lopendBij(P, wie.I, ref);
      return { klopt: !!o && o.paid === true && o.levering === 'bezorgen',
        wat: o ? 'de zaak ziet ' + o.ref + ' (' + o.status + ', betaald: ' + o.paid + ')' : 'de zaak ziet niets' };
    });
  if (!ref) return uit;

  /* 3 -- de keuken zet de bestelling in bereiding. Ontvanger: het lid, op zijn
     volgscherm (kern/bezorgvolg.js), niet alleen in een melding. */
  await stap(
    schakel(3, 'keuken', 'lid', 'zet de bestelling in bereiding, en het lid ziet dat op het volgscherm'),
    () => P('/api/supplier/order/status', { ref, status: 'in bereiding' }, wie.I),
    async () => {
      const v = await volg(P, wie, ref);
      return { klopt: v.status === 200 && v.data.order && v.data.order.status === 'in bereiding',
        wat: 'volgscherm: ' + (v.data && v.data.order && v.data.order.status) };
    });

  /* 4 -- de inpakker pakt in, met het bonnummer en elke regel afgevinkt.
     Ontvanger: de bezorger, die op zijn eigen overzicht ziet dat de tas klaar
     staat (en in welke). */
  await stap(
    schakel(4, 'inpakker', 'bezorger', 'pakt alles in op het juiste bonnummer, en de bezorger ziet de tas'),
    () => P('/api/supplier/bezorg/inpak', { ref, bon: ref, tas: 'tas 3', items: (best.items || []).map((i) => i.id) }, wie.I),
    async () => {
      const o = await lopendBij(P, wie.B, ref);
      return { klopt: !!o && !!o.inpak && o.inpak.tas === 'tas 3',
        wat: o && o.inpak ? 'de bezorger ziet ' + o.inpak.tas + ', ingepakt door ' + o.inpak.door : 'geen inpak zichtbaar' };
    });

  /* 5 -- de bezorger neemt de rit op eigen naam. Ontvanger: het lid, dat ziet
     WIE er komt -- net als bij een rit stap je hier met een mens in contact. */
  await stap(
    schakel(5, 'bezorger', 'lid', 'neemt de levering aan op eigen naam, en het lid ziet wie er komt'),
    () => P('/api/supplier/bezorg/neem', { ref }, wie.B),
    async () => {
      const v = await volg(P, wie, ref);
      const naam = v.data && v.data.bezorger && v.data.bezorger.name;
      return { klopt: naam === wie.bezorgerNaam, wat: 'het lid ziet bezorger ' + naam };
    });

  /* 6 -- de bezorger vinkt af dat hij alles heeft, en vertrekt. Ontvanger: het
     lid. Vertrekken kan pas na inpak EN pakcheck (storing 2 bewaakt dat). */
  await P('/api/supplier/bezorg/pakcheck', { ref }, wie.B);
  await stap(
    schakel(6, 'bezorger', 'lid', 'vinkt af dat alles gepakt is en vertrekt, en het lid ziet "onderweg"'),
    () => P('/api/supplier/bezorg/status', { ref, status: 'onderweg' }, wie.B),
    async () => {
      const v = await volg(P, wie, ref);
      return { klopt: v.data && v.data.order && v.data.order.status === 'onderweg',
        wat: 'volgscherm: ' + (v.data && v.data.order && v.data.order.status) };
    });

  /* 7 -- de positie van de bezorger. Ontvanger: het lid, en ALLEEN zolang de
     rit onderweg is (schakel 9 meet de andere helft). */
  await stap(
    schakel(7, 'bezorger', 'lid', 'deelt zijn positie onderweg, en het lid ziet waar de bestelling is'),
    () => P('/api/supplier/bezorg/gps', { lat: 52.36, lng: 4.88 }, wie.B),
    async () => {
      const v = await volg(P, wie, ref);
      const pos = v.data && v.data.positie;
      return { klopt: !!pos && pos.lat === 52.36, wat: pos ? 'positie ' + pos.lat + ',' + pos.lng : 'geen positie' };
    });

  /* 8 -- bezorgd. Ontvanger: het lid, op het volgscherm EN in zijn meldingen
     (een persoonlijk bericht hoort op de sleutel van het lid, opzet/meldaan.js). */
  const meldVoor = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
  await stap(
    schakel(8, 'bezorger', 'lid', 'meldt bezorgd, en het lid ziet het op het volgscherm en in zijn meldingen'),
    () => P('/api/supplier/bezorg/status', { ref, status: 'bezorgd' }, wie.B),
    async () => {
      const v = await volg(P, wie, ref);
      const meld = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
      const nieuw = meld.length - meldVoor.length;
      const st = v.data && v.data.order && v.data.order.status;
      return { klopt: st === 'bezorgd' && nieuw === 1 && /bezorgd/i.test(String(meld[0] && meld[0].body)),
        wat: 'volgscherm: ' + st + '; meldingen ' + meldVoor.length + ' -> ' + meld.length };
    });

  /* 9 -- na de rit blijft er geen positie over. Ontvanger: het lid, en de
     belofte is privacy (NAVIGATIE.md N20): het adres blijft bij de bestelling,
     de coördinaat en de positie van de bezorger niet. */
  await stap(
    schakel(9, 'bezorger', 'lid', 'na de rit staat er geen positie of bezorgpunt meer bij de bestelling'),
    async () => volg(P, wie, ref),
    async (v) => ({ klopt: v.data.positie === null && v.data.order.geo === null && !!v.data.order.adres,
      wat: 'positie ' + JSON.stringify(v.data.positie) + ', bezorgpunt ' + JSON.stringify(v.data.order.geo) +
        ', adres ' + (v.data.order.adres ? 'staat er' : 'weg') }));

  /* 10 -- de zaak telt hem bij vandaag. Ontvanger: de zaak zelf (de dagstaat). */
  await stap(
    schakel(10, 'bezorger', 'zaak', 'de bezorgde levering telt bij de dagstaat van de zaak'),
    () => P('/api/supplier/bezorg/overzicht', {}, wie.I),
    async (r) => ({ klopt: r.data.vandaag && r.data.vandaag.aantal === 1 && !(r.data.lopend || []).some((o) => o.ref === ref),
      wat: 'vandaag ' + (r.data.vandaag && r.data.vandaag.aantal) + ' bezorgd, nog lopend: ' +
        (r.data.lopend || []).some((o) => o.ref === ref) }));

  return uit;
}

/* ---- DE STORINGEN. ---- */
async function storingen(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const wie = await actoren(P);
  const noteer = (naam, belofte, gehouden, wat) =>
    uit.storingen.push({ naam, belofte, stand: gehouden ? 'gehouden' : 'gebroken', wat });

  /* 1. EEN ONBETAALDE BESTELLING BESTAAT NIET VOOR DE ZAAK. Vooraf betalen is
     de afspraak; een zaak die een onbetaalde bezorging ziet, gaat koken voor
     iemand die nooit betaalt. */
  const onbetaald = await bestelling(P, wie);   // gooit als hij er niet komt
  const zietHem = !!(await lopendBij(P, wie.I, onbetaald.ref));
  const neem = await P('/api/supplier/bezorg/neem', { ref: onbetaald.ref }, wie.B);
  noteer('een onbetaalde bezorging', 'staat niet bij de zaak en kan niet worden aangenomen',
    !zietHem && neem.status === 409, 'zichtbaar: ' + zietHem + ', aannemen gaf ' + neem.status);

  // de rest loopt op een betaalde bestelling
  const best = await bestelling(P, wie);
  const ref = best.ref;
  await P('/api/order/pay', { ref }, wie.M);

  /* 2. VERTREKKEN ZONDER INPAKKEN. Langs BEIDE wegen, want order/status kent de
     bezorgstand ook en een poort op één weg is een poort met een achterdeur. */
  await P('/api/supplier/bezorg/neem', { ref }, wie.B);
  const weg1 = await P('/api/supplier/bezorg/status', { ref, status: 'onderweg' }, wie.B);
  const weg2 = await P('/api/supplier/order/status', { ref, status: 'onderweg' }, wie.I);
  noteer('vertrekken voordat er is ingepakt en afgevinkt', 'weigert langs beide wegen, met wat er eerst moet',
    weg1.status === 409 && weg2.status === 409 && /inpakker/.test(String(weg1.data && weg1.data.error)),
    'bezorg/status ' + weg1.status + ', order/status ' + weg2.status);

  /* 3. EEN VERKEERD BONNUMMER. */
  const fout = await P('/api/supplier/bezorg/inpak', { ref, bon: 'RTG-B-000000', tas: 'tas 1', items: best.items.map((i) => i.id) }, wie.I);
  noteer('inpakken op een verkeerd bonnummer', 'weigert, zodat een tas niet bij de verkeerde bestelling belandt',
    fout.status === 400, 'status ' + fout.status + ': ' + (fout.data && fout.data.error));

  /* 4. BEZORGD ZONDER OOIT TE ZIJN VERTROKKEN. Een eindstand die je kunt zetten
     terwijl de tas nog in de keuken staat, laat het lid "Eet smakelijk!" lezen
     voor eten dat nooit de deur uit ging. Ook hier langs BEIDE wegen. */
  const sprong1 = await P('/api/supplier/bezorg/status', { ref, status: 'bezorgd' }, wie.B);
  const sprong2 = await P('/api/supplier/order/status', { ref, status: 'bezorgd' }, wie.I);
  const na4 = await volg(P, wie, ref);
  noteer('bezorgd melden voordat de levering onderweg was', 'weigert langs beide wegen en het lid ziet niets veranderen',
    sprong1.status === 409 && sprong2.status === 409 && na4.data && na4.data.order && na4.data.order.status !== 'bezorgd',
    'bezorg/status ' + sprong1.status + ', order/status ' + sprong2.status + ', volgscherm ' +
      (na4.data && na4.data.order && na4.data.order.status));

  /* 5. EEN ANDER LID VOLGT DE BESTELLING. Het volgscherm draagt een adres en,
     onderweg, de positie van een mens. */
  const vreemd = await volg(P, wie, ref, wie.A);
  noteer('een ander lid vraagt het volgscherm op', 'krijgt niets: geen adres, geen bezorger, geen positie',
    vreemd.status === 404 && !(vreemd.data && vreemd.data.order), 'status ' + vreemd.status);

  /* 6. TWEE KEER AANNEMEN. */
  const twee = await P('/api/supplier/bezorg/neem', { ref }, wie.I);
  noteer('een tweede medewerker neemt een rit die al op naam staat', 'weigert; een rit heeft een bezorger',
    twee.status === 409, 'status ' + twee.status);

  /* 7. EEN COLLEGA ZET ANDERMANS RIT OP BEZORGD. Alleen de eigen rit, tenzij
     manager (bezorg.js). Eerst inpakken en vertrekken. */
  await P('/api/supplier/bezorg/inpak', { ref, bon: ref, tas: 'tas 1', items: best.items.map((i) => i.id) }, wie.I);
  await P('/api/supplier/bezorg/pakcheck', { ref }, wie.B);
  await P('/api/supplier/bezorg/status', { ref, status: 'onderweg' }, wie.B);
  const doorCollega = wie.C ? await P('/api/supplier/bezorg/status', { ref, status: 'bezorgd' }, wie.C) : { status: 0 };
  const na7 = await volg(P, wie, ref);
  noteer('een collega zonder managerrol meldt andermans rit als bezorgd', 'verandert niets; de rit blijft van de bezorger',
    !!wie.C && doorCollega.status === 404 && na7.data.order.status === 'onderweg',
    'collega kreeg ' + doorCollega.status + ', volgscherm ' + (na7.data && na7.data.order && na7.data.order.status));

  /* 8. DEZELFDE EINDSTAND TWEE KEER. Een tweede druk op "bezorgd" (een PDA die
     het antwoord niet kreeg en opnieuw stuurt) hoort geen tweede bericht aan het
     lid op te leveren. */
  const meldVoor = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
  const eerst = await P('/api/supplier/bezorg/status', { ref, status: 'bezorgd' }, wie.B);
  const nogeens = await P('/api/supplier/bezorg/status', { ref, status: 'bezorgd' }, wie.B);
  const meldNa = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
  noteer('bezorgd twee keer melden', 'het lid krijgt een bericht, niet twee',
    eerst.status === 200 && nogeens.status === 200 && meldNa.length - meldVoor.length === 1,
    'eerste ' + eerst.status + ', tweede ' + nogeens.status + '; meldingen ' + meldVoor.length + ' -> ' + meldNa.length);

  /* 9. EEN BEZORGDE LEVERING TERUGZETTEN EN OPNIEUW LATEN VERTREKKEN. Langs
     order/status kon een eindstand weer `klaar` worden; dan vertrok hij nog
     eens en las het lid twee keer "bezorgd". */
  const terug = await P('/api/supplier/order/status', { ref, status: 'klaar' }, wie.I);
  const na9 = await volg(P, wie, ref);
  noteer('een bezorgde levering terugzetten', 'weigert: een eindstand is geen vertrekpunt',
    terug.status === 409 && na9.data.order.status === 'bezorgd', 'order/status gaf ' + terug.status +
      ', volgscherm ' + (na9.data && na9.data.order && na9.data.order.status));

  /* 10. DEZELFDE STAND TWEE KEER LANGS order/status -- de keukenweg, die het lid
     "Uw bestelling is nu: klaar." stuurt. */
  const k = await bestelling(P, wie);
  await P('/api/order/pay', { ref: k.ref }, wie.M);
  const kv = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
  const k1 = await P('/api/supplier/order/status', { ref: k.ref, status: 'klaar' }, wie.I);
  const k2 = await P('/api/supplier/order/status', { ref: k.ref, status: 'klaar' }, wie.I);
  const kn = ((await P('/api/notifications', {}, wie.M)).data || {}).notifications || [];
  noteer('de keuken zet dezelfde stand twee keer', 'het lid krijgt een bericht, niet twee',
    k1.status === 200 && k2.status === 200 && kn.length - kv.length === 1,
    'eerste ' + k1.status + ', tweede ' + k2.status + '; meldingen ' + kv.length + ' -> ' + kn.length);

  /* 11. EEN RIT MET TWEE LEVERINGEN WAARVAN ER EEN NIET MAG. Vertrekken gaat
     per rit; mag een van de twee niet, dan vertrekt er geen van beide -- anders
     krijgt het ene lid "onderweg" terwijl de PDA een fout ziet en de route niet
     start. */
  const r1 = await bestelling(P, wie), r2 = await bestelling(P, wie);
  for (const x of [r1, r2]) {
    await P('/api/order/pay', { ref: x.ref }, wie.M);
    await P('/api/supplier/bezorg/neem', { ref: x.ref }, wie.B);
  }
  await P('/api/supplier/bezorg/inpak', { ref: r1.ref, bon: r1.ref, tas: 'tas 4', items: r1.items.map((i) => i.id) }, wie.I);
  await P('/api/supplier/bezorg/pakcheck', { ref: r1.ref }, wie.B);
  const half = await P('/api/supplier/bezorg/status', { refs: [r1.ref, r2.ref], status: 'onderweg' }, wie.B);
  const v1 = await volg(P, wie, r1.ref);
  noteer('een rit vertrekt met een levering die nog niet is ingepakt', 'weigert de hele rit: geen half vertrek',
    half.status === 409 && v1.data.order.status !== 'onderweg',
    'status ' + half.status + ', de ingepakte levering staat op ' + (v1.data && v1.data.order && v1.data.order.status));

  return uit;
}

async function meet() {
  const uit = {
    stempel: huisStempel(),
    uitleg: 'De tweede horecaketen: een bezorging van bestelling tot de deur, gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING. De tafelproef noemt bezorging als eigen naad; dit is die naad.',
    grens: 'Er wordt niet echt betaald (demo-provider in de testomgeving). Er komt geen browser aan te pas. De bezorgzones en tijdsloten (kern/horeca/bezorglaag.js) worden door de ledenbestelling niet geraadpleegd; dat is een bekende naad en geen schakel in deze proef.',
    schakels: [], storingen: []
  };
  const srv = await start({ naam: 'bezorgproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  try {
    await loop(srv.basis, uit);
    await storingen(srv.basis, uit);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 10 && t.storingen >= 11;
  return uit;
}

function druk(u) {
  console.log('bezorgproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' + u.telling.storingen + ' storingen (' +
    u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(18) +
      s.stand.padEnd(9) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.' : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluit ? 0 : 1; return; }
    druk(u);
    process.exit(u.sluit ? 0 : 1);
  }).catch(e => { console.error('de bezorgproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
