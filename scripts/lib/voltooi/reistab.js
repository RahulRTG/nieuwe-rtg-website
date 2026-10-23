/* ============================================================================
   VOLTOOIPROEF: DE REISTAB (tab:reizen, /apps/app.html#tab=reizen).

   De tab heeft geen eigen adres; de ledenapp kent de sprong #tab=reizen
   (app-main-12a.js). Wat hij tekent: de reis met het dagprogramma
   (renderTrip/renderAgenda in app-main-45.js, /api/agenda/mijn) en de
   autoshowroom (laadShowroom in app-main-18.js, kopen in app-main-19.js):
   bekijken, een proefrit aanvragen, een bod doen en het koopcontract tekenen.

   DE ANDERE KANT LOOPT MEE. Een proefrit is pas iets als de zaak hem
   inplant, en een contract is pas te tekenen als de zaak het bod aanvaardt.
   Dat doet hier de manager van ISLAREN langs de echte leveranciersinlog; wat
   het lid daarna ziet, is wat de zaak besliste.

   HET DAGPROGRAMMA IS EEN PROJECTIE. Er is geen schrijfroute op de agenda:
   hij voegt samen wat het lid elders boekte. De proef boekt daarom een vlucht
   langs de routes van /apps/vluchten.html en kijkt of die in het programma
   van de reistab staat -- en niet in dat van een ander lid.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const AGENDA = '/api/agenda/mijn';
const SHOWROOM = '/api/verkoop/showroom';
const MIJN = '/api/verkoop/mijn';
const PROEFRIT = '/api/verkoop/proefrit';
const KOOP = '/api/verkoop/koop';
const TEKEN = '/api/verkoop/teken';
const DEALER = '/api/supplier/verkoop/deal';
const OVERZICHT = '/api/supplier/verkoop/overzicht';
const ZAAK = 'ISLAREN';
const PASPOORT = { nummer: 'NX7654321', vervaldatum: '2031-01-01', nationaliteit: 'Nederlandse', geboortedatum: '1985-05-05' };

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
  const A = await nieuwLid(w, 'rta');
  const B = await nieuwLid(w, 'rtb');
  let T = A.token;
  let Z = await zaakLogin(w);
  const deals = async (tok) => ((((await w.post(MIJN, {}, tok || T)).data) || {}).deals) || [];
  const deal = async (ref, tok) => (await deals(tok)).find((d) => d.ref === ref) || null;
  const vrij = async () => ((((await w.post(SHOWROOM, {}, T)).data) || {}).autos) || [];
  let autos = [], proefRef = null, koopRef = null, koopAuto = null, vlucht = null, codenaam = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de showroom toont de auto\'s te koop met prijs, het exclusieve stuk bovenaan', async () => {
    const r = await w.post(SHOWROOM, {}, T);
    autos = (r.data && r.data.autos) || [];
    return { klopt: r.status === 200 && autos.length >= 3 && autos[0].vip === true && autos.every((a) => a.prijs > 0 && a.supplierCode === ZAAK),
      ziet: r.status + ', ' + autos.length + ' auto\'s, bovenaan ' + (autos[0] && autos[0].naam) };
  });

  await stap('voltooibaar', 'het lid vraagt een proefrit aan; hij staat bij het lid als aangevraagd en de zaak ziet hem met de wens', async () => {
    const a = autos[0];
    const r = await w.post(PROEFRIT, { supplierCode: a.supplierCode, autoId: a.id, wens: 'zaterdag ' + merk, idem: 'pr-' + merk }, T);
    proefRef = r.data && r.data.deal && r.data.deal.ref;
    const d = await deal(proefRef);
    const o = await w.post(OVERZICHT, {}, Z);
    const bijZaak = ((o.data && o.data.open) || []).find((x) => x.ref === proefRef);
    codenaam = bijZaak && bijZaak.codenaam;
    return { klopt: r.status === 200 && !!d && d.status === 'aangevraagd' && !!bijZaak && bijZaak.wens === 'zaterdag ' + merk && !!codenaam && !codenaam.includes('@') && codenaam !== 'Voltooilid',
      ziet: 'aanvraag ' + r.status + ', bij het lid ' + (d && d.status) + ', bij de zaak ' + (bijZaak ? bijZaak.codenaam + ' / ' + bijZaak.wens : 'NIETS') };
  });

  await stap('voltooibaar', 'de zaak plant de proefrit in; het lid ziet het moment', async () => {
    const p = await w.post(DEALER, { ref: proefRef, actie: 'plan', moment: 'za 10:00' }, Z);
    const d = await deal(proefRef);
    return { klopt: p.status === 200 && !!d && d.status === 'ingepland' && d.moment === 'za 10:00',
      ziet: 'plannen ' + p.status + ', bij het lid ' + (d && d.status) + ' ' + (d && d.moment) };
  });

  await stap('voltooibaar', 'het lid doet een bod; de auto is gereserveerd en verdwijnt uit de vrije showroom', async () => {
    koopAuto = autos[autos.length - 1];
    const r = await w.post(KOOP, { supplierCode: koopAuto.supplierCode, autoId: koopAuto.id, bod: koopAuto.prijs - 500, idem: 'ko-' + merk }, T);
    koopRef = r.data && r.data.deal && r.data.deal.ref;
    const nog = (await vrij()).some((a) => a.id === koopAuto.id);
    return { klopt: r.status === 200 && !!koopRef && r.data.deal.prijs === koopAuto.prijs - 500 && /koopovereenkomst/.test(r.data.deal.contract) && !nog,
      ziet: 'bod ' + r.status + ' op ' + koopAuto.naam + ', in de showroom ' + (nog ? 'NOG' : 'niet meer') };
  });

  await stap('voltooibaar', 'tekenen voordat de zaak het bod aanvaardt, wordt geweigerd met de reden', async () => {
    const r = await w.post(TEKEN, { ref: koopRef, naam: 'Proef Lid' }, T);
    return { klopt: r.status === 409 && /aanvaard/.test(r.data.error) && (await deal(koopRef)).status === 'aangevraagd',
      ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de zaak aanvaardt, het lid tekent het koopcontract, en de zaak ziet de handtekening', async () => {
    const a = await w.post(DEALER, { ref: koopRef, actie: 'aanvaard' }, Z);
    const t = await w.post(TEKEN, { ref: koopRef, naam: 'Proef Lid' }, T);
    const d = await deal(koopRef);
    const o = await w.post(OVERZICHT, {}, Z);
    const bijZaak = ((o.data && o.data.pda) || []).find((x) => x.ref === koopRef);
    return { klopt: a.status === 200 && t.status === 200 && d.status === 'getekend' && d.getekend === true && !!bijZaak && bijZaak.status === 'getekend',
      ziet: 'aanvaard ' + a.status + ', tekenen ' + t.status + ', bij het lid ' + d.status + ', bij de zaak ' + (bijZaak ? bijZaak.status : 'NIETS') };
  });

  await stap('voltooibaar', 'een geboekte vlucht staat in het dagprogramma van de reistab', async () => {
    const bord = await w.post('/api/member/vluchten/bord', {}, T);
    vlucht = ((bord.data && bord.data.vluchten) || []).find((x) => x.soort === 'vertrek' && x.status === 'inchecken');
    await w.post('/api/onboarding/paspoort', PASPOORT, T);
    const b = await w.post('/api/member/vluchten/boek', { id: vlucht && vlucht.id }, T);
    const g = await w.post(AGENDA, {}, T);
    const items = ((g.data && g.data.dagen) || []).flatMap((d) => d.items);
    const it = items.find((x) => x.soort === 'vlucht' && vlucht && x.titel.includes(vlucht.nummer));
    return { klopt: b.status === 200 && g.status === 200 && !!it,
      ziet: 'boeken ' + b.status + ', programma ' + g.status + ' met ' + items.length + ' item(s)' + (it ? ': ' + it.titel : ', ZONDER de vlucht') };
  });

  await stap('bevoegd', 'een ander lid ziet de deals en het programma van dit lid niet, en tekent zijn contract niet', async () => {
    const zijn = await deals(B.token);
    const g = await w.post(AGENDA, {}, B.token);
    const items = ((g.data && g.data.dagen) || []).flatMap((d) => d.items);
    const t = await w.post(TEKEN, { ref: koopRef, naam: 'Vreemde' }, B.token);
    return { klopt: !zijn.some((d) => d.ref === proefRef || d.ref === koopRef) && !items.some((x) => x.soort === 'vlucht') && t.status === 404 && !!t.data.error,
      ziet: 'B ziet ' + zijn.length + ' deal(s), ' + items.length + ' programmapunt(en), tekenen ' + t.status + ' (' + (t.data && t.data.error) + ')' };
  });

  await stap('voltooibaar', 'een andere auto onder dezelfde tik is een conflict met de reden, en er komt niets bij', async () => {
    const voor = (await deals()).length;
    const r = await w.post(PROEFRIT, { supplierCode: autos[1].supplierCode, autoId: autos[1].id, idem: 'pr-' + merk }, T);
    return { klopt: r.status === 409 && !!r.data.error && (await deals()).length === voor,
      ziet: r.status + ' (' + (r.data && r.data.error) + '), deals ' + voor + ' -> ' + (await deals()).length };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await deals());
  await w.herstart();
  Z = await zaakLogin(w);

  await stap('persistent', 'na een nette herstart staan de proefrit en de getekende koop er nog, met moment en handtekening', async () => {
    const na = JSON.stringify(await deals());
    const k = await deal(koopRef);
    return { klopt: na === voor && k.status === 'getekend' && (await deal(proefRef)).moment === 'za 10:00',
      ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', koop ' + k.status };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde deals en hetzelfde programma', async () => {
    const T2 = await inloggen(w, A);
    const na = JSON.stringify(await deals(T2));
    const g = await w.post(AGENDA, {}, T2);
    const items = ((g.data && g.data.dagen) || []).flatMap((d) => d.items);
    return { klopt: !!T2 && na === voor && items.some((x) => x.soort === 'vlucht'), ziet: (na === voor ? 'deals gelijk' : 'deals ANDERS') + ', programma ' + items.length };
  });

  await stap('persistent', 'de deals staan in de opslag zelf, op codenaam en sleutel, zonder e-mailadres', async () => {
    const plek = w.vindInOpslag(koopRef);
    const rij = (w.collectie('verkoopDeals') || []).find((d) => d.ref === koopRef);
    return { klopt: plek.length > 0 && !!rij && rij.codenaam === codenaam && !JSON.stringify(rij).includes(A.email) && rij.contract.getekend.naam === 'Proef Lid',
      ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; codenaam ' + (rij && rij.codenaam) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op proefrit: een aanvraag, niet twee', async () => {
    const a = autos[1], n0 = (await deals()).length;
    const lijf = { supplierCode: a.supplierCode, autoId: a.id, wens: 'zondag', idem: 'pr2-' + merk };
    const [x, y] = await w.dubbel(PROEFRIT, lijf, T);
    const n1 = (await deals()).length;
    return { klopt: geen5xx(x) && geen5xx(y) && n1 === n0 + 1, ziet: 'antwoorden ' + x.status + '/' + y.status + ', deals ' + n0 + ' -> ' + n1 };
  });

  await stap('herstelbaar', 'een afgebroken bod en opnieuw met dezelfde tik: precies een koop, geen "niet meer beschikbaar"', async () => {
    const a = autos.find((x) => x.id !== koopAuto.id && x.id !== autos[0].id && x.id !== autos[1].id) || autos[2];
    const lijf = { supplierCode: a.supplierCode, autoId: a.id, idem: 'ko2-' + merk };
    const af = await w.afgebroken(KOOP, lijf, T);
    const r = await w.post(KOOP, lijf, T);
    const n = (await deals()).filter((d) => d.soort === 'koop' && d.autoNaam === a.naam).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'afgebroken (' + (af.afgebroken ? 'client gaf op' : 'status ' + af.status) + '), opnieuw ' + r.status + (r.data && r.data.herhaald ? ' (herhaling)' : '') + ', ' + n + ' koop' };
  });

  await stap('herstelbaar', 'een dubbeltik op tekenen is dezelfde handtekening', async () => {
    const [x, y] = await w.dubbel(TEKEN, { ref: koopRef, naam: 'Proef Lid' }, T);
    const d = await deal(koopRef);
    return { klopt: x.status === 200 && y.status === 200 && d.status === 'getekend', ziet: 'antwoorden ' + x.status + '/' + y.status + ', ' + d.status };
  });

  await stap('herstelbaar', 'een crash direct na een proefritaanvraag: hij staat er na de herstart, en dezelfde tik maakt geen tweede', async () => {
    const a = autos[0];
    const lijf = { supplierCode: a.supplierCode, autoId: a.id, wens: 'maandag', idem: 'pr3-' + merk };
    const r = await w.post(PROEFRIT, lijf, T);
    await w.crash();
    const d = await deal(r.data && r.data.deal && r.data.deal.ref);
    const n0 = (await deals()).length;
    const z = await w.post(PROEFRIT, lijf, T);
    return { klopt: r.status === 200 && !!d && z.status === 200 && z.data.deal.ref === d.ref && (await deals()).length === n0,
      ziet: 'aanvraag ' + r.status + ', na SIGKILL ' + (d ? d.status : 'WEG') + ', opnieuw ' + z.status + ' ' + (z.data && z.data.deal && z.data.deal.ref === (d && d.ref) ? 'dezelfde' : 'ANDERE') };
  });
}

module.exports = {
  functie: 'tab:reizen',
  ingang: '/apps/app.html',
  via: '#tab=reizen',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'de reistab toont het dagprogramma van de reis en de autoshowroom: het lid vraagt een proefrit aan die de zaak inplant, doet een bod, en tekent het koopcontract zodra de zaak aanvaardt -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van de reistab, niet het scherm zelf. De reiskaart bovenaan (bestemming, data) komt uit de toestand van de app en is niet gelopen. ISLAREN is een demonstratiezaak; er wordt geen auto verkocht, betaald of afgeleverd, en de aflevering door de zaak is niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
