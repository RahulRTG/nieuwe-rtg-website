#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE VOORRAADPROEF -- de eerste keten TUSSEN twee zaken.

   WAAROM DEZE ALS EERSTE CIVILIS-SCHAKEL. Alle ketens die tot nu toe sluiten
   lopen tussen een lid en een zaak (tafel, rit, omzet) of tussen een
   aanvrager en het kantoor (toelating, zaak-live). CIVILIS.md par. 4 vraagt
   samenwerking TUSSEN organisaties via expliciete gebeurtenissen, en de
   kleinste echte vorm daarvan staat al in de code: een restaurant dat
   inkoopt bij een groothandel. Die keten stond in ONDERNEMERBEWIJS.json als
   `voorraad-ontvangst`, met als gat: "de B2B-kant is nooit als keten gelopen".

   DE KETEN, EN WIE WAT HOORT TE ZIEN:

     1 zaak        -> zaak         een keukenartikel zakt onder zijn minimum
                                   en staat in het inkoopadvies
     2 ondernemer  -> ondernemer   het ondernemingsbeeld telt het als laag
     3 zaak        -> groothandel  het advies wordt een bestelling; hij staat
                                   bij de groothandel als inkomend
     4-5 groothandel -> zaak       bevestigd, onderweg: de zaak leest de stand
     6 groothandel -> zaak         geleverd: de KEUKENVOORRAAD van de zaak is
                                   aangevuld met precies wat er geleverd is,
                                   tegen de inkoopprijs als nieuwe kostprijs
     7 ondernemer  -> ondernemer   het artikel is niet meer laag
     8 groothandel -> groothandel  zijn eigen voorraad is afgeboekt en de
                                   omzet telt de levering

   DE WERELD. Een groothandel uit de seed (MERCABIZA) en twee restaurants die
   langs de ECHTE toelatingsweg zijn opgezet -- dezelfde weg als
   scripts/omzetproef.js, en om dezelfde reden: een zaak die met een truc in de
   database wordt gezet, bewijst de keten tegen een toestand die in productie
   niet bestaat. De tweede zaak is er voor de tenant-naad.

   GEEN GEDEELDE MODULE MET DE ANDERE PROEVEN. Besluit, geen slordigheid:
   scripts/ketenvorm.js telt achteraf wat de ketens werkelijk delen, en dat
   telwerk is waardeloos zodra ze uit dezelfde mal komen.

   WAT DEZE PROEF NIET MEET: er komt geen browser aan te pas, er gaat geen geld
   over (de groothandelsbestelling kent vandaag geen betaling en geen factuur
   -- dat is de keten `factuur-grootboek`, en die blijft open), en hij kijkt
   alleen naar de keukenvoorraad. Retail-, oogst- en groothandelsvoorraad aan
   de KOPERSkant hebben eigen naden.

   Draaien:  npm run voorraadproef        (print, zakt op een open schakel)
             npm run voorraadproef:vast   (schrijft VOORRAADPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { stempel: huisStempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'VOORRAADPROEF.json');
const GROOTHANDEL = 'MERCABIZA';     // de groothandel uit de seed
const GENRE = 'restaurant';
const KEURDER = { email: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
                  wachtwoord: process.env.DEMO_PASS || 'Imran' };

/* HET ARTIKEL, EN WAAROM HET NIET PRECIES ZO HEET ALS HET PRODUCT. De keuken
   noemt het "Tomaten", de groothandel verkoopt "Trostomaten". Dat is geen
   opgezette val: het inkoopadvies koppelt al bewust op een DEEL van de naam
   (routes/supplier/keuken.js, bestel-advies), juist omdat een keuken en een
   groothandel hun waren nooit hetzelfde noemen. De vraag van schakel 6 is of
   de ontvangst die koppeling ONTHOUDT. */
const ARTIKEL = { naam: 'Tomaten', eenheid: 'kg', aantal: 2, min: 5, kostprijs: 2 };
const PRODUCT = 'Trostomaten';

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}
const schakel = (nr, van, naar, wat, bekend) => ({ nr, van, naar, wat, bekend: bekend || null });

/* Wat de zaak en de groothandel van zichzelf lezen. Eén keer hier, want
   anders staat dezelfde vorm in elke schakel. */
