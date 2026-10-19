/* ============================================================================
   VOLTOOIPROEF: ASSETS (tab:assets) -- RTG Shared Assets, de stand Assets in
   de ledenapp, bereikt langs de navigatieroute /apps/app.html#tab=assets.

   De belofte van de stand: een betalend lid koopt Access- of Asset-tickets in
   een object (24 uur per jaar, tien jaar), ziet zijn positie, boekt zijn dag,
   en kan binnen veertien dagen herroepen met volledige terugbetaling. Over de
   routes die de stand aanroept: /api/assets, /api/asset/document, /koop,
   /mijn, /gebruik, /herroep en /wachtlijst.

   DEZE PROEF SLUIT NIET, EN DAT IS DE UITKOMST (19 oktober 2026). Ze vond:
     1. /api/asset/koop maakt tickets aan en meldt een totaalprijs, maar schrijft
        niets af -- het saldo blijft gelijk (kern/assets/winkel.js assetKoop: er
        staat geen enkele betaling in);
     2. /api/asset/herroep meldt "de volledige koopsom staat in uw tegoed", maar
        de terugbetaling (pay.huisUit) weigert een bedrag boven het walletplafond
        van € 5.000 per boeking, en die weigering wordt genegeerd: er komt niets.
   Hoe een deelnemingsbewijs van tienduizenden euro's wordt betaald (bank, kaart,
   factuur) is een besluit van de eigenaar en van Geld, geen reparatie van een
   proef. De stappen hieronder meten de waarheid en blijven open tot dat besluit
   er is. WAAROM DIT NIET IN scripts/lib/voltooi/ STAAT: zie ./gezin.js.
   ========================================================================== */
'use strict';
const { geverifieerdLid, gebondenToestel, nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const ASSETS = '/api/assets';
const KOOP = '/api/asset/koop';
const MIJN = '/api/asset/mijn';
const HERROEP = '/api/asset/herroep';

async function loop(w, stap) {
  const L = await geverifieerdLid(w, 'asl');
  const X = await nieuwLid(w, 'asx');
  const t = await gebondenToestel(w, L.token);
  const saldo = async () => ((await w.post('/api/pay/overzicht', {}, L.token, await t.bewijs('POST', '/api/pay/overzicht'))).data || {}).saldo;
  let object = null, ticket = null;

  await stap('voltooibaar', 'het lid ziet de objecten met prijs, beschikbaarheid en het informatiedocument', async () => {
    const a = (await w.post(ASSETS, {}, L.token)).data || {};
    object = (a.assets || [])[0];
    const d = await w.post('/api/asset/document', { assetId: object && object.id }, L.token);
    return { klopt: !!object && object.prijsAccess > 0 && d.status === 200, ziet: (a.assets || []).length + ' objecten, Access ' + (object && object.prijsAccess) + ', document ' + d.status };
  });

  await stap('voltooibaar', 'een gekocht ticket wordt ook betaald: het saldo daalt met de prijs, of de koop wordt in woorden geweigerd', async () => {
    const voor = await saldo();
    const k = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }, L.token);
    ticket = k.data && k.data.tickets && k.data.tickets[0];
    const na = await saldo();
    const betaald = k.status === 200 && voor - na === k.data.totaalPrijs * 100;
    const eerlijkGeweigerd = k.status >= 400 && k.status < 500 && !ticket;
    return { klopt: betaald || eerlijkGeweigerd,
      ziet: 'koop ' + k.status + ', gemeld ' + (k.data && k.data.totaalPrijs) + ' euro, saldo ' + voor + ' -> ' + na + (k.status === 200 && voor === na ? ' -- ER IS NIETS AFGESCHREVEN' : '') };
  });

  await stap('voltooibaar', 'een herroeping die "de koopsom staat in uw tegoed" meldt, zet die koopsom ook in het tegoed', async () => {
    if (!ticket) return { klopt: false, ziet: 'geen ticket om te herroepen' };
    const voor = await saldo();
    const h = await w.post(HERROEP, { ticketId: ticket.id }, L.token);
    const na = await saldo();
    return { klopt: h.status === 200 && na - voor === h.data.terug * 100,
      ziet: 'herroep ' + h.status + ', gemeld terug ' + (h.data && h.data.terug) + ' euro, saldo ' + voor + ' -> ' + na + (h.status === 200 && na === voor ? ' -- ER IS NIETS TERUGGEKOMEN' : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen objecten en geen koop (401); een ander lid herroept het ticket van het eerste niet', async () => {
    const a = await w.post(ASSETS, {});
    const b = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 });
    const k = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }, L.token);
    const id = k.data && k.data.tickets && k.data.tickets[0] && k.data.tickets[0].id;
    const x = await w.post(HERROEP, { ticketId: id }, X.token);
    return { klopt: a.status === 401 && b.status === 401 && x.status === 404, ziet: 'objecten ' + a.status + ', koop ' + b.status + ', herroep door een ander ' + x.status };
  });

  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de positie van het lid er nog', async () => {
    const m = (await w.post(MIJN, {}, L.token)).data || {};
    return { klopt: (m.posities || []).some((p) => p.assetId === object.id && p.tickets >= 1), ziet: JSON.stringify((m.posities || []).map((p) => p.assetId + ':' + p.tickets)) };
  });
}

module.exports = {
  functie: 'tab:assets',
  ingang: '/apps/app.html#tab=assets',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een betalend lid koopt tickets in een object en betaalt ervoor, ziet zijn positie, en krijgt bij herroeping binnen veertien dagen de volledige koopsom terug',
  grens: 'Deze proef sluit niet: kopen schrijft niets af en de gemelde terugbetaling komt niet aan. Hoe een deelnemingsbewijs wordt betaald, is een besluit van de eigenaar en van Geld. Herstelbaar is daarom niet gelopen: een dubbeltik op een koop zonder betaling bewijst niets.',
  loop
};
