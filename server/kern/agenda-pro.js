/* De pro-laag van de agenda: wat van een lijstje een echte kalender maakt.

   - BEREIK: afspraken over een datumvenster, met HERHALINGEN uitgerold
     (dag/week/maand/jaar, tot een einddatum). Een maand-herhaling op de
     31e wordt in een korte maand de laatste dag -- klemmen, niet
     overslaan, en dat staat hier zwart op wit.
   - UITNODIGEN op codenaam: de genodigde krijgt een gekoppelde kopie in
     de eigen agenda en zegt ja of nee; de organisator ziet de stand per
     deelnemer. Echte namen komen hier nergens voor.
   - HERINNERINGEN: een veegtimer die een seintje stuurt (SSE) zoveel
     minuten voor aanvang. De timer is unref'd: hij houdt geen test wakker.
   - ICS-export: de agenda praat met elke agenda ter wereld (RRULE voor de
     herhalingen). Tijden zijn bewust lokale tijden, zonder tijdzone: wat
     u intypt is wat er staat.
   - ECOSYSTEEM: boekingen uit RTG zelf verschijnen als alleen-lezen laag
     met bronlabel; de agenda schrijft er nooit aan.

   De basislaag (lijst, toevoegen, AI-invoer) staat in kern/agenda.js;
   deze laag wordt er in server.js overheen gelegd. */

const HERHAAL = ['geen', 'dag', 'week', 'maand', 'jaar'];

/* ---- herhalingen uitrollen ----
   De n-de keer wordt ALTIJD vanaf de basisdatum gerekend, nooit vanaf de
   vorige keer: een maandafspraak op de 31e klemt in september op de 30e,
   maar hoort in oktober gewoon weer op de 31e te staan. Wie doorstapt
   vanaf de geklemde datum blijft voorgoed op de 30e hangen. Deze regel is
   van het hele huis (ook de RTF-gezinsagenda), daarom staat hij hier los
   en wordt hij mee geexporteerd. */