async function keukenArtikel(basis, S, naam) {
  const k = await post(basis, '/api/supplier/keuken', {}, S);
  return ((k.data && k.data.artikelen) || []).find(a => a.naam === naam) || null;
}
async function product(basis, G, naam) {
  const o = await post(basis, '/api/supplier/groothandel/overzicht', {}, G);
  return ((o.data && o.data.producten) || []).find(p => p.naam === naam) || null;
}
async function mijnOrder(basis, S, ref) {
  const m = await post(basis, '/api/supplier/inkoop/mijn', {}, S);
  return ((m.data && m.data.bestellingen) || []).find(o => o.ref === ref) || null;
}
async function laagInBeeld(basis, z, naam) {
  const v = await post(basis, '/api/onderneming/voorraad', { id: z.onderneming }, z.L);
  const beeld = v.data && v.data.voorraad;
  const keuken = beeld && (beeld.delen || []).find(d => d.bron === 'keuken');
  return { beeld, keuken, laag: !!(keuken && (keuken.laagRijen || []).some(r => r.naam === naam)) };
}

/* De wereld: een groothandel en twee restaurants met elk een eigen
   ondernemer. Faalt hier iets, dan kan de proef niet draaien -- een storing van
   het instrument en geen uitslag over de keten. */
async function wereld(basis, merk) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const pw = 'ProefWachtwoord1';
  const keur = await P('/api/auth/login', { login: KEURDER.email, password: KEURDER.wachtwoord });
  const K = keur.data && keur.data.token;
  if (!K) throw new Error('geen keurderssessie -- bestaat het demo-eigenaarsaccount?');

  const zaakOp = async (naam, mail) => {
    const reg = await P('/api/auth/register', { name: naam, email: mail, password: pw, geboortedatum: '1980-06-01' });
    const tok = reg.data && reg.data.token;
    if (!tok) throw new Error('geen ondernemerssessie voor ' + naam + ' (status ' + reg.status + ')');
    const aan = await P('/api/aanmelding/aanvraag', { pas: 'business', naam, contact: mail,
      viaUitnodiging: true, bedrijf: { naam: naam + ' ' + merk, type: GENRE, plaats: 'Amsterdam' } }, tok);
    const id = aan.data && aan.data.aanmelding && aan.data.aanmelding.id;
    if (!id) throw new Error('geen aanmelding voor ' + naam + ' (status ' + aan.status + ')');
    await P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 5000 }, K);
    const t = await P('/api/aanmelding/termijn-voldaan', { id, maand: 1 }, K);
    const code = t.data && t.data.zaak && t.data.zaak.code;
    if (!code) throw new Error('de zaak van ' + naam + ' is niet klaargezet (status ' + t.status + ')');
    const inl = await P('/api/supplier/mijn/login', { login: mail, password: pw, bedrijf: code });
    const S = inl.data && inl.data.token;
    if (!S) throw new Error('geen zaaksessie voor ' + naam + ' (status ' + inl.status + ')');
    /* De onderneming van de ondernemer, langs de weg die hij zelf loopt:
       aanmaken en de zaak aanwijzen (kern/onderneming/levensloop.js). De
       toelatingsweg maakt er zelf geen aan -- zonder deze koppeling ziet het
       ondernemingsbeeld de keuken niet en meten schakel 2 en 7 de opstelling
       in plaats van de keten. */
    const nieuw = await P('/api/onderneming/nieuw', { naam }, tok);
    const oid = nieuw.data && nieuw.data.onderneming && nieuw.data.onderneming.id;
    const kop = await P('/api/onderneming/koppel', { id: oid, code }, tok);
    if (kop.status !== 200) throw new Error('de onderneming van ' + naam + ' is niet aan zaak ' + code + ' te koppelen (status ' + kop.status + '): ' + JSON.stringify(kop.data).slice(0, 300));
    return { code, S, L: tok, onderneming: oid };
  };
  const A = await zaakOp('Voorraadzaak A', 'voorraada+' + merk + '@rtg.test');
  const B = await zaakOp('Voorraadzaak B', 'voorraadb+' + merk + '@rtg.test');

  const gh = await P('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const G = gh.data && gh.data.token;
  if (!G) throw new Error('geen groothandelssessie (status ' + gh.status + ') -- draait de server met DEMO_SUPPLIER=' + GROOTHANDEL + '?');
  const zelf = await P('/api/supplier/groothandel/overzicht', {}, G);
  if (zelf.status !== 200) throw new Error('de demo-zaak is geen groothandel (status ' + zelf.status + ')');

  /* Het keukenartikel, langs de route waarmee een zaak het zelf aanmaakt. */
  for (const z of [A, B]) {
    const a = await P('/api/supplier/voorraad/zet', ARTIKEL, z.S);
    if (a.status !== 200) throw new Error('geen keukenartikel aan te maken (status ' + a.status + ')');
  }
  return { K, A, B, G };
}

