/* Bewaking-deel "wereld" (kern/afdelingen): de wereldkaart van de zaakdozen als
   bolletjes (groen/oranje/rood), de wereldknoppen (reset/hulp/update) en de
   doos-regie op afstand (doelversie voor de vloot, netwerkrol per doos). De doos
   haalt elke opdracht zelf op via het meetstation; de cloud duwt nooit iets naar
   binnen. Elke wijziging komt in het auditlog (audit komt via ctx binnen).
   Verbatim afgesplitst uit bewaking.js. */
module.exports = (ctx) => {
  const { save, crypto, nu, lijst, d, functies, functiesStand, audit } = ctx;

  const STIL_NA = 15 * 60 * 1000; // een doos die een kwartier niets meldt, staat op oranje
  function laatstePerDoos() {
    const per = {};
    for (const m of lijst(d().doosMetingen)) if (!per[m.doos]) per[m.doos] = m;
    return per;
  }
  function opdrachtRij() {
    if (!Array.isArray(d().doosOpdrachten)) d().doosOpdrachten = [];
    return d().doosOpdrachten;
  }
  function wereld() {
    const items = [];
    const per = laatstePerDoos();
    const doel = d().doosUpdate || null;
    for (const naam of Object.keys(per)) {
      const m = per[naam];
      const stil = nu() - m.at > STIL_NA;
      // op batterij draaien is geen storing, maar wel iets om te zien: oranje
      const opBatterij = m.stroom && m.stroom.bron === 'batterij';
      const status = m.modus === 'lokaal' ? 'rood' : (stil || opBatterij ? 'oranje' : 'groen');
      let detail = m.modus === 'lokaal'
        ? 'lijn weg' + (m.journaal ? ', ' + m.journaal + ' in journaal' : '') + (m.via ? ', meldt zich via ' + m.via : '')
        : (stil ? 'al ' + Math.round((nu() - m.at) / 60000) + ' min stil' : m.rtt + 'ms over de lijn');
      if (opBatterij) detail += ', op batterij' + (m.stroom.pct != null ? ' (' + m.stroom.pct + '%)' : '');
      if (m.versie) detail += ', v' + m.versie + (doel && doel.versie && m.versie !== doel.versie ? ' (doel v' + doel.versie + ')' : '');
      if (m.wifi && m.wifi !== 'uit') detail += ', wifi: ' + m.wifi;
      const acties = status === 'groen' ? ['hulp'] : ['reset', 'hulp'];
      if (doel && doel.versie && m.versie && m.versie !== doel.versie) acties.push('update');
      items.push({ id: 'doos:' + naam, naam, soort: 'doos', plek: m.plek || null, status, detail, acties });
    }
    for (const g of functies.catalogus(functiesStand())) for (const f of g.functies) {
      if (f.storing) items.push({ id: 'functie:' + f.id, naam: f.naam, soort: 'functie', plek: null, status: 'rood', detail: 'storing gemeld: ' + String(f.storing).slice(0, 80), acties: ['reset'] });
      else if (!f.aan) items.push({ id: 'functie:' + f.id, naam: f.naam, soort: 'functie', plek: null, status: 'oranje', detail: 'bewust uitgezet (schakelbord)', acties: [] });
    }
    items.push({ id: 'systeem:cloud', naam: 'RTG-cloud (dit huis)', soort: 'systeem', plek: { lat: 52.37, lon: 4.9 }, status: 'groen', detail: 'in de lucht, ' + Math.round(process.uptime() / 60) + ' min', acties: [] });
    const telling = { groen: 0, oranje: 0, rood: 0 };
    for (const i of items) telling[i.status]++;
    return { ok: true, items, telling, opdrachtenOpen: opdrachtRij().filter(o => !o.klaar).length };
  }
  function wereldActie(id, actie, wie) {
    if (!['reset', 'hulp', 'update'].includes(actie)) return { status: 400, error: 'Kies reset, hulp of update.' };
    if (actie === 'update' && !id.startsWith('doos:')) return { status: 400, error: 'Alleen een doos kent de update-opdracht.' };
    const naam = String(wie || 'kantoor');
    if (id.startsWith('doos:')) {
      const doosNaam = id.slice(5);
      if (!laatstePerDoos()[doosNaam]) return { status: 404, error: 'Deze doos staat niet op de kaart.' };
      const rij = opdrachtRij();
      if (rij.some(o => !o.klaar && o.doos === doosNaam && o.actie === actie))
        return { status: 409, error: 'Deze opdracht staat al klaar voor de doos.' };
      rij.unshift({ id: crypto.randomBytes(4).toString('hex'), doos: doosNaam, actie, door: naam.replace(/[<>]/g, '').slice(0, 30), klaar: false, at: nu() });
      if (rij.length > 200) rij.pop();
      save();
      audit(naam, 'Wereldknop: ' + actie + ' voor doos ' + doosNaam);
      return { ok: true, wacht: 'De doos haalt de opdracht op bij zijn volgende melding (binnen een minuut als de lijn er is).' };
    }
    if (id.startsWith('functie:')) {
      const fid = id.slice(8);
      if (!functies.OP_ID[fid]) return { status: 404, error: 'Onbekende functie.' };
      if (actie !== 'reset') return { status: 400, error: 'Een functie kent alleen reset (storing wissen).' };
      const st = functiesStand();
      if (!st[fid] || !st[fid].storing) return { status: 409, error: 'Deze functie meldt geen storing.' };
      st[fid].storing = null;
      save();
      audit(naam, 'Wereldknop: storing gewist op functie ' + fid);
      return { ok: true };
    }
    return { status: 404, error: 'Onbekend bolletje.' };
  }
  /* ---------- de doos-regie: beheer op afstand ----------
     Het kantoor zet EEN doelversie voor de hele vloot en per doos een
     netwerkrol (accesspoint, wifi-versterker, gastwifi). De doos haalt
     beide zelf op bij zijn eigen melding; de cloud duwt nooit iets naar
     binnen. Elke wijziging komt in het auditlog. */
  function doosUpdateZet(versie, notities, wie) {
    const v = String(versie || '').replace(/[^\w.\-]/g, '').slice(0, 20);
    if (!v) return { status: 400, error: 'Welke versie is het doel? Bijv. 2.4.0.' };
    d().doosUpdate = { versie: v, notities: String(notities || '').replace(/[<>]/g, '').slice(0, 300), door: String(wie || 'boardroom').replace(/[<>]/g, '').slice(0, 30), at: nu() };
    save();
    audit(wie || 'boardroom', 'Doelversie voor de doos-vloot gezet: v' + v);
    return { ok: true, update: d().doosUpdate };
  }
  function doosNetwerkZet(doosNaam, instellingen, wie) {
    const naam = String(doosNaam || '').replace(/[<>]/g, '').trim().slice(0, 40);
    if (!naam) return { status: 400, error: 'Welke doos?' };
    if (!laatstePerDoos()[naam]) return { status: 404, error: 'Deze doos staat niet op de kaart; hij moet zich eerst zelf melden.' };
    const i = instellingen || {};
    if (!['accesspoint', 'versterker', 'uit'].includes(i.rol)) return { status: 400, error: 'Kies een rol: accesspoint, versterker of uit.' };
    if (!d().doosNetwerk) d().doosNetwerk = {};
    d().doosNetwerk[naam] = {
      rol: i.rol, ssid: String(i.ssid || '').replace(/[<>]/g, '').slice(0, 32),
      gastwifi: i.gastwifi === true, gastSsid: String(i.gastSsid || '').replace(/[<>]/g, '').slice(0, 32),
      kanaal: Math.max(1, Math.min(13, Math.round(Number(i.kanaal) || 6))), at: nu()
    };
    save();
    audit(wie || 'boardroom', 'Netwerkrol van doos ' + naam + ' gezet: ' + i.rol + (i.gastwifi ? ' + gastwifi' : ''));
    return { ok: true, netwerk: d().doosNetwerk[naam] };
  }
  function doosRegie() {
    return { ok: true, update: d().doosUpdate || null, netwerk: d().doosNetwerk || {},
      statussen: lijst(d().doosUpdateStatus).slice(0, 15) };
  }

  // de doos meldt zich (meetstation): staat er een opdracht klaar, geef hem mee
  function opdrachtVoorDoos(doosNaam) {
    const o = opdrachtRij().find(x => !x.klaar && x.doos === doosNaam);
    if (!o) return null;
    o.klaar = true;
    o.klaarAt = nu();
    save();
    audit('meetstation', 'Doos ' + doosNaam + ' heeft de ' + o.actie + '-opdracht opgehaald');
    return o.actie;
  }

  return { laatstePerDoos, opdrachtRij, wereld, wereldActie, opdrachtVoorDoos, doosUpdateZet, doosNetwerkZet, doosRegie };
};