function keerN(basis, soort, n) {
  const [j, m, dg] = basis.split('-').map(Number);
  if (soort === 'dag' || soort === 'week') {
    return new Date(Date.UTC(j, m - 1, dg + n * (soort === 'dag' ? 1 : 7))).toISOString().slice(0, 10);
  }
  const nm = soort === 'maand' ? m - 1 + n : m - 1, nj = soort === 'maand' ? j : j + n;
  const laatste = new Date(Date.UTC(nj, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(nj, nm, Math.min(dg, laatste))).toISOString().slice(0, 10);
}

function maakAgendaPro({ db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer, boekingenVanKlant }) {
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const store = () => { if (!db.data.agendas || typeof db.data.agendas !== 'object') db.data.agendas = {}; return db.data.agendas; };
  const ruw = k => { const s = store(); if (!Array.isArray(s[k])) s[k] = []; return s[k]; };
  const lidVan = ownerKey => String(ownerKey).startsWith('lid:') ? ownerKey.slice(4) : null;
  const naam = ownerKey => { const k = lidVan(ownerKey); return k ? (codenaamVan(k) || 'een lid') : 'de zaak'; };
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const isTijd = t => /^\d{2}:\d{2}$/.test(String(t || ''));

  function publiek(i) {
    return { id: i.id, titel: i.titel, tijd: i.tijd || null, eind: i.eind || null, plek: i.plek || null,
      notitie: i.notitie || null, gedaan: !!i.gedaan, herhaal: i.herhaal || 'geen', herhaalTot: i.herhaalTot || null,
      herinner: i.herinner == null ? null : i.herinner,
      van: i.vanKey ? naam(i.vanKey) : null, status: i.status || null,
      deelnemers: (i.deelnemers || []).map(d => ({ codenaam: naam(d.key), status: d.status })) };
  }

  function bereik(ownerKey, van, tot) {
    if (!isDatum(van) || !isDatum(tot) || tot < van) return { error: 'Kies een geldig datumvenster.' };
    const uit = [];
    for (const i of ruw(ownerKey)) {
      const basis = publiek(i);
      if (!i.herhaal || i.herhaal === 'geen') {
        if (i.datum >= van && i.datum <= tot) uit.push({ ...basis, datum: i.datum });
        continue;
      }
      const stop = i.herhaalTot && i.herhaalTot < tot ? i.herhaalTot : tot;
      for (let n = 0; n < 500; n++) {
        const d = keerN(i.datum, i.herhaal, n);
        if (d > stop) break;
        if (d >= van) uit.push({ ...basis, datum: d });
      }
    }
    uit.sort((a, b) => a.datum.localeCompare(b.datum) || String(a.tijd || '').localeCompare(String(b.tijd || '')));
    return { items: uit };
  }

  /* ---- bewaren met de pro-velden (nieuw of bestaand) ---- */
  function bewaarAfspraak(ownerKey, data) {
    const arr = ruw(ownerKey);
    let i = data.id ? arr.find(x => x.id === data.id) : null;
    if (data.id && !i) return { error: 'Afspraak niet gevonden.' };
    if (i && i.vanKey) return { error: 'Een uitnodiging wijzigt u niet; u zegt ja of nee.' };
    if (!i) {
      if (arr.length >= 2000) return { error: 'Uw agenda zit vol; ruim eerst wat op.' };
      i = { id: 'ag' + crypto.randomBytes(4).toString('hex'), gedaan: false, at: nu() };
      arr.push(i);
    }
    i.titel = scho(data.titel, 120) || i.titel || 'Afspraak';
    if (isDatum(data.datum)) i.datum = data.datum;
    if (!isDatum(i.datum)) { arr.pop(); return { error: 'Kies een geldige datum.' }; }
    i.tijd = isTijd(data.tijd) ? data.tijd : null;
    i.eind = isTijd(data.eind) && i.tijd && data.eind > i.tijd ? data.eind : null;
    i.plek = scho(data.plek, 120) || null;
    i.notitie = scho(data.notitie, 300) || null;
    i.herhaal = HERHAAL.includes(data.herhaal) ? data.herhaal : 'geen';
    i.herhaalTot = i.herhaal !== 'geen' && isDatum(data.herhaalTot) ? data.herhaalTot : null;
    const her = Math.round(Number(data.herinner));
    i.herinner = Number.isFinite(her) && her >= 0 && her <= 10080 && data.herinner !== null && data.herinner !== '' ? her : null;
    delete i.herinnerdOp;
    // de kopieën bij de genodigden gaan mee (tijd en plek zijn van de afspraak)
    for (const d of i.deelnemers || []) {
      const kopie = ruw(d.key).find(x => x.bronId === i.id && x.vanKey === ownerKey);
      if (kopie) Object.assign(kopie, { titel: i.titel, datum: i.datum, tijd: i.tijd, eind: i.eind,
        plek: i.plek, notitie: i.notitie, herhaal: i.herhaal, herhaalTot: i.herhaalTot });
      const lk = lidVan(d.key);
      if (lk) { try { sseToCustomer(lk, 'agenda', { kind: 'gewijzigd', titel: i.titel, datum: i.datum }); } catch (e) {} }
    }
    save();
    return { ok: true, id: i.id };
  }

  /* ---- uitnodigen op codenaam; ja of nee zeggen ---- */
  async function nodigUit(ownerKey, id, codenaam) {
    const i = ruw(ownerKey).find(x => x.id === id);
    if (!i) return { error: 'Afspraak niet gevonden.' };
    if (i.vanKey) return { error: 'Alleen de organisator nodigt uit.' };
    let doel = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(scho(codenaam, 60)) : null; doel = t && t.key; } catch (e) {}
    if (!doel) return { error: 'Geen lid gevonden met die codenaam.' };
    const doelOwner = 'lid:' + doel;
    if (doelOwner === ownerKey) return { error: 'Uzelf uitnodigen hoeft niet.' };
    i.deelnemers = i.deelnemers || [];
    if (i.deelnemers.length >= 50) return { error: 'Boven de vijftig deelnemers is het geen afspraak meer maar een zaal.' };
    if (i.deelnemers.some(d => d.key === doelOwner)) return { error: 'Al uitgenodigd.' };
    i.deelnemers.push({ key: doelOwner, status: 'uitgenodigd' });
    ruw(doelOwner).push({ id: 'ag' + crypto.randomBytes(4).toString('hex'), titel: i.titel, datum: i.datum,
      tijd: i.tijd || null, eind: i.eind || null, plek: i.plek || null, notitie: i.notitie || null,
      herhaal: i.herhaal || 'geen', herhaalTot: i.herhaalTot || null, herinner: null, gedaan: false,
      vanKey: ownerKey, bronId: i.id, status: 'uitgenodigd', at: nu() });
    save();
    try { sseToCustomer(doel, 'agenda', { kind: 'uitnodiging', titel: i.titel, datum: i.datum, van: naam(ownerKey) }); } catch (e) {}
    return { ok: true, deelnemers: publiek(i).deelnemers };
  }
  function antwoordUitnodiging(ownerKey, id, ja) {
    const k = ruw(ownerKey).find(x => x.id === id && x.vanKey);
    if (!k) return { error: 'Uitnodiging niet gevonden.' };
    k.status = ja ? 'ja' : 'nee';
    const bron = ruw(k.vanKey).find(x => x.id === k.bronId);
    if (bron) { const d = (bron.deelnemers || []).find(x => x.key === ownerKey); if (d) d.status = k.status; }
    save();
    const lk = lidVan(k.vanKey);
    if (lk) { try { sseToCustomer(lk, 'agenda', { kind: 'antwoord', titel: k.titel, codenaam: naam(ownerKey), ja: !!ja }); } catch (e) {} }
    return { ok: true, status: k.status };
  }

  /* ---- verwijderen, met de kopieën mee (vervangt de basislaag) ---- */
  function verwijder(ownerKey, itemId) {
    const s = store();
    const i = ruw(ownerKey).find(x => x.id === itemId);
    if (i && !i.vanKey && (i.deelnemers || []).length) {
      for (const d of i.deelnemers) {
        s[d.key] = ruw(d.key).filter(x => !(x.bronId === i.id && x.vanKey === ownerKey));
        const lk = lidVan(d.key);
        if (lk) { try { sseToCustomer(lk, 'agenda', { kind: 'vervallen', titel: i.titel, datum: i.datum }); } catch (e) {} }
      }
    }
    if (i && i.vanKey) {
      // een genodigde die weggooit zegt daarmee nee; de organisator ziet dat
      const bron = ruw(i.vanKey).find(x => x.id === i.bronId);
      if (bron) { const d = (bron.deelnemers || []).find(x => x.key === ownerKey); if (d) d.status = 'nee'; }
    }
    s[ownerKey] = ruw(ownerKey).filter(x => x.id !== itemId);
    save();
    return { ok: true };
  }

  const helpers = { keerN, publiek, ruw, naam, lidVan, isDatum, scho, sseToCustomer, save, boekingenVanKlant };
  const { ics, ecosysteem, startHerinneringen } = require('./agenda-ics')({ db, store }, helpers);
  startHerinneringen();

  return { bereik, bewaarAfspraak, nodigUit, antwoordUitnodiging, verwijder, ecosysteem, ics };
}

module.exports = { maakAgendaPro, keerN, HERHAAL };
