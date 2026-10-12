#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE GEMEENSCHAPSPROEF -- de samenwerkingsketen van FoundationOS, gelopen.

   GEMEENSCHAP-FASE0.md par. 7 ontwierp hem: drager -> verbond -> beraad ->
   besluit -> bijeenkomst -> terugkoppeling. B1 (de drager), B2 (het verbond)
   en B3 (het beraad) staan elk met hun eigen toetsen; wat geen van die toetsen
   bewijst is dat ze SAMEN een keten vormen waarin wat de een doet, aankomt bij
   de ander -- langs diens EIGEN route en met diens EIGEN sessie.

   DE VORM IS DIE VAN DE ANDERE KETENPROEVEN, ZONDER GEDEELDE MODULE. Elke
   schakel is "actor A handelt, en actor B ziet dat"; elke storing is "de keten
   houdt zijn belofte als het misgaat", gemeten op het EFFECT (een telling voor
   en na) en niet alleen op de status. scripts/ketenvorm.js telt achteraf wat
   deze keten met de anderen deelt; daarom deelt hij met opzet geen code met
   scripts/tafelproef.js of scripts/toelatingsproef.js (test/adamproef.test.js
   toets 8 legt dezelfde regel voor de vierde keten vast).

   WAT DEZE KETEN ANDERS MAAKT DAN DE ZEVEN ERVOOR:
     - het zijn GROEPEN die handelen, niet een klant en een zaak: twee
       genootschappen, elk met een eigen beheerder, die samen iets afspreken
       zonder elkaars leden te zien;
     - er zit een ORGANISATIE buiten RTG in (een door de RTFoundation erkende
       stichting) die alleen langs haar eigen partnerdeur iets ziet;
     - de AI is voor het eerst een ACTOR in een keten (Rahul vat samen), en de
       proef meet ook wat hij NIET mag (stemmen);
     - de uitkomst is een BESLUIT en een terugkoppeling, geen dienst of toegang.

   EEN NAAD DIE EEN MENS IS, EN DAT IS GEEN GEBREK. Tussen het besluit van een
   beraad en de bijeenkomst die eruit volgt bestaat geen code: een bijeenkomst
   kent geen veld dat naar een besluit wijst, en een besluit roept niemand
   bijeen. Dat is in lijn met LIFE.md (samenstellen en klaarzetten -- bevestigen
   doet de mens): een beheerder leest de uitkomst en roept zelf bijeen. De proef
   doet die menselijke stap dus EXPLICIET en schrijft bij de schakel
   `naad: 'menselijk'`, zodat niemand later denkt dat de koppeling automatisch
   is, of dat de afwezigheid ervan een vergeten bedrading is.

   Draaien:  npm run gemeenschapsproef        (print, zakt op een open schakel)
             npm run gemeenschapsproef:vast   (schrijft GEMEENSCHAPSPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { stempel: huisStempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GEMEENSCHAPSPROEF.json');
const KANTOOR = 'RTG-OFFICE-PROEF';
/* De afspraakvelden van een verbond: vijf vragen, elk met a, b of samen
   (kern/verbond, gedeeld met kern/rtfos/partners.js). */
const AFSPRAKEN = { geld: 'a', vrijwilligers: 'samen', persoonsgegevens: 'b', aansprakelijk: 'samen', rapportage: 'a' };

async function post(basis, pad, lijf, tok, kop) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}, kop || {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null, tekst: '' };
  const tekst = await r.text().catch(() => '');
  let data = null;
  try { data = JSON.parse(tekst); } catch (e) { data = null; }
  return { status: r.status, data, tekst };
}

const schakel = (nr, van, naar, wat, bekend, naad) =>
  Object.assign({ nr, van, naar, wat, bekend: bekend || null }, naad ? { naad } : {});

/* DE WERELD: echte accounts langs de echte registratie, een paspoort dat langs
   de echte keuring gaat (een gedragen genootschap laat alleen een gekeurde
   volwassene binnen, CLAUDE.md: volwassen() is A3), en een stichting die het
   kantoor op naam erkent in het partnerregister. Er wordt niets in een database
   gezet. */
async function wereld(basis) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const helper = require('../test/helper');
  let teller = 0;
  async function lid(geboren, keuren) {
    const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
    const r = await P('/api/auth/register', { name: 'Genoot ' + u, email: 'gp' + u + '@gemeenschap.test',
      phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: geboren || '1986-03-03', tier: 'rtg', pasApp: 'rtg' });
    if (!r.data || !r.data.token) throw new Error('registratie mislukt (' + r.status + '): ' + r.tekst.slice(0, 160));
    // via Metier, zoals de verbond- en dragertoetsen: dan staat het lid in de gids
    const ik = await P('/api/metier/ik', {}, r.data.token);
    const codenaam = ik.data && ik.data.profiel && ik.data.profiel.codenaam;
    if (!codenaam) throw new Error('geen codenaam voor een nieuw lid (' + ik.status + ')');
    if (keuren !== false) await helper.keurLidGoed(basis, r.data.token, codenaam, geboren || '1986-03-03');
    return { token: r.data.token, codenaam };
  }
  const LAND = await helper.kantoorAlsPersoon(basis);
  if (!LAND) throw new Error('geen kantoorsessie op naam -- bestaat het demo-eigenaarsaccount?');
  const os = (pad, lijf) => P('/api/rtfos/' + pad, lijf, LAND);
  const stad = (await os('stad/maak', { naam: 'Utrecht' })).data;
  const stadId = stad && stad.stad && stad.stad.id;
  await os('stad/status', { id: stadId, status: 'actief' });
  const pt = await os('partner/maak', { stad: stadId, naam: 'Stichting Buurtwerk Proef', kvk: '87654321', doel: 'buurtwerk' });
  const partner = pt.data && pt.data.partner;
  if (!partner) throw new Error('geen partnerstichting (' + pt.status + '): ' + pt.tekst.slice(0, 160));
  for (const s of ['in_toetsing', 'goedgekeurd']) await os('partner/status', { id: partner.id, status: s });

  const w = { stichting: { id: partner.id, code: partner.code }, lid };
  w.beheerder = await lid();
  w.leden = [];
  for (let i = 0; i < 5; i++) w.leden.push(await lid());
  w.tweedeBeheerder = await lid(null, false);
  w.tweedeLid = await lid(null, false);
  w.buiten = await lid(null, false);
  return w;
}