async function loop(basis, uit, w) {
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
    let stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    if (stand === 'open' && s.bekend) stand = 'openBekend';
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };
  const { A, G } = w;
  const voorProduct = await product(basis, G, PRODUCT);
  if (!voorProduct) throw new Error('de groothandel voert geen ' + PRODUCT + ' -- is de seed veranderd?');

  /* 1 -- het artikel staat onder zijn minimum, en het inkoopadvies weet het. */
  let advies = null;
  await stap(
    schakel(1, 'zaak', 'zaak', 'een keukenartikel onder zijn minimum staat in het inkoopadvies'),
    () => P('/api/supplier/keuken', {}, A.S),
    async (r) => {
      advies = ((r.data && r.data.advies) || []).find(a => a.naam === ARTIKEL.naam) || null;
      return { klopt: !!advies && advies.advies === ARTIKEL.min * 2 - ARTIKEL.aantal,
        wat: advies ? 'advies ' + advies.advies + ' ' + advies.eenheid + ' (stand ' + advies.aantal + ', minimum ' + advies.min + ')' : 'niet in het advies' };
    });
  if (!advies) return uit;
  const besteld = advies.advies;

  /* 2 -- de ondernemer ziet het in zijn eigen beeld, buiten de keuken. */
  await stap(
    schakel(2, 'ondernemer', 'ondernemer', 'het ondernemingsbeeld telt het artikel als laag'),
    () => P('/api/onderneming/voorraad', { id: A.onderneming }, A.L),
    async () => {
      const b = await laagInBeeld(basis, A, ARTIKEL.naam);
      return { klopt: b.laag, wat: b.keuken ? 'keuken: ' + b.keuken.laag + ' laag, ' + ARTIKEL.naam + ' erbij: ' + b.laag : 'geen keukendeel in het beeld' };
    });

  /* 3 -- het advies wordt een bestelling, en die landt bij de groothandel. */
  const bestel = await stap(
    schakel(3, 'zaak', 'groothandel', 'het inkoopadvies wordt een bestelling, en de groothandel ziet hem als inkomend'),
    () => P('/api/supplier/keuken/bestel-advies', { groothandelCode: GROOTHANDEL }, A.S),
    async (r) => {
      const ref = r.data && r.data.order && r.data.order.ref;
      const o = await P('/api/supplier/groothandel/overzicht', {}, G);
      const bij = (((o.data && o.data.inkomend) || {}).open || []).find(x => x.ref === ref);
      const regel = bij && bij.regels.find(x => x.naam === PRODUCT);
      return { klopt: !!bij && !!regel && regel.aantal === besteld && bij.klant.id === A.code,
        wat: 'order ' + ref + ', inkomend: ' + !!bij + ', regel ' + (regel ? regel.aantal + ' x ' + regel.naam : 'ontbreekt') };
    });
  if (!bestel) return uit;
  const ref = bestel.data.order.ref;
  uit.order = ref;

  /* 4-5 -- de groothandel zet de keten vooruit, en de zaak leest elke stand. */
  for (const [nr, stand] of [[4, 'bevestigd'], [5, 'onderweg']]) {
    await stap(
      schakel(nr, 'groothandel', 'zaak', 'zet de bestelling op "' + stand + '", en de zaak leest die stand'),
      () => P('/api/supplier/groothandel/order/status', { ref, actie: 'verder' }, G),
      async () => {
        const o = await mijnOrder(basis, A.S, ref);
        return { klopt: !!o && o.status === stand, wat: 'de zaak leest "' + (o && o.status) + '"' };
      });
  }

  /* 6 -- geleverd. DE SCHAKEL WAAR DE KETEN OM DRAAIT: niet "de groothandel
     zegt geleverd", maar "de keuken heeft het binnen". */
  await stap(
    schakel(6, 'groothandel', 'zaak', 'levert, en de keukenvoorraad van de zaak is aangevuld tegen de inkoopprijs'),
    () => P('/api/supplier/groothandel/order/status', { ref, actie: 'verder' }, G),
    async () => {
      const a = await keukenArtikel(basis, A.S, ARTIKEL.naam);
      const o = await mijnOrder(basis, A.S, ref);
      const verwacht = ARTIKEL.aantal + besteld;
      return { klopt: !!a && a.aantal === verwacht && a.kostprijs === voorProduct.inkoopPrijs && !!o && o.status === 'geleverd',
        wat: 'order "' + (o && o.status) + '", ' + ARTIKEL.naam + ' ' + (a && a.aantal) + ' (verwacht ' + verwacht +
          '), kostprijs ' + (a && a.kostprijs) + ' (inkoop ' + voorProduct.inkoopPrijs + ')' };
    });

  /* 7 -- en het ondernemingsbeeld volgt. */
  await stap(
    schakel(7, 'ondernemer', 'ondernemer', 'het artikel staat niet meer als laag in het ondernemingsbeeld'),
    () => P('/api/onderneming/voorraad', { id: A.onderneming }, A.L),
    async () => {
      const b = await laagInBeeld(basis, A, ARTIKEL.naam);
      return { klopt: !!b.beeld && !b.laag, wat: 'nog laag: ' + b.laag };
    });

  /* 8 -- de groothandel: zijn voorraad is afgeboekt en zijn omzet telt mee. */
  await stap(
    schakel(8, 'groothandel', 'groothandel', 'zijn voorraad is afgeboekt en de levering telt in zijn omzet'),
    () => P('/api/supplier/groothandel/overzicht', {}, G),
    async (r) => {
      const p = ((r.data && r.data.producten) || []).find(x => x.naam === PRODUCT);
      const af = ((r.data.inkomend || {}).afgerond || []).find(x => x.ref === ref);
      return { klopt: !!p && p.voorraad === voorProduct.voorraad - besteld && !!af && af.status === 'geleverd' &&
          Number(r.data.inkomend.omzet) >= af.subtotaal,
        wat: PRODUCT + ' ' + voorProduct.voorraad + ' -> ' + (p && p.voorraad) + ', afgerond: ' + !!af + ', omzet ' + (r.data.inkomend || {}).omzet };
    });

  return uit;
}

