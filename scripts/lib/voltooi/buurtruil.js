/* ============================================================================
   VOLTOOIPROEF: DE BUURTRUIL (link:buurtruil, /apps/foundation/buurtruil.html).

   De belofte van het scherm: een buurtbewoner met een eigen RTG-account zet
   iets weg te geven (of gezocht) in zijn RTF-stad, een buur laat weten dat hij
   belangstelling heeft, en de eigenaar ziet wie en sluit het aanbod als het weg
   is. Zonder geld en zonder bericht dat vertrekt (kern/rtfos/ruil.js).

   DE WERELD. Het gezin hangt aan het account van de ouder (./../voltooigezin.js,
   accountplicht aan); de ouder ruilt met ZIJN account, want dit is de enige
   RTFoundation-deur op een ledensessie (routes/rtfos/ruil.js). Het kind in dat
   gezin heeft geen eigen account en komt er dus niet in. De stad opent het
   landelijke bestuur langs de kantoorroutes: de seed kent er geen.

   DE ONTVANGER is de buur: een tweede lid dat het aanbod in de lijst ziet en
   belangstelling toont, en dat het aanbod van een ander niet kan sluiten.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin, openStad } = require('../voltooigezin');

const STEDEN = '/api/rtfos/publiek/steden';
const LIJST = '/api/rtfos/ruil/lijst';
const MIJN = '/api/rtfos/ruil/mijn';
const PLAATS = '/api/rtfos/ruil/plaats';
const SLUIT = '/api/rtfos/ruil/sluit';
const INTERESSE = '/api/rtfos/ruil/interesse';

async function loop(w, stap) {
  const merk = 'ruil' + Date.now().toString(36);
  const stad = await openStad(w, 'Zwolle');
  const ouder = await accountGezin(w, 'ruil', { kind: true });
  const buur = await nieuwLid(w, 'buur', 'guest');
  const derde = await nieuwLid(w, 'derde', 'guest');
  const lijst = (tok) => w.post(LIJST, { stad: stad.id }, tok);
  const mijn = (tok) => w.post(MIJN, {}, tok || ouder.token);
  const rijen = (r) => (r && r.data && r.data.ruil) || [];
  const metTitel = (r, t) => rijen(r).filter((x) => x.titel === t);
  const FIETS = 'Kinderfiets ' + merk;
  const STOEL = 'Kinderstoel ' + merk;
  let fiets = null, stoel = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder opent de buurtruil, ziet de open stad en een lege lijst', async () => {
    const s = await w.post(STEDEN, {}, ouder.token);
    const l = await lijst(ouder.token);
    const zwolle = ((s.data && s.data.steden) || []).find((x) => x.id === stad.id);
    return { klopt: !!zwolle && l.status === 200 && rijen(l).length === 0,
      ziet: 'steden ' + s.status + (zwolle ? ' (Zwolle open)' : ' (geen Zwolle)') + ', lijst ' + l.status + ' met ' + rijen(l).length };
  });

  await stap('voltooibaar', 'de ouder geeft een kinderfiets weg en zoekt een kinderstoel; beide staan onder Mijn aanbod', async () => {
    const a = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: FIETS, wat: 'Twaalf inch', staat: 'goed' }, ouder.token);
    const b = await w.post(PLAATS, { stad: stad.id, soort: 'zoek', titel: STOEL }, ouder.token);
    fiets = a.data && a.data.ruil; stoel = b.data && b.data.ruil;
    const m = await mijn();
    return { klopt: a.status === 200 && b.status === 200 && metTitel(m, FIETS).length === 1 && metTitel(m, STOEL).length === 1 &&
      rijen(m).every((x) => x.ikBenEigenaar),
      ziet: 'plaatsen ' + a.status + '/' + b.status + ', mijn aanbod ' + rijen(m).length };
  });

  await stap('voltooibaar', 'de buur ziet de fiets in de lijst van Zwolle en laat weten dat hij belangstelling heeft; de ouder ziet wie', async () => {
    const l = await lijst(buur.token);
    const i = await w.post(INTERESSE, { id: fiets && fiets.id }, buur.token);
    const m = await mijn();
    const f = metTitel(m, FIETS)[0] || {};
    const gezienDoorBuur = metTitel(l, FIETS)[0] || {};
    return { klopt: !!gezienDoorBuur.id && gezienDoorBuur.ikBenEigenaar === false && gezienDoorBuur.belangstellenden === undefined &&
      i.status === 200 && f.interesse === 1 && (f.belangstellenden || []).length === 1,
      ziet: 'buur ziet ' + metTitel(l, FIETS).length + ', interesse ' + i.status + ', eigenaar ziet ' + f.interesse + ' belangstellende' };
  });

  await stap('voltooibaar', 'de ouder meldt de fiets als weg: hij verdwijnt uit de lijst en staat als weg onder Mijn aanbod', async () => {
    const s = await w.post(SLUIT, { id: fiets && fiets.id, status: 'weg' }, ouder.token);
    const l = await lijst(buur.token);
    const f = metTitel(await mijn(), FIETS)[0] || {};
    return { klopt: s.status === 200 && metTitel(l, FIETS).length === 0 && metTitel(l, STOEL).length === 1 && f.status === 'weg',
      ziet: 'sluiten ' + s.status + ', in de lijst ' + metTitel(l, FIETS).length + ' fiets, stand ' + f.status };
  });

  /* Bevoegdheid: wie zonder account, als ander lid of als kind komt. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geen lijst, geen plaatsing en geen belangstelling (401)', async () => {
    const l = await w.post(LIJST, { stad: stad.id });
    const p = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: 'Anoniem ' + merk });
    const i = await w.post(INTERESSE, { id: stoel && stoel.id });
    return { klopt: l.status === 401 && p.status === 401 && i.status === 401 && w.vindInOpslag('Anoniem ' + merk).length === 0,
      ziet: 'lijst ' + l.status + ', plaatsen ' + p.status + ', interesse ' + i.status };
  });

  await stap('voltooibaar', 'bevoegdheid: de buur kan het aanbod van de ouder niet intrekken, en ziet de belangstellenden niet', async () => {
    const s = await w.post(SLUIT, { id: stoel && stoel.id, status: 'ingetrokken' }, buur.token);
    const st = metTitel(await mijn(), STOEL)[0] || {};
    const l = metTitel(await lijst(buur.token), STOEL)[0] || {};
    return { klopt: s.status === 403 && st.status === 'open' && l.belangstellenden === undefined,
      ziet: 'intrekken door de buur ' + s.status + ' (' + (s.data && s.data.error) + '), stand ' + st.status };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind van het gezin heeft geen eigen account; met zijn gezinssessie komt het er niet in', async () => {
    const p = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: 'Kind ' + merk }, ouder.kind.token);
    const l = await w.post(LIJST, { stad: stad.id, code: ouder.kind.code, token: ouder.kind.token });
    return { klopt: p.status === 401 && l.status === 401 && w.vindInOpslag('Kind ' + merk).length === 0,
      ziet: 'plaatsen met het kindertoken ' + p.status + ', lijst met code+token ' + l.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan beide aanbiedingen met hun stand en de belangstelling er nog', async () => {
    const m = await mijn();
    const f = metTitel(m, FIETS)[0] || {}, s = metTitel(m, STOEL)[0] || {};
    return { klopt: m.status === 200 && f.status === 'weg' && f.interesse === 1 && s.status === 'open',
      ziet: 'mijn ' + m.status + ': fiets ' + f.status + ' (' + f.interesse + '), stoel ' + s.status };
  });

  await stap('persistent', 'een read-only lezer vindt de aanbiedingen in de opslag, op een codenaam en zonder e-mailadres', async () => {
    const plek = w.vindInOpslag(FIETS);
    const ruil = ((w.collectie('rtfos') || {}).ruil || []).filter((r) => r.titel === FIETS || r.titel === STOEL);
    return { klopt: plek.length > 0 && (ruil.length === 0 || (ruil.length === 2 && ruil.every((r) => r.codenaam && !JSON.stringify(r).includes(ouder.email)))),
      ziet: 'gevonden in ' + [...new Set(plek.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : '')))].join(', ') };
  });

  await stap('persistent', 'na de herstart logt de ouder opnieuw in en ziet in een nieuwe sessie hetzelfde aanbod; de buur ziet de stoel', async () => {
    const tok = await inloggen(w, ouder);
    const m = await mijn(tok);
    const l = await lijst(buur.token);
    return { klopt: m.status === 200 && metTitel(m, FIETS).length === 1 && metTitel(m, STOEL).length === 1 && metTitel(l, STOEL).length === 1,
      ziet: 'nieuwe sessie ' + m.status + ' met ' + rijen(m).length + ' aanbod, buur ziet ' + metTitel(l, STOEL).length + ' stoel' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Zet erbij (dezelfde herhaalsleutel) plaatst het aanbod een keer', async () => {
    const T = 'Wieg ' + merk;
    const [a, b] = await w.dubbel(PLAATS, { stad: stad.id, soort: 'geef', titel: T, idem: 'ruil-' + merk + '-wieg' }, ouder.token);
    const n = metTitel(await mijn(), T).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' wieg in Mijn aanbod' };
  });

  await stap('herstelbaar', 'een dubbele tik op Ik heb belangstelling telt een keer', async () => {
    const [a, b] = await w.dubbel(INTERESSE, { id: stoel && stoel.id }, derde.token);
    const s = metTitel(await mijn(), STOEL)[0] || {};
    const ok = [a.status, b.status].sort().join() === '200,409';
    return { klopt: ok && s.interesse === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + s.interesse + ' belangstellende' };
  });

  await stap('herstelbaar', 'een afgebroken plaatsing en daarna opnieuw: het aanbod staat er een keer', async () => {
    const T = 'Box ' + merk;
    const half = await w.afgebroken(PLAATS, { stad: stad.id, soort: 'geef', titel: T, idem: 'ruil-' + merk + '-box' }, ouder.token);
    const opnieuw = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: T, idem: 'ruil-' + merk + '-box' }, ouder.token);
    const n = metTitel(await mijn(), T).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' box' };
  });

  await stap('herstelbaar', 'een crash direct na een plaatsing verliest hem niet, en opnieuw plaatsen verdubbelt hem niet', async () => {
    const T = 'Speelkleed ' + merk;
    const r = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: T, idem: 'ruil-' + merk + '-kleed' }, ouder.token);
    await w.crash();
    const opnieuw = await w.post(PLAATS, { stad: stad.id, soort: 'geef', titel: T, idem: 'ruil-' + merk + '-kleed' }, ouder.token);
    const n = metTitel(await mijn(), T).length;
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 1,
      ziet: 'geplaatst ' + r.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + n + ' speelkleed' };
  });
}

module.exports = {
  functie: 'link:buurtruil',
  ingang: '/apps/foundation/buurtruil.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een buurtbewoner met een eigen account zet iets weg te geven of gezocht in zijn RTF-stad, een buur toont belangstelling en de eigenaar ziet wie en sluit het als het weg is -- zonder geld, en een ander of een kind kan er niets mee',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De stad opent het landelijke bestuur langs de kantoorroutes; het verbergen na twee meldingen en de werkvoorraad van de stichting lopen hier niet mee. De ouder ruilt met zijn eigen account (de enige RTFoundation-deur op een ledensessie), het kind komt er niet in. Er wordt niets verstuurd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
