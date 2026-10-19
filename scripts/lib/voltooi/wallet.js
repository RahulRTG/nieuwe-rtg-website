/* ============================================================================
   VOLTOOIPROEF: RTG WALLET (link:wallet, /apps/geld.html#wallet).

   De belofte van de stand: alles wat een lid bij zich draagt op een plek --
   klantenkaarten, tickets en sleutels die hij zelf toevoegt, en feestmunten
   met een saldo per zaak. Kopen kost echt geld (kern/wallet.js: via
   pay.huisIn naar de huisrekening), inwisselen verlaagt het saldo en kan
   nooit onder nul. De routes zijn die van apps/geld/walletb.js, letterlijk.

   DE MUNT IS HET GELDPAD. Een dubbeltik, een afgebroken verzoek en een crash
   mogen een lid nooit twee keer laten betalen of munten geven die niemand
   betaalde. De rail onder het bijladen is de simulatiebank; geen vlag in een
   poort: de paspoortpoort (onboarding.payGate) draait ongewijzigd mee, en het
   lid is daarom een echt account met een goedgekeurde identiteit.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, nieuwLid, inloggen, gebondenToestel, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const LIJST = '/api/wallet';
const VOEG = '/api/wallet/voeg';
const WEG = '/api/wallet/weg';
const KOOP = '/api/wallet/munt/koop';
const WISSEL = '/api/wallet/munt/wissel';
const OVERZICHT = '/api/pay/overzicht';

/* DE AFLOOP VAN HET BIJLADEN WORDT GEKOZEN, NIET GEGOKT. Het lid heeft geen
   tegoed, dus elke koop laadt eerst bij (kern/pay/opladen.js, zorgSaldo) met
   de sleutel `<idem>:autolaad`; de simulatiebank leidt de afloop af uit het id
   van die betaling, net als in ./pay.js. Deze proef wil de munt meten, niet de
   bank: hij zoekt dus een herhaalsleutel waarbij de bank betaalt. */
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
function sleutelVoor(codenaam, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = merk + '-' + i;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem + ':autolaad').slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden waarbij de simulatiebank het bijladen betaalt');
}