async function storingen(basis, uit, w) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const { A, B, G } = w;
  const noteer = (naam, belofte, klopt, wat) =>
    uit.storingen.push({ naam, belofte, stand: klopt ? 'gehouden' : 'gebroken', wat });
  const p0 = await product(basis, G, PRODUCT);
  const bestel = (z, aantal, productId) => P('/api/supplier/inkoop/bestel',
    { groothandelCode: GROOTHANDEL, regels: [{ productId: productId || p0.id, aantal }] }, z.S);

  /* 1. MEER BESTELLEN DAN ER LIGT. Een groothandel die verkoopt wat hij niet
     heeft, levert straks niet -- en de keuken staat stil. */
  const teVeel = await bestel(A, (p0.voorraad || 0) + 1);
  const p1 = await product(basis, G, PRODUCT);
  noteer('meer bestellen dan de groothandel heeft liggen',
    'weigert met de stand erbij, en de voorraad van de groothandel blijft gelijk',
    teVeel.status === 409 && p1.voorraad === p0.voorraad,
    'status ' + teVeel.status + ', voorraad ' + p0.voorraad + ' -> ' + p1.voorraad);

  /* 2. ANNULEREN VOOR BEVESTIGING. Heen en terug horen elkaars omgekeerde te
     zijn (kern/groothandel/orderlaag.js, de kop van plaatsBestelling). */
  const o2 = await bestel(A, 3);
  const ann = await P('/api/supplier/inkoop/annuleer', { ref: o2.data && o2.data.order && o2.data.order.ref }, A.S);
  const p2 = await product(basis, G, PRODUCT);
  noteer('een nog niet bevestigde bestelling annuleren',
    'gaat door, en zet precies terug wat er was afgeboekt',
    o2.status === 200 && ann.status === 200 && p2.voorraad === p0.voorraad,
    'bestel ' + o2.status + ', annuleer ' + ann.status + ', voorraad ' + p0.voorraad + ' -> ' + p2.voorraad);

  /* 3. ANNULEREN NA BEVESTIGING. Dan staat er al iemand in te pakken. */
  const o3 = await bestel(A, 1);
  const ref3 = o3.data && o3.data.order && o3.data.order.ref;
  await P('/api/supplier/groothandel/order/status', { ref: ref3, actie: 'verder' }, G);
  const laat = await P('/api/supplier/inkoop/annuleer', { ref: ref3 }, A.S);
  noteer('een bevestigde bestelling annuleren',
    'weigert; na bevestiging is het de groothandel die beslist',
    laat.status === 409, 'status ' + laat.status + ': ' + (laat.data && laat.data.error));

  /* 4. WEIGEREN. Een geweigerde bestelling is niet verkocht: de plank krijgt
     hem terug, en de keuken van de koper krijgt niets. */
  const voorA = await keukenArtikel(basis, A.S, ARTIKEL.naam);
  const pv = await product(basis, G, PRODUCT);
  const o4 = await bestel(A, 2);
  const ref4 = o4.data && o4.data.order && o4.data.order.ref;
  const weiger = await P('/api/supplier/groothandel/order/status', { ref: ref4, actie: 'weiger' }, G);
  const p4 = await product(basis, G, PRODUCT);
  const naA = await keukenArtikel(basis, A.S, ARTIKEL.naam);
  noteer('de groothandel weigert een bestelling',
    'de voorraad gaat terug op de plank en de keuken van de koper verandert niet',
    weiger.status === 200 && p4.voorraad === pv.voorraad && naA.aantal === voorA.aantal,
    'weiger ' + weiger.status + ', plank ' + pv.voorraad + ' -> ' + p4.voorraad + ', keuken ' + voorA.aantal + ' -> ' + naA.aantal);

  /* 5. NOG EEN STAP NA GELEVERD. Een dubbele tik op "geleverd" mag de keuken
     geen tweede levering geven. */
  const o5 = await bestel(A, 2);
  const ref5 = o5.data && o5.data.order && o5.data.order.ref;
  for (let i = 0; i < 3; i++) await P('/api/supplier/groothandel/order/status', { ref: ref5, actie: 'verder' }, G);
  const na5 = await keukenArtikel(basis, A.S, ARTIKEL.naam);
  const dubbel = await P('/api/supplier/groothandel/order/status', { ref: ref5, actie: 'verder' }, G);
  const na5b = await keukenArtikel(basis, A.S, ARTIKEL.naam);
  noteer('een geleverde bestelling nog eens vooruitzetten',
    'weigert, en de keuken krijgt geen tweede levering',
    dubbel.status === 409 && na5b.aantal === na5.aantal,
    'status ' + dubbel.status + ', keuken ' + na5.aantal + ' -> ' + na5b.aantal);

  /* 6-7. DE TENANT-NAAD. De orderlijst is gedeeld (db.data.groothandelOrders),
     dus elke route filtert op de koper; dat is precies het soort grens dat
     stil wegvalt bij een refactor. */
  const o6 = await bestel(A, 1);
  const ref6 = o6.data && o6.data.order && o6.data.order.ref;
  const vreemd = await P('/api/supplier/inkoop/annuleer', { ref: ref6 }, B.S);
  const nog = await mijnOrder(basis, A.S, ref6);
  noteer('een andere zaak annuleert een bestelling die niet van haar is',
    'bestaat niet voor haar, en de bestelling blijft staan',
    vreemd.status === 404 && !!nog && nog.status === 'aangevraagd',
    'status ' + vreemd.status + ', bestelling van A: ' + (nog && nog.status));
  const zietB = await mijnOrder(basis, B.S, ref6);
  noteer('een andere zaak leest haar eigen inkooplijst',
    'daar staat de bestelling van een ander niet in', !zietB, 'zichtbaar voor B: ' + !!zietB);
  await P('/api/supplier/inkoop/annuleer', { ref: ref6 }, A.S);

  /* 8. EEN PRODUCT DAT DE KEUKEN NIET KENT. Een zaak mag inkopen wat ze wil --
     servetten staan niet op de keukenlijst. Maar "geleverd" mag dan niet
     stilzwijgend betekenen dat het ergens is ingeboekt: de zaak hoort te lezen
     WAT er in haar voorraad is gekomen en wat niet. Anders is een levering
     die nergens landt niet te onderscheiden van een levering die wel landde. */
  const servet = (await P('/api/supplier/groothandel/overzicht', {}, G)).data.producten.find(p => p.naam === 'Servetten (pak 500)');
  const o8 = await bestel(A, 2, servet && servet.id);
  const ref8 = o8.data && o8.data.order && o8.data.order.ref;
  for (let i = 0; i < 3; i++) await P('/api/supplier/groothandel/order/status', { ref: ref8, actie: 'verder' }, G);
  const g8 = await mijnOrder(basis, A.S, ref8);
  const ontv = g8 && g8.ontvangst;
  noteer('een geleverd product dat niet op de keukenlijst staat',
    'de zaak leest per regel of hij in haar voorraad is ingeboekt; niets is stilzwijgend "binnen"',
    !!g8 && g8.status === 'geleverd' && !!ontv && ontv.geboekt === 0 &&
      (ontv.nietGeboekt || []).some(r => r.naam === 'Servetten (pak 500)'),
    'order "' + (g8 && g8.status) + '", ontvangst: ' + JSON.stringify(ontv || null));

  /* 9. EEN LID IS GEEN ZAAK. Inkopen tegen inkoopprijs is een B2B-recht. */
  const lid = await P('/api/supplier/inkoop/bestel', { groothandelCode: GROOTHANDEL, regels: [{ productId: p0.id, aantal: 1 }] }, A.L);
  noteer('een ledensessie probeert in te kopen bij de groothandel',
    'komt niet langs de zaakpoort', lid.status === 401 || lid.status === 403, 'status ' + lid.status);

  /* 10. DE GROOTHANDEL ZET B2B UIT. Zijn eigen keuze, en die moet gelden. */
  await P('/api/supplier/groothandel/functie', { id: 'b2b', aan: false }, G);
  const dicht = await bestel(A, 1);
  await P('/api/supplier/groothandel/functie', { id: 'b2b', aan: true }, G);
  noteer('een groothandel die niet meer aan zaken levert',
    'weigert de bestelling met een reden', dicht.status === 409, 'status ' + dicht.status + ': ' + (dicht.data && dicht.data.error));

  return uit;
}

