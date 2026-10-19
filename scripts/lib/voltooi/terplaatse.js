/* ============================================================================
   VOLTOOIPROEF: TER PLAATSE (tab:terplaatse, /apps/app.html#tab=terplaatse).

   De tab heeft geen eigen adres; de ledenapp kent de sprong #tab=terplaatse
   (app-main-12a.js). Hij is breed (tickets, verhuur, charter, contracten,
   vastgoed, bezorgen). Deze proef loopt de keten die er het meest van vraagt
   en die drie delen ervan raakt: een auto huren met een vaste dagprijs
   (aanbod en Mijn huur in app-main-15.js, boeken en betalen in app-main-16.js),
   vrijwillig de locatie delen tijdens de huur (app-main-15.js), en het
   huurcontract dat de zaak opstelt en dat het lid tekent of weigert
   (app-main-18.js).

   DE ANDERE KANT LOOPT MEE. Het contract komt van de zaak (ISLAREN, langs de
   echte leveranciersinlog) en is pas getekend als beide kanten tekenen.

   WAT NIET GELOPEN IS staat in `grens`: tickets en transfer, charter,
   vastgoed en bezorgen hebben elk een eigen keten en zijn hier niet bewezen.
   ========================================================================== */
'use strict';
const { nieuwLid, geverifieerdLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const AANBOD = '/api/verhuur/aanbod';
const BOEK = '/api/huur/boek';
const BETAAL = '/api/booking/pay';
const MIJN = '/api/huur/mijn';
const LOCATIE = '/api/huur/locatie';
const CONTRACTEN = '/api/contracten/mijn';
const TEKEN = '/api/contract/teken';
const WEIGER = '/api/contract/weiger';
const ZAAK = 'ISLAREN';
const TEKST = 'Huurvoorwaarden: de auto wordt met volle tank en zonder schade teruggebracht; de borg komt bij inleveren terug.';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakLogin(w) {
  const rooster = await w.post('/api/supplier/roster', { code: ZAAK });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('geen manager in het rooster van ' + ZAAK + ' (' + rooster.status + ')');
  const z = await w.post('/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('inloggen bij ' + ZAAK + ' lukte niet (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const merk = Date.now().toString(36).slice(-4);
  /* gekeurd: een boeking betalen vraagt eenmalig het paspoort (payGate, besluit 19 oktober 2026) */
  const A = await geverifieerdLid(w, 'tpa');
  const B = await nieuwLid(w, 'tpb');
  let T = A.token;
  let Z = await zaakLogin(w);
  const huren = async (tok) => ((((await w.post(MIJN, {}, tok || T)).data) || {}).huren) || [];
  const contracten = async (tok) => ((((await w.post(CONTRACTEN, {}, tok || T)).data) || {}).contracten) || [];
  const contract = async (ref, tok) => (await contracten(tok)).find((c) => c.ref === ref) || null;
  const maakContract = (huur, titel) => w.post('/api/supplier/contract/maak', { soort: 'verhuur', titel, tekst: TEKST,
    codenaam: huur.customerCodename, huurRef: huur.ref }, Z);
  let autos = [], huur = null, cRef = null, c2Ref = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het verhuuraanbod toont de zaak met haar auto\'s en een vaste dagprijs per auto', async () => {
    const r = await w.post(AANBOD, {}, T);
    const zaak = ((r.data && r.data.partners) || []).find((p) => p.code === ZAAK);
    autos = (zaak && zaak.autos) || [];
    return { klopt: r.status === 200 && autos.length >= 3 && autos.every((a) => a.dagprijs > 0),
      ziet: r.status + ', ' + (zaak ? zaak.name : 'GEEN ' + ZAAK) + ' met ' + autos.length + ' auto\'s' };
  });

  await stap('voltooibaar', 'het lid boekt een auto voor twee dagen tegen de vaste dagprijs, en na betalen staat hij in Mijn huur', async () => {
    const a = autos[autos.length - 1];
    const r = await w.post(BOEK, { supplierCode: ZAAK, autoId: a.id, van: dag(3), tot: dag(5), idem: 'h-' + merk }, T);
    huur = r.data && r.data.huur;
    const voorBetalen = (await huren()).some((h) => huur && h.ref === huur.ref);
    const p = await w.post(BETAAL, { ref: huur && huur.ref }, T);
    const m = (await huren()).find((h) => huur && h.ref === huur.ref);
    return { klopt: r.status === 200 && huur.price === a.dagprijs * 2 && huur.status === 'wacht-op-betaling' && !voorBetalen && p.status === 200 && !!m && m.prijs === a.dagprijs * 2 && m.dagen === 2,
      ziet: 'boeken ' + r.status + ' (' + (huur && huur.price) + '), voor betalen in Mijn huur: ' + voorBetalen + ', betalen ' + p.status + ', daarna ' + (m ? m.auto + ' ' + m.status : 'NIETS') };
  });

  await stap('voltooibaar', 'dezelfde auto in een overlappende periode, door een ander lid, wordt geweigerd met de reden', async () => {
    const r = await w.post(BOEK, { supplierCode: ZAAK, autoId: huur.autoId, van: dag(4), tot: dag(6), idem: 'hb-' + merk }, B.token);
    return { klopt: r.status === 409 && /al verhuurd/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'een periode die eindigt voor hij begint, wordt geweigerd met de reden', async () => {
    const r = await w.post(BOEK, { supplierCode: ZAAK, autoId: autos[0].id, van: dag(6), tot: dag(5) }, T);
    return { klopt: r.status === 400 && /periode/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'het lid zet zijn locatie aan en weer uit; uit laat geen spoor achter', async () => {
    const aan = await w.post(LOCATIE, { ref: huur.ref, aan: true, lat: 38.91, lng: 1.43 }, T);
    const m1 = (await huren()).find((h) => h.ref === huur.ref);
    const uit = await w.post(LOCATIE, { ref: huur.ref, aan: false }, T);
    const m2 = (await huren()).find((h) => h.ref === huur.ref);
    const L = (w.collectie('huurLocaties') || {})[huur.ref] || {};
    return { klopt: aan.status === 200 && m1.locatieAan === true && uit.status === 200 && m2.locatieAan === false && L.lat === undefined,
      ziet: 'aan ' + aan.status + ' (' + m1.locatieAan + '), uit ' + uit.status + ' (' + m2.locatieAan + '), in de opslag lat ' + L.lat };
  });

  await stap('voltooibaar', 'de zaak stelt het huurcontract op; het lid ziet het en kan pas tekenen met naam en akkoord', async () => {
    const m = await maakContract(huur, 'Huurovereenkomst ' + merk);
    cRef = m.data && m.data.contract && m.data.contract.ref;
    const c = await contract(cRef);
    const zonder = await w.post(TEKEN, { ref: cRef, naam: 'Proef Lid' }, T);
    return { klopt: m.status === 200 && !!c && c.status === 'wacht' && c.getekendDoorMij === false && zonder.status === 400 && /akkoord/.test(zonder.data.error),
      ziet: 'opstellen ' + m.status + ', bij het lid ' + (c ? c.titel + ' / ' + c.status : 'NIETS') + ', zonder akkoord ' + zonder.status };
  });

  await stap('voltooibaar', 'het lid tekent, de zaak tekent, en het contract is voor beide kanten getekend', async () => {
    const t = await w.post(TEKEN, { ref: cRef, naam: 'Proef Lid', akkoord: true }, T);
    const tussen = await contract(cRef);
    const z = await w.post('/api/supplier/contract/teken', { ref: cRef, naam: 'ISLAREN manager', akkoord: true }, Z);
    const c = await contract(cRef);
    return { klopt: t.status === 200 && tussen.getekendDoorMij === true && tussen.status === 'wacht' && z.status === 200 && c.status === 'getekend' && c.getekendDoorZaak === true,
      ziet: 'lid ' + t.status + ' (' + tussen.status + '), zaak ' + z.status + ', nu ' + c.status };
  });

  await stap('voltooibaar', 'een tweede contract weigert het lid; daarna is het niet meer te tekenen, en dat zegt het', async () => {
    const m = await maakContract(huur, 'Aanvulling verzekering ' + merk);
    c2Ref = m.data && m.data.contract && m.data.contract.ref;
    const wg = await w.post(WEIGER, { ref: c2Ref }, T);
    const t = await w.post(TEKEN, { ref: c2Ref, naam: 'Proef Lid', akkoord: true }, T);
    const c = await contract(c2Ref);
    return { klopt: wg.status === 200 && c.status === 'geweigerd' && t.status === 409 && /geweigerd/.test(t.data.error),
      ziet: 'weigeren ' + wg.status + ', status ' + c.status + ', tekenen ' + t.status + ' (' + (t.data && t.data.error) + ')' };
  });

  await stap('voltooibaar', 'een ander lid ziet de huur en de contracten niet, tekent niet en zet de locatie van deze huur niet aan', async () => {
    const zijnH = await huren(B.token), zijnC = await contracten(B.token);
    const t = await w.post(TEKEN, { ref: cRef, naam: 'Vreemde', akkoord: true }, B.token);
    const l = await w.post(LOCATIE, { ref: huur.ref, aan: true }, B.token);
    return { klopt: !zijnH.some((h) => h.ref === huur.ref) && !zijnC.some((c) => c.ref === cRef || c.ref === c2Ref) && t.status === 404 && l.status === 404 && !!t.data.error && !!l.data.error,
      ziet: 'B ziet ' + zijnH.length + ' huur en ' + zijnC.length + ' contract(en), tekenen ' + t.status + ', locatie ' + l.status };
  });

  /* ---------------- persistent ---------------- */
  const voorH = JSON.stringify(await huren()), voorC = JSON.stringify(await contracten());
  await w.herstart();
  Z = await zaakLogin(w);

  await stap('persistent', 'na een nette herstart staan de huur en beide contracten er nog, met hun handtekeningen', async () => {
    const h = JSON.stringify(await huren()), c = JSON.stringify(await contracten());
    return { klopt: h === voorH && c === voorC && (await contract(cRef)).status === 'getekend', ziet: 'huur ' + (h === voorH ? 'gelijk' : 'ANDERS') + ', contracten ' + (c === voorC ? 'gelijk' : 'ANDERS') };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde huur en dezelfde contracten', async () => {
    const T2 = await inloggen(w, A);
    const h = JSON.stringify(await huren(T2)), c = JSON.stringify(await contracten(T2));
    return { klopt: h === voorH && c === voorC, ziet: 'huur ' + (h === voorH ? 'gelijk' : 'ANDERS') + ', contracten ' + (c === voorC ? 'gelijk' : 'ANDERS') };
  });

  await stap('persistent', 'huur en contract staan in de opslag zelf, op codenaam, zonder e-mailadres, met de herhaalsleutel bij de huur', async () => {
    const b = (w.collectie('boekingen') || []).find((x) => x.ref === huur.ref);
    const c = (w.collectie('contracten') || []).find((x) => x.ref === cRef);
    const plek = w.vindInOpslag(cRef);
    return { klopt: !!b && !!c && plek.length > 0 && b.idem === 'h-' + merk && c.partij.codename === huur.customerCodename &&
        !JSON.stringify(b).includes(A.email) && !JSON.stringify(c).includes(A.email) && !!c.tekenPartij && !!c.tekenZaak,
      ziet: 'huur ' + (b ? 'gevonden, sleutel ' + b.idem : 'WEG') + ', contract in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op boeken: een huur, niet twee, en geen "al verhuurd" door de eigen tik', async () => {
    const lijf = { supplierCode: ZAAK, autoId: autos[0].id, van: dag(10), tot: dag(11), idem: 'h2-' + merk };
    const [x, y] = await w.dubbel(BOEK, lijf, T);
    const n = (w.collectie('boekingen') || []).filter((b) => b.idem === lijf.idem).length;
    return { klopt: geen5xx(x) && geen5xx(y) && n === 1, ziet: 'antwoorden ' + x.status + '/' + y.status + ', ' + n + ' huur' };
  });

  await stap('herstelbaar', 'een afgebroken boeking en opnieuw met dezelfde tik: dezelfde huur, en betalen lukt een keer', async () => {
    const lijf = { supplierCode: ZAAK, autoId: autos[1].id, van: dag(12), tot: dag(13), idem: 'h3-' + merk };
    const af = await w.afgebroken(BOEK, lijf, T);
    const r = await w.post(BOEK, lijf, T);
    const [p, q] = await w.dubbel(BETAAL, { ref: r.data && r.data.huur && r.data.huur.ref }, T);
    const n = (w.collectie('boekingen') || []).filter((b) => b.idem === lijf.idem).length;
    const betaald = [p, q].filter((x) => x.status === 200).length;
    return { klopt: r.status === 200 && n === 1 && betaald === 1 && [p, q].every(geen5xx),
      ziet: 'afgebroken (' + (af.afgebroken ? 'client gaf op' : 'status ' + af.status) + '), opnieuw ' + r.status + (r.data && r.data.herhaald ? ' (herhaling)' : '') + ', ' + n + ' huur, betalen ' + p.status + '/' + q.status };
  });

  await stap('herstelbaar', 'een andere periode onder dezelfde tik is een conflict met de reden, en er komt niets bij', async () => {
    const r = await w.post(BOEK, { supplierCode: ZAAK, autoId: autos[0].id, van: dag(14), tot: dag(15), idem: 'h2-' + merk }, T);
    const n = (w.collectie('boekingen') || []).filter((b) => b.idem === 'h2-' + merk).length;
    return { klopt: r.status === 409 && !!r.data.error && n === 1, ziet: r.status + ' (' + (r.data && r.data.error) + '), ' + n + ' huur' };
  });

  await stap('herstelbaar', 'een crash direct na het tekenen: de handtekening staat er na de herstart, en nog eens tekenen zegt dat het al gebeurd is', async () => {
    const m = await maakContract(huur, 'Schadeprotocol ' + merk);
    const ref = m.data && m.data.contract && m.data.contract.ref;
    const t = await w.post(TEKEN, { ref, naam: 'Proef Lid', akkoord: true }, T);
    await w.crash();
    const c = await contract(ref);
    const weer = await w.post(TEKEN, { ref, naam: 'Proef Lid', akkoord: true }, T);
    return { klopt: t.status === 200 && !!c && c.getekendDoorMij === true && weer.status === 409 && /al ondertekend/.test(weer.data.error),
      ziet: 'tekenen ' + t.status + ', na SIGKILL getekend ' + (c && c.getekendDoorMij) + ', nog eens ' + weer.status + ' (' + (weer.data && weer.data.error) + ')' };
  });
}

module.exports = {
  functie: 'tab:terplaatse',
  ingang: '/apps/app.html',
  via: '#tab=terplaatse',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'ter plaatse huurt het lid een auto tegen een vaste dagprijs, betaalt vooraf, deelt vrijwillig zijn locatie en zet die weer uit, en tekent of weigert het huurcontract dat de zaak opstelt -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van de tab, niet het scherm zelf, en alleen de keten verhuur en contract. Tickets en transfer, charter, vastgoed en bezorgen staan op dezelfde tab en zijn hier NIET bewezen. Uitgifte en inname met foto\'s (de balie van de zaak) en de SOS-knop zijn niet gelopen. ISLAREN is een demonstratiezaak; betalen loopt over het RTG-tegoed van de demo, niet over een echte bank. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
