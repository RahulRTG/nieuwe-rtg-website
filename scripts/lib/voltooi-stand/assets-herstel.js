/* VOLTOOIPROEF ASSETS, de herstelbare helft: een dubbeltik op aanvragen, een
   afgebroken betaling en een crash direct na een bevestigde betaling. Apart
   van ./assets.js om de 10 kB; de gedeelde stukken komen als `c` mee. */
'use strict';
const KOOP = '/api/asset/koop';
const AANVRAGEN = '/api/asset/aanvragen';
const BETAAL = '/api/asset/aanvraag/betaal';
const BESLIS = '/api/office/asset/aanvraag/beslis';

module.exports = async function herstelbaar(w, stap, c) {
  const { object, key, mens, merk, poging, tickets, aanvraag, geen5xx } = c;
  const L = c.L;
  await stap('herstelbaar', 'een dubbele tik op "aanvragen": een aanvraag, niet twee', async () => {
    const [a, b] = await w.dubbel(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'dubbel-' + merk }, L.token);
    const n = (((await w.post(AANVRAGEN, {}, L.token)).data || {}).aanvragen || []).filter((x) => x.status === 'aangevraagd').length;
    return { klopt: geen5xx(a) && geen5xx(b) && a.data.aanvraag.id === b.data.aanvraag.id && n === 2, ziet: 'antwoorden ' + a.status + '/' + b.status + ', open aanvragen ' + n + ' (met die van de bevoegdheidsstap)' };
  });
  await stap('herstelbaar', 'een afgebroken betaling, daarna opnieuw met dezelfde sleutel: een betaling, en tickets precies een keer', async () => {
    const D = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'half-' + merk }, L.token)).data || {}).aanvraag;
    await w.post(BESLIS, { id: D.id, besluit: 'goedgekeurd' }, mens);
    const voor = await tickets(object.id), idem = poging(key, D.id, 'betaald');
    const half = await w.afgebroken(BETAAL, { id: D.id, idem }, L.token);
    const r = await w.post(BETAAL, { id: D.id, idem }, L.token);
    const d = await aanvraag(D.id);
    return { klopt: r.status === 200 && d.status === 'betaald' && d.ticketIds.length === 1 && (await tickets(object.id)) === voor + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + r.status + ', tickets ' + voor + ' -> ' + (await tickets(object.id)) };
  });
  await stap('herstelbaar', 'een crash direct na een bevestigde betaling: de tickets staan er, en nog eens betalen maakt er geen bij', async () => {
    const E = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'stroom-' + merk }, L.token)).data || {}).aanvraag;
    await w.post(BESLIS, { id: E.id, besluit: 'goedgekeurd' }, mens);
    const idem = poging(key, E.id, 'betaald');
    const r = await w.post(BETAAL, { id: E.id, idem }, L.token);
    const voor = await tickets(object.id);
    await w.crash();
    const nog = await w.post(BETAAL, { id: E.id, idem: idem + '-weer' }, L.token);
    const e = await aanvraag(E.id);
    return { klopt: r.status === 200 && e.status === 'betaald' && e.ticketIds.length === 1 && nog.status === 200 && nog.data.herhaald === true && (await tickets(object.id)) === voor,
      ziet: 'betaling ' + r.status + ', na SIGKILL ' + (e && e.status) + ' met ' + (e && e.ticketIds.length) + ' ticket, nog eens ' + nog.status + (nog.data && nog.data.herhaald ? ' (herhaald)' : '') + ', tickets ' + voor + ' -> ' + (await tickets(object.id)) };
  });
};