async function meet() {
  const uit = {
    stempel: huisStempel(),
    uitleg: 'De eerste keten tussen twee zaken: een keukenartikel zakt onder zijn minimum, het inkoopadvies wordt een groothandelsbestelling, en de levering landt in de keukenvoorraad van de koper. Gemeten per SCHAKEL (handelt actor A, en ziet actor B dat?) en per STORING (houdt de keten zijn belofte als het misgaat?). Zie CIVILIS.md par. 4.',
    grens: 'Geen browser en geen geld: de groothandelsbestelling kent vandaag geen betaling en geen factuur (keten factuur-grootboek blijft open). Alleen de keukenvoorraad van de koper; retail-, oogst- en groothandelsvoorraad aan de koperskant hebben eigen naden. Een groothandel uit de seed, twee restaurants langs de echte toelatingsweg.',
    groothandel: GROOTHANDEL, genre: GENRE,
    schakels: [], storingen: [], order: null
  };
  const srv = await start({ naam: 'voorraadproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', DEMO_SUPPLIER: GROOTHANDEL, OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  try {
    const w = await wereld(srv.basis, Date.now().toString(36));
    await loop(srv.basis, uit, w);
    await storingen(srv.basis, uit, w);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 8;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 8;
  uit.bevindingen = uit.schakels.filter(s2 => s2.stand === 'openBekend')
    .map(s2 => ({ schakel: s2.nr, van: s2.van, naar: s2.naar, wat: s2.wat, gemeten: s2.ziet, reden: s2.bekend }));
  return uit;
}

function druk(u) {
  console.log('voorraadproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(26) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, GROOTHANDEL };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: VOORRAADPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de voorraadproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
