/* Beveiliging-rooster (deelmodule): de AI-autoplanner die open plekken vult
   en de inzetaanvragen van klanten. rooster en zetDienst komen uit de
   planninglaag via de context. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/beveiliging/rooster.js. */
module.exports = (ctx) => {
  const { db, save, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine,
    BEV_FUNCTIES, BEV_SHIFTS, BEV_ERNST, AANVR_KLAAR,
    id, nu, vandaag, schoon, getal, shiftVan, isBeveiliging, defaults, functieAan,
    diensten, aanvragen, incidenten, rondes, guards, guardNaam, postVan, functieLijst, zetPost } = ctx;
  const { rooster, zetDienst } = ctx;
  /* ---- de AI neemt het rooster over: vul de open plekken van een dag ----
     Kiest per open plek een beschikbare bewaker: niet al op die shift, en met
     rust (niet de aangrenzende shift dezelfde dag). Round-robin over het team,
     zodat de uren eerlijk verdeeld worden. */
  const NAAST = { dag: ['nacht', 'avond'], avond: ['dag', 'nacht'], nacht: ['avond', 'dag'] };
  function planAuto(s, datum) {
    if (!functieAan(s, 'autoplan')) return { status: 409, error: 'AI-planning staat uit in uw boardroom.' };
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(String(datum)) ? datum : vandaag();
    const team = guards(s);
    if (!team.length) return { status: 409, error: 'Nog geen beveiligers in het team om in te plannen.' };
    const rst = rooster(s, dag, 1).dagen[0];
    // lopende toewijzing per bewaker die dag (voor rust + eerlijkheid)
    const shiftVanGuard = new Map(); // gid -> Set(shiftId)
    for (const d of diensten().filter(x => x.supplierCode === s.code && x.datum === dag && x.status !== 'geannuleerd')) {
      if (!shiftVanGuard.has(d.guardId)) shiftVanGuard.set(d.guardId, new Set());
      shiftVanGuard.get(d.guardId).add(d.shiftId);
    }
    const urenTeller = new Map(); // gid -> uren deze maand (eerlijk verdelen)
    for (const d of diensten().filter(x => x.supplierCode === s.code && x.datum.slice(0, 7) === dag.slice(0, 7) && x.status !== 'geannuleerd')) {
      urenTeller.set(d.guardId, (urenTeller.get(d.guardId) || 0) + ((shiftVan(d.shiftId) || {}).uren || 0));
    }
    const gemaakt = [];
    let onvervuld = 0;
    for (const post of rst.posten) {
      for (const sl of post.shifts) {
        for (let k = 0; k < sl.open; k++) {
          const kandidaat = team
            .filter(g => {
              const set = shiftVanGuard.get(g.id) || new Set();
              if (set.has(sl.shiftId)) return false;                 // al op deze shift
              for (const nb of (NAAST[sl.shiftId] || [])) if (set.has(nb)) return false; // rust
              return true;
            })
            .sort((a, b2) => (urenTeller.get(a.id) || 0) - (urenTeller.get(b2.id) || 0))[0];
          if (!kandidaat) { onvervuld++; continue; }
          const r = zetDienst(s, { postId: post.postId, shiftId: sl.shiftId, datum: dag, guardId: kandidaat.id });
          if (r.ok) {
            gemaakt.push(r.dienst);
            if (!shiftVanGuard.has(kandidaat.id)) shiftVanGuard.set(kandidaat.id, new Set());
            shiftVanGuard.get(kandidaat.id).add(sl.shiftId);
            urenTeller.set(kandidaat.id, (urenTeller.get(kandidaat.id) || 0) + ((shiftVan(sl.shiftId) || {}).uren || 0));
          } else onvervuld++;
        }
      }
    }
    const uitleg = gemaakt.length
      ? 'De AI vulde ' + gemaakt.length + ' open dienst(en) in op ' + dag + (onvervuld ? ', maar ' + onvervuld + ' plek(ken) bleven open (te weinig beschikbare bewakers, rust bewaakt).' : '. Alle posten gedekt.')
      : (onvervuld ? 'Geen dienst kon ingevuld worden: te weinig beschikbare bewakers met rust tussen de diensten.' : 'Er stonden geen open diensten op ' + dag + '.');
    return { status: 200, ok: true, datum: dag, gemaakt, onvervuld, uitleg };
  }

  /* ---- inzetaanvragen van klanten (en interne extra-mankracht/verlof) ---- */
  function aanvraag(s, data) {
    if (!functieAan(s, 'aanvragen')) return { status: 409, error: 'Aanvragen staan uit in uw boardroom.' };
    const object = schoon(data.object, 80);
    if (!object) return { status: 400, error: 'Geef het object/de locatie.' };
    const datum = String(data.datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Kies een datum.' };
    const sh = shiftVan(String(data.shiftId || 'dag')) || BEV_SHIFTS[0];
    const a = {
      ref: id('AV').toUpperCase(), supplierCode: s.code,
      soort: ['inzet', 'extra', 'verlof'].includes(data.soort) ? data.soort : 'inzet',
      klant: schoon(data.klant, 80) || 'Klant', object,
      datum, shiftId: sh.id, aantal: getal(data.aantal, 1, 50, 1), uren: getal(data.uren, 1, 24, sh.uren),
      tekst: schoon(data.tekst, 400), status: 'nieuw', at: nu(), stappen: [{ status: 'nieuw', at: nu() }]
    };
    aanvragen().unshift(a);
    db.data.bevAanvragen = aanvragen().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '🛡️', title: 'Nieuwe inzetaanvraag', body: a.klant + ' · ' + object + ' · ' + datum + ' · ' + a.aantal + ' bewaker(s)' });
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, aanvraag: a };
  }
  function aanvraagLijst(s) {
    const mijn = aanvragen().filter(a => a.supplierCode === s.code);
    return { open: mijn.filter(a => !AANVR_KLAAR[a.status]), afgerond: mijn.filter(a => AANVR_KLAAR[a.status]).slice(0, 60) };
  }
  /* Een aanvraag inplannen zet er meteen open diensten voor klaar (een post per
     aanvraag; bestaat de post nog niet, dan maken we hem aan) zodat de planner
     of de AI ze kan vullen. */
  function beslisAanvraag(s, ref, actie, opts) {
    opts = opts || {};
    const a = aanvragen().find(x => x.ref === ref && x.supplierCode === s.code);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (AANVR_KLAAR[a.status]) return { status: 409, error: 'Deze aanvraag is al afgerond.' };
    if (actie === 'afwijzen') { a.status = 'afgewezen'; }
    else if (actie === 'plan') {
      const b = defaults(s);
      let post = b.posten.find(p => p.naam.toLowerCase() === a.object.toLowerCase());
      if (!post) { const r = zetPost(s, { naam: a.object, klant: a.klant, minMan: a.aantal, shifts: [a.shiftId] }); post = r.post; }
      // markeer de minMan zodat het rooster de open plekken toont
      post.minMan = Math.max(post.minMan || 1, a.aantal);
      if (!post.shifts.includes(a.shiftId)) post.shifts.push(a.shiftId);
      a.postId = post.id; a.status = 'gepland';
      if (opts.autoPlan !== false && functieAan(s, 'autoplan')) planAuto(s, a.datum);
    } else return { status: 400, error: 'Onbekende actie.' };
    a.stappen.push({ status: a.status, at: nu() });
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, status2: a.status };
  }
  return { planAuto, aanvraag, aanvraagLijst, beslisAanvraag };
};