const meldingen = async (P, w, titel) =>
  (((await P('/api/notifications', {}, w.token)).data || {}).notifications || []).filter(n => !titel || n.title === titel);
const laatste = (b) => b && b.rondes ? b.rondes[b.rondes.length - 1] : null;

async function loop(basis, uit, w) {
  const P = (pad, lijf, tok, kop) => post(basis, pad, lijf, tok, kop);
  const stap = async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        /* Een 4xx MET een uitgeschreven reden is een meetuitslag (het huis
           weigert met opzet en zegt waarom); een 5xx of een 0 is altijd stuk,
           ook als er een reden bij staat -- anders schrijft de proef een crash
           weg als besluit (GEMEENSCHAP-FASE0.md par. 7). */
        const deur = (r && r.status >= 400 && r.status < 500) && s.bekend;
        uit.schakels.push(Object.assign({}, s, { stand: deur ? 'openBekend' : 'stuk',
          status: r ? r.status : 0, antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
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
  const merk = String(Date.now()).slice(-5);
  const [l1, l2, l3, l4, l5] = w.leden;

  /* 1 -- de beheerder richt een openbaar genootschap op; een ander lid VINDT het
     langs zijn eigen zoekroute. */
  let A = null;
  await stap(schakel(1, 'beheerder', 'lid', 'een openbaar genootschap oprichten, en een ander lid vindt het in zoek'),
    () => P('/api/genootschap/richt-op', { naam: 'Buurtkoor ' + merk, soort: 'openbaar' }, w.beheerder.token),
    async (r) => {
      A = r.data && r.data.groep;
      const z = await P('/api/genootschap/zoek', { zoek: 'Buurtkoor ' + merk }, l1.token);
      const rij = ((z.data && z.data.groepen) || []).find(g => A && g.id === A.id);
      return { klopt: !!rij && rij.ikBenLid === false, wat: 'gevonden: ' + !!rij + (rij ? ', ' + rij.leden + ' lid' : '') };
    });
  if (!A) return;
  uit.wereld.genootschap = 'een openbaar genootschap met zes gekeurde volwassen leden';

  /* 2 -- leden treden binnen; de beheerder ziet ze in de ledenlijst. */
  await stap(schakel(2, 'lid', 'beheerder', 'vijf leden treden binnen, en de beheerder ziet ze in de ledenlijst'),
    async () => {
      let r;
      for (const l of w.leden) { r = await P('/api/genootschap/binnen', { groep: A.id }, l.token); if (r.status !== 200) return r; }
      return r;
    },
    async () => {
      const m = await P('/api/genootschap/mijn', {}, w.beheerder.token);
      const g = ((m.data && m.data.groepen) || []).find(x => x.id === A.id) || {};
      const lijst = JSON.stringify(g.ledenlijst || []);
      const alle = w.leden.every(l => lijst.includes(l.codenaam));
      return { klopt: alle, wat: 'alle vijf in de ledenlijst: ' + alle };
    });

  /* 3 -- de beheerder vraagt de stichting als drager (B1). De stichting ziet
     het langs haar EIGEN partnerdeur: naam en stand, en geen enkele codenaam. */
  await stap(schakel(3, 'beheerder', 'stichting', 'een erkende stichting als drager vragen, en de stichting ziet de vraag zonder ledencodenamen'),
    () => P('/api/genootschap/drager/vraag', { groep: A.id, ref: w.stichting.id }, w.beheerder.token),
    async () => {
      const z = await P('/api/rtfos/portaal/partner/genootschap', { code: w.stichting.code });
      const rij = ((z.data && z.data.groepen) || []).find(g => g.groep === A.id);
      const lek = [w.beheerder].concat(w.leden).some(l => z.tekst.includes(l.codenaam));
      return { klopt: !!rij && rij.stand === 'gevraagd' && !lek,
        wat: 'stand: ' + (rij ? rij.stand : 'niet zichtbaar') + ', codenaam in het partnerantwoord: ' + lek };
    });

  /* 4 -- de stichting erkent; een gewoon lid ziet de drager als verwijzing. */
  await stap(schakel(4, 'stichting', 'lid', 'de stichting erkent het genootschap, en een lid ziet de drager als verwijzing'),
    () => P('/api/rtfos/portaal/partner/genootschap/erken', { code: w.stichting.code, groep: A.id }),
    async () => {
      const m = await P('/api/genootschap/mijn', {}, l1.token);
      const g = ((m.data && m.data.groepen) || []).find(x => x.id === A.id) || {};
      return { klopt: !!g.drager && g.drager.stand === 'erkend' && !('ref' in g.drager),
        wat: 'drager: ' + JSON.stringify(g.drager || null) };
    });

  /* Het tweede genootschap, besloten, met een eigen beheerder en een eigen lid. */
  const B = (await P('/api/genootschap/richt-op', { naam: 'Tuinvereniging ' + merk, soort: 'besloten' }, w.tweedeBeheerder.token)).data;
  const Bid = B && B.groep && B.groep.id;
  await P('/api/genootschap/nodig-uit', { groep: Bid, wie: w.tweedeLid.codenaam }, w.tweedeBeheerder.token);
  await P('/api/genootschap/binnen', { groep: Bid }, w.tweedeLid.token);
  uit.wereld.tweede = 'een besloten genootschap met een eigen beheerder en een lid (geen drager)';

  /* 5 -- het verbond (B2): de beheerder van A stelt voor, de beheerder van B
     krijgt het op zijn SLEUTEL (/api/notifications) en leest het concept. */
  let V = null;
  const meldVoor = (await meldingen(P, w.tweedeBeheerder, 'Verbond')).length;
  await stap(schakel(5, 'beheerder', 'tweede-beheerder', 'een verbond voorstellen, en de andere beheerder krijgt het een keer en leest het concept'),
    () => P('/api/verbond/voorstel', { groep: A.id, naar: Bid, doel: 'Samen een zomerconcert in de tuin.', afspraken: AFSPRAKEN }, w.beheerder.token),
    async (r) => {
      V = r.data && r.data.verbond && r.data.verbond.id;
      const na = (await meldingen(P, w.tweedeBeheerder, 'Verbond')).length;
      const l = await P('/api/verbond/lees', { verbond: V }, w.tweedeBeheerder.token);
      const stand = l.data && l.data.verbond && l.data.verbond.stand;
      return { klopt: na === meldVoor + 1 && stand === 'concept', wat: 'meldingen +' + (na - meldVoor) + ', stand: ' + stand };
    });

  /* 6 -- beide kanten tekenen; het verbond is actief en byte voor byte gelijk
     aan beide kanten (op wie-ben-ik na). */
  await stap(schakel(6, 'tweede-beheerder', 'beheerder', 'beide kanten tekenen, en beide zien hetzelfde actieve verbond'),
    async () => {
      const b = await P('/api/verbond/teken', { verbond: V }, w.tweedeBeheerder.token);
      if (b.status !== 200) return b;
      return P('/api/verbond/teken', { verbond: V }, w.beheerder.token);
    },
    async () => {
      const la = ((await P('/api/verbond/lees', { verbond: V }, w.beheerder.token)).data || {}).verbond || {};
      const lb = ((await P('/api/verbond/lees', { verbond: V }, w.tweedeBeheerder.token)).data || {}).verbond || {};
      const velden = ['id', 'doel', 'afspraken', 'stand', 'actiefSinds', 'tijdlijn', 'keten'];
      const anders = velden.filter(v => JSON.stringify(la[v]) !== JSON.stringify(lb[v]));
      return { klopt: la.stand === 'actief' && !anders.length, wat: 'stand ' + la.stand + ', verschilt: ' + (anders.join(', ') || 'niets') };
    });

  /* 7 -- de LEDEN van beide kanten zien het actieve verbond, met de naam van
     het andere genootschap en zonder een enkele codenaam van de andere kant. */
  await stap(schakel(7, 'beheerder', 'tweede-lid', 'de leden van beide kanten zien het actieve verbond, zonder codenamen van de andere kant'),
    () => P('/api/verbond/mijn', {}, w.tweedeLid.token),
    async (r) => {
      const a = await P('/api/verbond/mijn', {}, l1.token);
      const vb = ((r.data && r.data.verbonden) || []).find(v => v.id === V);
      const va = ((a.data && a.data.verbonden) || []).find(v => v.id === V);
      const lekB = [w.beheerder].concat(w.leden).some(l => r.tekst.includes(l.codenaam));
      const lekA = [w.tweedeBeheerder, w.tweedeLid].some(l => a.tekst.includes(l.codenaam));
      return { klopt: !!vb && !!va && vb.stand === 'actief' && va.stand === 'actief' && !lekA && !lekB,
        wat: 'B ziet: ' + (vb && vb.stand) + ', A ziet: ' + (va && va.stand) + ', codenaam van de andere kant: ' + (lekA || lekB) };
    });

  /* 8 -- het beraad (B3) wordt geopend in A; een lid ziet de vraag. Het beraad
     hangt vandaag aan een GENOOTSCHAP en niet aan een verbond -- zie de
     bevinding in `uit.naden`. */
  let R = null;
  await stap(schakel(8, 'beheerder', 'lid', 'een beraad openen in het genootschap, en een lid ziet de vraag'),
    () => P('/api/beraad/open', { drager: { soort: 'genootschap', id: A.id }, vraag: 'Doen we mee aan het zomerconcert?' }, w.beheerder.token),
    async (r) => {
      R = r.data && r.data.beraad && r.data.beraad.id;
      const m = await P('/api/beraad/mijn', {}, l2.token);
      const zie = ((m.data && m.data.beraden) || []).find(b => b.id === R);
      return { klopt: !!zie && /zomerconcert/.test(zie.vraag), wat: 'in beraad/mijn: ' + !!zie };
    });

  /* 9 -- twee leden brengen iets in; een derde ziet beide, met codenaam. */
  await stap(schakel(9, 'lid', 'deelnemer', 'twee leden brengen iets in, en een derde lid ziet beide met hun codenaam'),
    async () => {
      const a = await P('/api/beraad/inbreng', { beraad: R, tekst: 'Graag, ik zing de tweede stem.' }, l1.token);
      if (a.status !== 200) return a;
      return P('/api/beraad/inbreng', { beraad: R, tekst: 'Alleen als het voor tienen klaar is.' }, l2.token);
    },
    async () => {
      const r = laatste(((await P('/api/beraad/lees', { beraad: R }, l3.token)).data || {}).beraad);
      const van = ((r && r.inbreng) || []).map(x => x.van);
      return { klopt: van.includes(l1.codenaam) && van.includes(l2.codenaam), wat: (r ? r.inbreng.length : 0) + ' inbreng zichtbaar' };
    });

  /* 10 -- Rahul vat samen: elke regel draagt de inbreng waar hij vandaan komt,
     en geen inbreng valt weg. De AI is hier LEZER en een actor in de keten. */
  await stap(schakel(10, 'rahul', 'lid', 'Rahul vat samen, met bij elke regel de inbreng als bron'),
    () => P('/api/beraad/hulp', { beraad: R, taak: 'samenvatting' }, l3.token),
    async (r) => {
      const regels = (r.data && r.data.regels) || [];
      const ronde = laatste(((await P('/api/beraad/lees', { beraad: R }, l3.token)).data || {}).beraad);
      const ids = ((ronde && ronde.inbreng) || []).map(x => x.id);
      const gedekt = ids.every(id => regels.some(x => x.inbrengId === id));
      return { klopt: regels.length > 0 && regels.every(x => x.inbrengId && x.zin) && gedekt,
        wat: regels.length + ' regels, elke inbreng gedekt: ' + gedekt };
    });

  /* 11 -- een voorstel, naar stemmen, en zes leden stemmen. Een lid ziet zijn
     eigen stem en GEEN tussenstand. */
  await stap(schakel(11, 'beheerder', 'deelnemer', 'een voorstel naar stemmen brengen, en elk lid stemt zelf zonder tussenstand'),
    async () => {
      const v = await P('/api/beraad/voorstel', { beraad: R, tekst: 'We doen mee, zaterdag 4 juli om 19:00.' }, w.beheerder.token);
      if (v.status !== 200) return v;
      const n = await P('/api/beraad/naar-stemmen', { beraad: R }, w.beheerder.token);
      if (n.status !== 200) return n;
      let s;
      for (const [t, k] of [[w.beheerder, 'voor'], [l1, 'voor'], [l2, 'tegen'], [l3, 'voor'], [l4, 'voor'], [l5, 'onthouding']]) {
        s = await P('/api/beraad/stem', { beraad: R, keuze: k }, t.token);
        if (s.status !== 200) return s;
      }
      return s;
    },
    async () => {
      const r = laatste(((await P('/api/beraad/lees', { beraad: R }, l4.token)).data || {}).beraad);
      return { klopt: !!r && r.mijnStem === 'voor' && r.uitslag === null && r.stand === 'stemmen',
        wat: 'stand ' + (r && r.stand) + ', eigen stem ' + (r && r.mijnStem) + ', tussenstand ' + JSON.stringify(r && r.uitslag) };
    });

  /* 12 -- de beheerder sluit; elk lid ziet de eindstand uit de gesloten lijst
     en, met zes stemmers, de aantallen. */
  await stap(schakel(12, 'beheerder', 'lid', 'het beraad sluiten, en elk lid ziet de eindstand en de aantallen'),
    () => P('/api/beraad/sluit', { beraad: R }, w.beheerder.token),
    async () => {
      const r = laatste(((await P('/api/beraad/lees', { beraad: R }, l5.token)).data || {}).beraad);
      const u = (r && r.uitslag) || {};
      return { klopt: !!r && r.eindstand && r.eindstand.stand === 'aangenomen' && u.getoond === true && u.voor === 4,
        wat: 'eindstand ' + (r && r.eindstand && r.eindstand.stand) + ', ' + u.voor + ' voor / ' + u.tegen + ' tegen / ' + u.onthouding + ' onthouding' };
    });

  /* 13 -- uit het besluit volgt een bijeenkomst. DE NAAD IS MENSELIJK: de
     beheerder leest de uitkomst en roept zelf bijeen, met het besluit in de
     toelichting. De uitnodiging moet bij ELK ander lid precies een keer
     aankomen, op zijn sleutel. */
  const wat = 'Zomerconcert ' + merk;
  const uitnodigVoor = {};
  for (const l of w.leden) uitnodigVoor[l.codenaam] = (await meldingen(P, l)).filter(n => String(n.body).includes(wat)).length;
  let bijeenId = null;
  await stap(schakel(13, 'beheerder', 'lid', 'uit het besluit een bijeenkomst bijeenroepen; elk ander lid krijgt de uitnodiging precies een keer',
    null, 'menselijk: een bijeenkomst kent geen veld dat naar een besluit wijst en een besluit roept niemand bijeen; de beheerder doet die stap zelf (LIFE.md: samenstellen en klaarzetten, bevestigen doet de mens)'),
    () => P('/api/genootschap/roep-bijeen', { groep: A.id, wat, datum: '2099-07-04', tijd: '19:00', waar: 'De tuin',
      toelichting: 'Volgt uit het beraad over het zomerconcert (aangenomen).' }, w.beheerder.token),
    async (r) => {
      bijeenId = r.data && r.data.bijeenkomst && r.data.bijeenkomst.id;
      const verschil = [];
      for (const l of w.leden) {
        const n = (await meldingen(P, l)).filter(x => String(x.body).includes(wat)).length;
        verschil.push(n - uitnodigVoor[l.codenaam]);
      }
      const ag = await P('/api/genootschap/agenda', { groep: A.id }, l5.token);
      const staat = ((ag.data && ag.data.komt) || []).some(b => b.id === bijeenId);
      return { klopt: verschil.every(x => x === 1) && staat, wat: 'uitnodigingen per lid: ' + verschil.join(',') + ', in de agenda: ' + staat };
    });

  /* 14 -- de terugkoppeling: wie meedeed (inbreng of stem) krijgt precies een
     bericht op zijn SLEUTEL, wie niet meedeed geen, en `gezien` is een trede. */
  await stap(schakel(14, 'beheerder', 'deelnemer', 'de terugkoppeling bereikt elke deelnemer precies een keer, en gezien is een trede'),
    () => P('/api/beraad/terugkoppeling-gezien', { beraad: R }, l2.token),
    async (r) => {
      const deelnemers = [w.beheerder].concat(w.leden);
      const per = [];
      for (const d of deelnemers) per.push((await meldingen(P, d, 'Beraad')).length);
      const niet = (await meldingen(P, w.tweedeLid, 'Beraad')).length;
      const t = (((await P('/api/beraad/mijn', {}, l2.token)).data || {}).terugkoppeling || []).find(x => x.beraad === R);
      /* De opener stemde zelf mee, dus ook hij is een deelnemer en krijgt
         precies een bericht; de niet-deelnemer (het lid van het andere
         genootschap) krijgt er geen. */
      return { klopt: per.every(x => x === 1) && niet === 0 && r.data && r.data.bewogen === 1 && t && t.trede === 'gezien',
        wat: 'berichten per deelnemer: ' + per.join(',') + ', niet-deelnemer: ' + niet + ', trede: ' + (t && t.trede) };
    });

  /* 15 -- meenemen: een lid neemt zijn eigen inbreng en het besluit mee in de
     uitvoer van het genootschap. GEMEENSCHAP-FASE0.md par. 7.2 schakel 11
     noemde dit al "deels nu". */
  await stap(schakel(15, 'lid', 'lid', 'zijn eigen inbreng en het besluit meenemen in de uitvoer van het genootschap',
    'De meeneemuitvoer (kern/genootschap/uitvoer.js mijn) kent prikbord, peilingen en bijeenkomsten maar het beraad nog niet: B3 is na de uitvoer gebouwd en niet in die uitvoer opgenomen. Wat een lid inbracht en het besluit waaraan hij meedeed, gaan bij vertrek dus niet mee. Een uitvoer die het beraad leest is een koppeling tussen twee kernmodules, en dat is een besluit (GEMEENSCHAP-FASE0.md par. 7.2 schakel 11, "deels nu") en geen reparatie in deze proef.'),
    () => P('/api/genootschap/mijn-uitvoer', { groep: A.id }, l1.token),
    async (r) => {
      const eigen = r.tekst.includes('ik zing de tweede stem');
      const besluit = r.tekst.includes('zaterdag 4 juli');
      return { klopt: eigen && besluit, wat: 'eigen inbreng mee: ' + eigen + ', besluit mee: ' + besluit };
    });

  uit.ids = { genootschap: A.id, tweede: Bid, verbond: V, beraad: R, bijeenkomst: bijeenId };
}

async function storingen(basis, uit, w) {
  const P = (pad, lijf, tok, kop) => post(basis, pad, lijf, tok, kop);
  const noteer = (naam, belofte, houdt, wat) =>
    uit.storingen.push({ naam, belofte, stand: houdt ? 'gehouden' : 'gebroken', wat });
  const merk = String(Date.now()).slice(-5) + 's';
  const [l1, l2, l3, l4, l5] = w.leden;
  const ids = uit.ids || {};

  /* Een verse kleine wereld voor de storingen die een eigen begin nodig hebben:
     twee genootschappen zonder drager, zodat een herhaling niet op de resten
     van de keten draait. */
  async function groep(beheer, soort, naam) {
    const g = await P('/api/genootschap/richt-op', { naam: naam + ' ' + merk, soort: soort || 'openbaar' }, beheer.token);
    return g.data && g.data.groep && g.data.groep.id;
  }

  /* 1. Een buitenstaander raadt het id van een verbond en van een beraad. */
  const vb = await P('/api/verbond/lees', { verbond: ids.verbond }, w.buiten.token);
  const br = await P('/api/beraad/lees', { beraad: ids.beraad }, w.buiten.token);
  const bi = await P('/api/beraad/inbreng', { beraad: ids.beraad, tekst: 'Ik ook!' }, w.buiten.token);
  const inbrengNa = (laatste(((await P('/api/beraad/lees', { beraad: ids.beraad }, l1.token)).data || {}).beraad) || {}).inbreng || [];
  noteer('een buitenstaander vraagt een verbond en een beraad op',
    'krijgt 404 zoals bij een verzonnen id, en zijn inbreng laat geen regel achter',
    vb.status === 404 && br.status === 404 && bi.status === 404 && !inbrengNa.some(x => x.van === w.buiten.codenaam),
    'verbond ' + vb.status + ', beraad ' + br.status + ', inbreng ' + bi.status);

  /* 2. Een kant tekent voor de andere. De kant komt uit de sessie; een
     meegestuurde `kant` doet niets, en een gewoon lid tekent helemaal niet. */
  const A2 = await groep(w.beheerder, 'openbaar', 'Leesclub');
  const B2 = await groep(w.tweedeBeheerder, 'openbaar', 'Fietsclub');
  const v2 = (await P('/api/verbond/voorstel', { groep: A2, naar: B2, doel: 'Een gezamenlijke leesfietstocht.', afspraken: AFSPRAKEN }, w.beheerder.token)).data;
  const V2 = v2 && v2.verbond && v2.verbond.id;
  const voorKant = await P('/api/verbond/teken', { verbond: V2, kant: 'a' }, w.tweedeBeheerder.token);
  const tekens = voorKant.data && voorKant.data.verbond && voorKant.data.verbond.tekens;
  await P('/api/genootschap/binnen', { groep: A2 }, l1.token);
  /* Een gewoon lid van A ziet een verbond pas als het actief is (kern/verbond
     mijn); voor hem bestaat een concept niet, dus hij krijgt 404 en geen 403 --
     een 403 zou verraden dat er iets bestaat. Gemeten wordt het EFFECT: de
     tekens zijn na zijn poging dezelfde. */
  const lidTekent = await P('/api/verbond/teken', { verbond: V2 }, l1.token);
  const tekensNa = (((await P('/api/verbond/lees', { verbond: V2 }, w.beheerder.token)).data || {}).verbond || {}).tekens;
  noteer('de ene kant tekent voor de andere, of een gewoon lid tekent',
    'de kant komt uit de sessie: de tweede beheerder tekent alleen voor zijn eigen kant, en een gewoon lid wordt geweigerd zonder dat er een teken bijkomt',
    !!tekens && tekens.a === null && !!tekens.b && [403, 404].includes(lidTekent.status) &&
      !!tekensNa && tekensNa.a === null,
    'tekens ' + JSON.stringify({ a: tekens && tekens.a, b: !!(tekens && tekens.b) }) + ', lid tekent: ' + lidTekent.status +
      ', kant a daarna: ' + JSON.stringify(tekensNa && tekensNa.a));

  /* 3. De tekst verandert na het tekenen: de handtekeningen gelden niet meer. */
  await P('/api/verbond/teken', { verbond: V2 }, w.beheerder.token);
  const voorWijzig = ((await P('/api/verbond/lees', { verbond: V2 }, w.beheerder.token)).data || {}).verbond || {};
  const wijzig = await P('/api/verbond/wijzig', { verbond: V2, doel: 'Twee gezamenlijke leesfietstochten.' }, w.tweedeBeheerder.token);
  const nw = (wijzig.data && wijzig.data.verbond) || {};
  noteer('de tekst van een getekend verbond verandert',
    'zet beide handtekeningen terug en het verbond terug naar concept; tekenen geldt voor een tekst, niet voor een id',
    voorWijzig.stand === 'actief' && nw.stand === 'concept' && JSON.stringify(nw.tekens) === JSON.stringify({ a: null, b: null }),
    'voor: ' + voorWijzig.stand + ', na: ' + nw.stand + ' ' + JSON.stringify(nw.tekens));

  /* 4. Een opgezegd verbond: geen nieuwe handeling meer (409), wel leesbaar. */
  await P('/api/verbond/zeg-op', { verbond: V2, reden: 'Het seizoen is voorbij.' }, w.beheerder.token);
  const naOpzeg = [];
  for (const [pad, lijf] of [['/api/verbond/teken', { verbond: V2 }], ['/api/verbond/wijzig', { verbond: V2, doel: 'Toch weer.' }]])
    naOpzeg.push((await P(pad, lijf, w.tweedeBeheerder.token)).status);
  const leesbaar = await P('/api/verbond/lees', { verbond: V2 }, w.tweedeBeheerder.token);
  noteer('na een opzegging opnieuw tekenen of wijzigen',
    'weigert met 409 en de reden dat het verbond is opgezegd, terwijl het verbond leesbaar blijft',
    naOpzeg.every(s => s === 409) && leesbaar.status === 200 &&
      /opgezegd/.test(String(((leesbaar.data || {}).verbond || {}).stand)),
    'teken/wijzig: ' + naOpzeg.join('/') + ', lezen: ' + leesbaar.status);

  /* 5, 9. Een kleine kring voor stemmen: voor naar-stemmen geweigerd, en Rahul
     kan via het stuur niet stemmen. */
  const K = await groep(w.beheerder, 'openbaar', 'Klein beraad');
  for (const l of [l1, l2]) await P('/api/genootschap/binnen', { groep: K }, l.token);
  const kb = ((await P('/api/beraad/open', { drager: { soort: 'genootschap', id: K }, vraag: 'Een nieuwe bank?' }, w.beheerder.token)).data || {}).beraad;
  const KB = kb && kb.id;
  await P('/api/beraad/voorstel', { beraad: KB, tekst: 'Een houten bank bij de ingang.' }, w.beheerder.token);
  const teVroeg = await P('/api/beraad/stem', { beraad: KB, keuze: 'voor' }, l1.token);
  const naVroeg = laatste(((await P('/api/beraad/lees', { beraad: KB }, l1.token)).data || {}).beraad) || {};
  noteer('stemmen voordat het voorstel naar stemmen is gebracht',
    'weigert met een reden, en er staat daarna geen stem',
    teVroeg.status === 409 && !!(teVroeg.data && teVroeg.data.error) && naVroeg.mijnStem === null,
    'status ' + teVroeg.status + ', eigen stem daarna: ' + naVroeg.mijnStem);

  await P('/api/beraad/naar-stemmen', { beraad: KB }, w.beheerder.token);
  const viaStuur = await P('/api/member/doe', { pad: '/api/beraad/stem', body: { beraad: KB, keuze: 'tegen' } }, l2.token);
  const naStuur = laatste(((await P('/api/beraad/lees', { beraad: KB }, l2.token)).data || {}).beraad) || {};
  const binnen = viaStuur.status === 200 && viaStuur.data && viaStuur.data.ok === true;
  noteer('Rahul probeert via het stuur te stemmen namens een lid',
    'wordt geweigerd en laat geen stem achter: in een beraad handelt een mens zelf',
    !binnen && naStuur.mijnStem === null,
    'stuur: ' + viaStuur.status + ' ' + String((viaStuur.data && (viaStuur.data.error || viaStuur.data.status)) || '').slice(0, 90) +
      ', stem daarna: ' + naStuur.mijnStem);

  /* 8. Een kleine kring: tijdens het stemmen en onder vijf stemmers geen getal. */
  for (const [t, k] of [[w.beheerder, 'voor'], [l1, 'voor'], [l2, 'tegen']]) await P('/api/beraad/stem', { beraad: KB, keuze: k }, t.token);
  const tijdens = await P('/api/beraad/lees', { beraad: KB }, l1.token);
  const tijdensR = laatste((tijdens.data || {}).beraad) || {};
  const ks = await P('/api/beraad/sluit', { beraad: KB }, w.beheerder.token);
  const naK = laatste(((ks.data || {}).beraad)) || {};
  noteer('een uitslag lezen tijdens het stemmen, en bij minder dan vijf stemmers',
    'toont geen telling tijdens het stemmen, en daarna alleen de eindstand met de reden, nooit een aantal',
    tijdensR.uitslag === null && !/"stemmen":/.test(tijdens.tekst) && naK.uitslag && naK.uitslag.getoond === false &&
      !('voor' in naK.uitslag) && !!naK.eindstand,
    'tijdens: ' + JSON.stringify(tijdensR.uitslag) + ', na: ' + JSON.stringify(naK.uitslag && { getoond: naK.uitslag.getoond, reden: naK.uitslag.reden }));

  /* 6. Een herhaalde sluiting stuurt geen tweede terugkoppeling. */
  const voorHerhaal = [];
  for (const l of [l1, l2, l3, l4, l5]) voorHerhaal.push((await meldingen(P, l, 'Beraad')).length);
  const nogEens = await P('/api/beraad/sluit', { beraad: ids.beraad }, w.beheerder.token);
  const naHerhaal = [];
  for (const l of [l1, l2, l3, l4, l5]) naHerhaal.push((await meldingen(P, l, 'Beraad')).length);
  noteer('het beraad een tweede keer sluiten',
    'geeft hetzelfde antwoord en geen tweede bericht: twee keer sluiten is een keer besluiten',
    nogEens.status === 200 && JSON.stringify(voorHerhaal) === JSON.stringify(naHerhaal),
    'status ' + nogEens.status + ', berichten voor ' + voorHerhaal.join(',') + ' na ' + naHerhaal.join(','));

  /* 7. Heropenen maakt een nieuwe ronde; de eindstand van de eerste blijft. */
  const voorHeropen = (((await P('/api/beraad/lees', { beraad: ids.beraad }, l1.token)).data || {}).beraad || { rondes: [] }).rondes[0];
  const heropen = await P('/api/beraad/heropen', { beraad: ids.beraad, reden: 'De zaal is die dag toch niet vrij.' }, w.beheerder.token);
  const naHeropen = ((heropen.data || {}).beraad || { rondes: [] }).rondes;
  noteer('het beraad heropenen na het besluit',
    'opent een nieuwe ronde; de eindstand en de aantallen van de eerste ronde veranderen nooit',
    heropen.status === 200 && naHeropen.length === 2 && !!voorHeropen &&
      JSON.stringify(naHeropen[0].eindstand) === JSON.stringify(voorHeropen.eindstand) &&
      JSON.stringify(naHeropen[0].uitslag) === JSON.stringify(voorHeropen.uitslag),
    'status ' + heropen.status + ', rondes ' + naHeropen.length + ', eerste eindstand ' + (naHeropen[0] && naHeropen[0].eindstand && naHeropen[0].eindstand.stand));

  /* 10. Een bijeenkomst twee keer afgelasten: de eerste reden blijft, en wie ja
     zei krijgt een bericht en niet twee. */
  const ab = ((await P('/api/genootschap/roep-bijeen', { groep: K, wat: 'Bank sjouwen ' + merk, datum: '2099-08-08' }, w.beheerder.token)).data || {}).bijeenkomst;
  await P('/api/genootschap/antwoord', { groep: K, id: ab && ab.id, antwoord: 'ja' }, l1.token);
  const afVoor = (await meldingen(P, l1)).filter(n => /Afgelast/.test(String(n.body))).length;
  const af1 = await P('/api/genootschap/afgelast', { groep: K, id: ab && ab.id, reden: 'Regen voorspeld.' }, w.beheerder.token);
  const af2 = await P('/api/genootschap/afgelast', { groep: K, id: ab && ab.id, reden: 'Toch iets anders.' }, w.beheerder.token);
  const afNa = (await meldingen(P, l1)).filter(n => /Afgelast/.test(String(n.body))).length;
  const reden2 = af2.data && af2.data.bijeenkomst && af2.data.bijeenkomst.afgelast && af2.data.bijeenkomst.afgelast.reden;
  noteer('een bijeenkomst twee keer afgelasten',
    'de eerste afgelasting blijft leidend: geen tweede bericht, en de reden wordt niet overschreven',
    af1.status === 200 && af2.status === 200 && reden2 === 'Regen voorspeld.' && afNa - afVoor === 1,
    'reden na de tweede: ' + reden2 + ', berichten +' + (afNa - afVoor));

  /* 11. De actor uit het lijf. Een meegestuurde sleutel of codenaam maakt van
     de aanroeper niemand anders. */
  const KB2 = ((await P('/api/beraad/open', { drager: { soort: 'genootschap', id: K }, vraag: 'Wie zet koffie?' }, w.beheerder.token)).data || {}).beraad;
  const vals = await P('/api/beraad/inbreng', { beraad: KB2 && KB2.id, tekst: 'Ik doe het wel.', key: 'iemand-anders',
    door: w.beheerder.codenaam, van: w.beheerder.codenaam, sess: { key: 'x' } }, l1.token);
  const regel = ((laatste(((await P('/api/beraad/lees', { beraad: KB2 && KB2.id }, l2.token)).data || {}).beraad) || {}).inbreng || [])
    .find(x => x.tekst === 'Ik doe het wel.');
  noteer('een inbreng met een andere actor in het lijf',
    'de actor komt uit de sessie: de regel staat op naam van wie hem stuurde, nooit op een meegestuurde naam',
    vals.status === 200 && !!regel && regel.van === l1.codenaam,
    'status ' + vals.status + ', staat op: ' + (regel && regel.van === l1.codenaam ? 'het eigen lid' : (regel ? 'een ANDERE naam' : 'niets')));

  /* 12. Een minderjarige (gekeurd paspoort, zeventien) gaat geen gedragen
     genootschap in -- niet zelf en niet via een uitnodiging. */
  const jong = await w.lid('2009-09-09');
  const ledenVoor = JSON.stringify(((((await P('/api/genootschap/mijn', {}, w.beheerder.token)).data || {}).groepen || [])
    .find(g => g.id === ids.genootschap) || {}).ledenlijst);
  const zelf = await P('/api/genootschap/binnen', { groep: ids.genootschap }, jong.token);
  const uitgenodigd = await P('/api/genootschap/nodig-uit', { groep: ids.genootschap, wie: jong.codenaam }, w.beheerder.token);
  const ledenNa = JSON.stringify(((((await P('/api/genootschap/mijn', {}, w.beheerder.token)).data || {}).groepen || [])
    .find(g => g.id === ids.genootschap) || {}).ledenlijst);
  noteer('een minderjarige probeert een gedragen genootschap in te gaan',
    'wordt geweigerd met de leeftijdsgrens erbij, zelf en via een uitnodiging, en de ledenlijst blijft gelijk',
    zelf.status >= 400 && uitgenodigd.status >= 400 && /18 jaar/.test(zelf.tekst + uitgenodigd.tekst) && ledenVoor === ledenNa,
    'zelf ' + zelf.status + ', uitnodiging ' + uitgenodigd.status + ', ledenlijst gelijk: ' + (ledenVoor === ledenNa));

  /* 13. Een bijeenkomst met een plaats: de tweede ja wordt geweigerd met een
     reden, en na een nee komt de plaats vrij. */
  const vol = ((await P('/api/genootschap/roep-bijeen', { groep: K, wat: 'Proeverij ' + merk, datum: '2099-09-09', plaatsen: 1 }, w.beheerder.token)).data || {}).bijeenkomst;
  const ja1 = await P('/api/genootschap/antwoord', { groep: K, id: vol && vol.id, antwoord: 'ja' }, l1.token);
  const ja2 = await P('/api/genootschap/antwoord', { groep: K, id: vol && vol.id, antwoord: 'ja' }, l2.token);
  await P('/api/genootschap/antwoord', { groep: K, id: vol && vol.id, antwoord: 'nee' }, l1.token);
  const ja3 = await P('/api/genootschap/antwoord', { groep: K, id: vol && vol.id, antwoord: 'ja' }, l2.token);
  noteer('een tweede ja op een bijeenkomst met een plaats',
    'wordt geweigerd met de reden dat het vol is; na een nee komt de plaats vrij',
    ja1.status === 200 && ja2.status === 400 && /vol/i.test(ja2.tekst) && ja3.status === 200 &&
      ((ja3.data || {}).bijeenkomst || {}).ja === 1,
    'eerste ' + ja1.status + ', tweede ' + ja2.status + ', na een nee ' + ja3.status);
}

async function meet() {
  const uit = {
    stempel: huisStempel(),
    uitleg: 'De samenwerkingsketen van FoundationOS: drager, verbond, beraad, besluit, bijeenkomst, terugkoppeling (GEMEENSCHAP-FASE0.md par. 7). Gemeten per SCHAKEL (handelt actor A, en ziet actor B dat langs zijn eigen route?) en per STORING (houdt de keten zijn belofte als het misgaat?). Zie de kop van scripts/gemeenschapsproef.js.',
    grens: 'Twee genootschappen en een stichting op een wegwerpserver, geen browser. Het beraad hangt aan een genootschap en niet aan het verbond (het beraad kent vandaag alleen die drager). Rahul is gemeten als lezer (samenvatting) en als geweigerde stemmer via het stuur; het tweede slot in de route (het agentkenmerk) is van buitenaf niet te vervalsen en daarom hier niet beproefd. Gezinsprofielen en de partnerkant buiten de erkenning zijn niet gelopen.',
    schakels: [], storingen: [], wereld: {}, ids: null
  };
  const srv = await start({ naam: 'gemeenschapsproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: KANTOOR } });
  try {
    const w = await wereld(srv.basis);
    uit.wereld.leden = 'echte accounts via /api/auth/register; de leden van het gedragen genootschap met een paspoort langs de echte keuring (test/helper.js keurLidGoed)';
    uit.wereld.stichting = 'een stichting in het partnerregister, door het kantoor op naam erkend (in_toetsing -> goedgekeurd)';
    await loop(srv.basis, uit, w);
    await storingen(srv.basis, uit, w);
  } finally { srv.klaar(); }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0 };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  uit.sluit = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.openBekend === 0 && t.schakels >= 11;
  uit.sluitMetBevinding = t.open === 0 && t.stuk === 0 && t.gebroken === 0 && t.schakels >= 11;
  uit.bevindingen = uit.schakels.filter(s => s.stand === 'openBekend')
    .map(s => ({ schakel: s.nr, van: s.van, naar: s.naar, wat: s.wat, gemeten: s.ziet, reden: s.bekend }));
  uit.naden = uit.schakels.filter(s => s.naad).map(s => ({ schakel: s.nr, naad: s.naad }));
  return uit;
}

function druk(u) {
  console.log('gemeenschapsproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(30) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.naad ? '\n      NAAD: ' + s.naad : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: GEMEENSCHAPSPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de gemeenschapsproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
