/* RTG Stadsweefsel, deel "voorzieningregister": WAAR de hulp staat.

   Afgesplitst uit ./voorzieningen.js, en op de naad die de hele laag draagt:
   hier woont het AANBOD (een gebouw, een capaciteit, een wachttijd), daar de
   vraagcijfers en de grenzen. Het aanbod mag je zo fijn vastleggen als je wilt
   -- een buurthuis is geen persoon. De vraag mag dat juist niet, en die twee
   niet in een bestand houden maakt dat verschil zichtbaar in plaats van dat je
   het moet onthouden.

   Twee vragen over hetzelfde gebouw, twee plekken: het object (waar staat het,
   wie beheert het, welke conditie) hoort in het gewone objectregister, het
   SOCIALE deel (plekken, wachttijd, doelgroep) hier. Net als bij een
   bedrijfspand.

   Krijgt de gedeelde ctx-onderdelen van ./voorzieningen.js. */
module.exports = ({ bak, save, crypto, nu, geo, obj, schoon, SOORTEN }) => {
  /* Een voorziening vastleggen. Het object komt in het gewone register (dus op
     de kaart, met een conditie en een beheerder); de capaciteit en de wachttijd
     staan hier. Twee vragen over hetzelfde gebouw, twee plekken -- net als bij
     een bedrijfspand. */
  function voorzieningMaak({ soort, naam, lat, lng, plekken, wachtDagen, doelgroep, organisatie, wie }) {
    const s = String(soort || '');
    if (!SOORTEN[s]) return { status: 400, error: 'Kies een soort: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const r = obj.objectMaak({ soort: 'pand', naam: schoon(naam, 80) || SOORTEN[s], lat, lng,
      eigenaar: schoon(organisatie, 60) || 'gemeente', beheerder: schoon(organisatie, 60) || 'welzijnsorganisatie' });
    if (!r.ok) return r;
    const v = { id: 'V-' + crypto.randomBytes(3).toString('hex').toUpperCase(), objectId: r.object.id,
      soort: s, soortLabel: SOORTEN[s], naam: r.object.naam,
      organisatie: schoon(organisatie, 60) || 'onbekend',
      plekken: Number(plekken) > 0 ? Math.round(Number(plekken)) : null,
      wachtDagen: Number(wachtDagen) >= 0 ? Math.round(Number(wachtDagen)) : null,
      doelgroep: schoon(doelgroep, 80) || null, open: true, door: schoon(wie, 60) || 'kantoor', at: nu() };
    bak().voorzieningen[v.id] = v;
    save();
    return { ok: true, voorziening: publiek(v) };
  }

  function voorzieningZet({ id, plekken, wachtDagen, open, wie }) {
    const v = bak().voorzieningen[String(id || '')];
    if (!v) return { status: 404, error: 'Onbekende voorziening.' };
    if (plekken !== undefined) v.plekken = Number(plekken) >= 0 ? Math.round(Number(plekken)) : v.plekken;
    if (wachtDagen !== undefined) v.wachtDagen = Number(wachtDagen) >= 0 ? Math.round(Number(wachtDagen)) : v.wachtDagen;
    if (open !== undefined) v.open = !!open;
    v.door = schoon(wie, 60) || v.door;
    v.gewijzigdAt = nu();
    save();
    return { ok: true, voorziening: publiek(v) };
  }

  function publiek(v) {
    const o = obj.object(v.objectId);
    return { ...v, plaats: o ? geo.label(o.gebied) : null, lat: o ? o.lat : null, lng: o ? o.lng : null,
      gebied: o ? o.gebied : null, zone: o ? o.zone : null, conditie: o ? o.conditie : null };
  }

  return { voorzieningMaak, voorzieningZet, publiek };
};