async function loop(w, stap) {
  const merk = 'wa' + Date.now().toString(36);
  const lid = await geverifieerdLid(w, 'wal');
  const T = lid.token;
  /* /api/wallet/* is een zwaar pad (kern/identiteit/bezitspaden.js): elk
     verzoek draagt het bezitsbewijs van een gebonden toestel, zoals de browser
     het via shared/basis.js meestuurt. De lijst zelf (/api/wallet) niet. */
  const toestel = await gebondenToestel(w, T);
  const post = async (pad, lijf, tok, t) => w.post(pad, lijf, tok || T, await (t || toestel).bewijs('POST', pad));
  /* De codenaam is nodig om de afloop van het bijladen te kiezen (zie boven). */
  const codenaam = ((await post(OVERZICHT, {})).data || {}).codenaam;
  if (!codenaam) throw new Error('geen codenaam uit het RTG Pay-overzicht');
  const idem = (soort) => sleutelVoor(codenaam, merk + '-' + soort);
  const lijst = async (tok) => (await w.post(LIJST, {}, tok || T)).data || {};
  const munt = (l, zaak) => (l.items || []).find((x) => x.soort === 'munt' && x.titel === 'Feestmunten · ' + zaak);
  /* Alle muntregels van een zaak samen: een herhaalde koop die een TWEEDE regel
     aanmaakt, geeft ook munten zonder betaling, en die zou munt() niet zien. */
  const munten = (l, zaak) => (l.items || []).filter((x) => x.soort === 'munt' && x.titel === 'Feestmunten · ' + zaak)
    .reduce((n, x) => n + x.saldo, 0);
  /* De betalingen van deze munten, uit het grootboek op schijf: een boeking van
     het lid naar de huisrekening met de munttitel als omschrijving. */
  const betalingen = (zaak) => {
    const boek = w.collectie('payBoekingen');
    const rijen = Array.isArray(boek) ? boek : Object.values(boek || {});
    return rijen.filter((r) => r && r.naar === 'extern:treasury' && r.oms === 'Feestmunten · ' + zaak);
  };
  const ZAAK = 'Zomerfeest ' + merk;
  let kaart = null, feest = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een geverifieerd lid opent de wallet: alle vakken leeg, met de muntprijs erbij', async () => {
    const l = await lijst();
    return { klopt: (l.items || []).length === 0 && l.muntPrijs === 3.5 && !!l.perSoort,
      ziet: (l.items || []).length + ' items, muntprijs ' + l.muntPrijs };
  });

  await stap('voltooibaar', 'het lid legt een klantenkaart in de wallet; zonder code wordt hij geweigerd met de reden', async () => {
    const leeg = await post(VOEG, { soort: 'klantenkaart', titel: 'Boekhandel ' + merk, code: '' });
    const r = await post(VOEG, { soort: 'klantenkaart', titel: 'Boekhandel ' + merk, code: 'KK-' + merk });
    kaart = r.data && r.data.item;
    const l = await lijst();
    return { klopt: leeg.status === 400 && /code/.test(leeg.data.error) && r.status === 200 &&
      (l.perSoort.klantenkaart || []).some((x) => x.code === 'KK-' + merk),
      ziet: 'zonder code ' + leeg.status + ', met code ' + r.status + ', ' + (l.perSoort.klantenkaart || []).length + ' klantenkaart' };
  });

  await stap('voltooibaar', 'het lid koopt 4 feestmunten: er is precies EEN keer 14 euro betaald en het saldo staat op 4', async () => {
    const r = await post(KOOP, { zaak: ZAAK, aantal: 4, idem: idem('eerste') });
    feest = munt(await lijst(), ZAAK);
    const b = betalingen(ZAAK);
    return { klopt: r.status === 200 && r.data.betaaldCenten === 1400 && !!feest && feest.saldo === 4 &&
      b.length === 1 && b[0].centen === 1400,
      ziet: 'kopen ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', saldo ' + (feest && feest.saldo) + ', ' + b.length + ' betaling(en)' };
  });

  await stap('voltooibaar', 'het lid wisselt een munt in (saldo 3); meer inwisselen dan er is wordt geweigerd', async () => {
    const r = await post(WISSEL, { id: feest.id, aantal: 1 });
    const te = await post(WISSEL, { id: feest.id, aantal: 50 });
    const m = munt(await lijst(), ZAAK);
    return { klopt: r.status === 200 && m.saldo === 3 && te.status === 409 && /Niet genoeg/.test(te.data.error),
      ziet: 'inwisselen ' + r.status + ', saldo ' + m.saldo + '; te veel ' + te.status + ' (' + (te.data && te.data.error) + ')' };
  });

  await stap('voltooibaar', 'een ANDER lid ziet niets van deze wallet en kan de munten en de kaart niet inwisselen of weghalen', async () => {
    const ander = await nieuwLid(w, 'walander');
    const zijnToestel = await gebondenToestel(w, ander.token);
    const zijn = await lijst(ander.token);
    const wis = await post(WISSEL, { id: feest.id, aantal: 1 }, ander.token, zijnToestel);
    const weg = await post(WEG, { id: kaart.id }, ander.token, zijnToestel);
    const l = await lijst();
    return { klopt: (zijn.items || []).length === 0 && wis.status === 404 && weg.status === 404 &&
      munt(l, ZAAK).saldo === 3 && l.items.some((x) => x.id === kaart.id),
      ziet: 'ander ziet ' + (zijn.items || []).length + ' items, inwisselen ' + wis.status + ', weghalen ' + weg.status + '; eigen saldo ' + munt(l, ZAAK).saldo };
  });

  await stap('voltooibaar', 'het lid haalt de klantenkaart weg; een tweede keer weghalen zegt dat hij er niet in zit', async () => {
    const r = await post(WEG, { id: kaart.id });
    const nog = await post(WEG, { id: kaart.id });
    const l = await lijst();
    return { klopt: r.status === 200 && nog.status === 404 && !l.items.some((x) => x.id === kaart.id),
      ziet: 'weg ' + r.status + ', nog eens ' + nog.status + ' (' + (nog.data && nog.data.error) + ')' };
  });

  await stap('voltooibaar', 'uitgelogd ziet niemand de wallet en koopt of wisselt niemand iets: 401, met een zin', async () => {
    const l = await w.post(LIJST, {}, null);
    const k = await w.post(KOOP, { zaak: ZAAK, aantal: 1, idem: merk + '-uit' }, null);
    const x = await w.post(WISSEL, { id: feest.id, aantal: 1 }, null);
    return { klopt: [l, k, x].every((r) => r.status === 401 && r.data && r.data.error) && munt(await lijst(), ZAAK).saldo === 3,
      ziet: 'lijst ' + l.status + ', kopen ' + k.status + ', inwisselen ' + x.status + ' (' + (l.data && l.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de munten er nog met saldo 3, en de kaart blijft weg', async () => {
    const l = await lijst();
    const m = munt(l, ZAAK);
    return { klopt: !!m && m.saldo === 3 && !l.items.some((x) => x.id === kaart.id),
      ziet: (l.items || []).length + ' item(s), muntsaldo ' + (m && m.saldo) };
  });

  await stap('persistent', 'een read-only lezer vindt de munten onder dit lid in de opslag, en de betaling in het grootboek', async () => {
    const bak = w.collectie('wallet') || {};
    const mijn = bak['user-' + lid.userId] || [];
    const m = mijn.find((x) => x.titel === 'Feestmunten · ' + ZAAK);
    const b = betalingen(ZAAK);
    return { klopt: !!m && m.saldo === 3 && b.length === 1 && !JSON.stringify(bak).includes(T),
      ziet: mijn.length + ' item(s) op schijf, muntsaldo ' + (m && m.saldo) + ', ' + b.length + ' betaling' };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in en ziet in een nieuwe sessie dezelfde wallet', async () => {
    const tok = await inloggen(w, lid);
    const m = munt(await lijst(tok), ZAAK);
    return { klopt: !!m && m.saldo === 3, ziet: 'nieuwe sessie, muntsaldo ' + (m && m.saldo) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Koop (dezelfde sleutel, tegelijk) betaalt een keer en geeft de munten een keer', async () => {
    const zaak = 'Dubbel ' + merk;
    const I_dubbel = idem('dubbel');
    const [a, b] = await Promise.all([post(KOOP, { zaak, aantal: 2, idem: I_dubbel }), post(KOOP, { zaak, aantal: 2, idem: I_dubbel })]);
    const n = munten(await lijst(), zaak);
    const bet = betalingen(zaak);
    return { klopt: a.status === 200 && b.status === 200 && n === 2 && bet.length === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' munten, ' + bet.length + ' betaling(en)' };
  });

  await stap('herstelbaar', 'een afgebroken koop, daarna opnieuw met dezelfde sleutel: een betaling en de munten een keer', async () => {
    const zaak = 'Half ' + merk;
    const I_half = idem('half');
    const half = await w.afgebroken(KOOP, { zaak, aantal: 3, idem: I_half }, T, await toestel.bewijs('POST', KOOP));
    const opnieuw = await post(KOOP, { zaak, aantal: 3, idem: I_half });
    const n = munten(await lijst(), zaak);
    const bet = betalingen(zaak);
    return { klopt: opnieuw.status === 200 && n === 3 && bet.length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' munten, ' + bet.length + ' betaling(en)' };
  });

  await stap('herstelbaar', 'een crash direct na de koop, daarna dezelfde tik opnieuw: niet verloren en niet verdubbeld', async () => {
    const zaak = 'Crash ' + merk;
    const I_crash = idem('crash');
    const r = await post(KOOP, { zaak, aantal: 5, idem: I_crash });
    await w.crash();
    const opnieuw = await post(KOOP, { zaak, aantal: 5, idem: I_crash });
    const n = munten(await lijst(), zaak);
    const bet = betalingen(zaak);
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 5 && bet.length === 1,
      ziet: 'gekocht ' + r.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + n + ' munten, ' + bet.length + ' betaling(en)' };
  });
}

module.exports = {
  functie: 'link:wallet',
  ingang: '/apps/geld.html#wallet',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een lid legt zijn kaarten in de wallet, koopt feestmunten die echt betaald worden en wisselt ze in, nooit onder nul -- een ander lid ziet of raakt er niets van, en een dubbele tik, een afgebroken verzoek of een crash laat hem nooit twee keer betalen',
  grens: 'De rail onder het bijladen is de simulatiebank, geen echte provider. De ledenpas (/api/state) en het grote codescherm zijn hier niet beproefd: de proef loopt de routes van de stand, niet de stand zelf, en kent geen Redis, PostgreSQL of geldmotor.',
  loop
};
