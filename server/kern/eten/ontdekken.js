/* RTG Eten: zoeken, ontdekken en Concierge komen op dezelfde resultaatlaag
   uit. De Concierge zet vrije taal om in zichtbare filters; hij bestelt niets
   en doet bij allergenen nooit een veiligheidsbelofte. */
'use strict';

const woorden = s => String(s || '').toLowerCase().split(/[^a-zà-ÿ0-9€]+/).filter(w => w.length > 1);
const bevat = (tekst, zoek) => zoek.every(w => tekst.includes(w));

function conciergeFilters(vraag, keukens) {
  const q = String(vraag || '').trim().slice(0, 320);
  const laag = q.toLowerCase();
  const bedrag = laag.match(/(?:max(?:imaal)?|onder|tot)\s*€?\s*(\d{1,4})/) || laag.match(/€\s*(\d{1,4})/);
  const personen = laag.match(/(?:voor|met)\s+(\d{1,2})\s*(?:personen|mensen|man|gasten)?/);
  const tijd = laag.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const keuken = (keukens || []).find(k => laag.includes(String(k).toLowerCase())) || null;
  const dieet = [];
  if (/vegetari|zonder vlees/.test(laag)) dieet.push('vegetarisch');
  if (/vegan|plantaardig/.test(laag)) dieet.push('vegan');
  if (/halal/.test(laag)) dieet.push('halal');
  if (/glutenvrij|zonder gluten/.test(laag)) dieet.push('glutenvrij');
  if (/lactosevrij|zonder lactose/.test(laag)) dieet.push('lactosevrij');
  const allergenen = [];
  const bekende = ['noten','pinda','gluten','melk','lactose','ei','vis','schaaldieren','selderij','sesam','soja'];
  for (const a of bekende) if (new RegExp('allerg(?:ie|isch).*' + a + '|zonder\\s+' + a).test(laag)) allergenen.push(a);
  const stop = new Set(['voor','personen','mensen','maximaal','max','euro','rond','tegen','uur','bezorgen','afhalen','graag','zoek','iets','een','met','zonder']);
  const zoek = woorden(laag).filter(w => !stop.has(w) && !/^\d+$/.test(w) && !dieet.includes(w)
    && !allergenen.includes(w) && !(keuken && String(keuken).toLowerCase().includes(w))).slice(0, 8).join(' ');
  return { zoek, keuken, dieet, zonderAllergenen:allergenen,
    budgetCenten:bedrag ? Number(bedrag[1]) * 100 : null,
    personen:personen ? Math.max(1, Math.min(30, Number(personen[1]))) : null,
    tijd:tijd ? String(tijd[1]).padStart(2, '0') + ':' + tijd[2] : null,
    bezorging:/bezorg|thuis|aan de deur/.test(laag) ? true : null,
    menselijkeControle:allergenen.length > 0 };
}

function zoekResultaten({ restaurants, menuVan, favorieten, recent, invoer }) {
  const f = Object.assign({ zoek:'', keuken:'', prijs:'', sorteer:'aanbevolen', alleenOpen:false,
    bezorging:null, maxMinuten:null, dieet:[], zonderAllergenen:[], budgetCenten:null, personen:null }, invoer || {});
  const zoek = woorden(f.zoek);
  const favorietSet = new Set(favorieten || []);
  const recentSet = new Set(recent || []);
  const dieet = (Array.isArray(f.dieet) ? f.dieet : []).map(x => String(x).toLowerCase());
  const zonder = (Array.isArray(f.zonderAllergenen) ? f.zonderAllergenen : []).map(x => String(x).toLowerCase());
  let uit = (restaurants || []).map(z => {
    const menu = (menuVan(z.code) || []).filter(m => !m.uitverkocht);
    const passendeMenu = menu.filter(m => {
      const tags = (m.dieet || []).map(x => String(x).toLowerCase());
      const alg = (m.allergenen || []).map(x => String(x).toLowerCase());
      if (dieet.length && !dieet.every(d => tags.includes(d) || (d === 'vegetarisch' && /vegetar/i.test((m.uitleg || '') + ' ' + m.naam)))) return false;
      if (zonder.length && alg.some(a => zonder.some(x => a.includes(x) || x.includes(a)))) return false;
      if (f.budgetCenten && f.personen && m.centen * f.personen > f.budgetCenten) return false;
      return true;
    });
    const tekstZaak = [z.naam,z.keuken,z.stad,z.tagline,z.bio,(z.categorieen || []).join(' ')].join(' ').toLowerCase();
    const gerechten = passendeMenu.filter(m => bevat([m.naam,m.uitleg,m.cat,(m.ingredienten || []).join(' '),(m.dieet || []).join(' ')].join(' ').toLowerCase(), zoek));
    const treffer = !zoek.length || bevat(tekstZaak, zoek) || gerechten.length > 0;
    let score = (z.open !== false ? 6 : 0) + (z.rating ? Number(z.rating.score) : 0) + Math.min(4, passendeMenu.length / 5);
    if (favorietSet.has(z.code)) score += 12;
    if (recentSet.has(z.code)) score += 8;
    if (zoek.length && gerechten.length) score += 6;
    if (Number(z.bezorgMinuten) <= 30) score += 2;
    return Object.assign({}, z, { favoriet:favorietSet.has(z.code), eerderBesteld:recentSet.has(z.code),
      treffers:gerechten.slice(0, 3).map(m => ({ id:m.id, naam:m.naam, centen:m.centen, cat:m.cat, allergenen:m.allergenen || [] })),
      passendeGerechten:passendeMenu.length, _treffer:treffer, _score:score });
  }).filter(z => z._treffer
    && (!f.keuken || z.keuken === f.keuken)
    && (!f.prijs || z.prijs === f.prijs)
    && (!f.alleenOpen || z.open !== false)
    && (f.bezorging !== true || z.bezorgen)
    && (!Number(f.maxMinuten) || (z.bezorgMinuten && Number(z.bezorgMinuten) <= Number(f.maxMinuten)))
    && (!dieet.length && !zonder.length || z.passendeGerechten > 0));
  if (f.sorteer === 'tijd') uit.sort((a, b) => (a.bezorgMinuten || 999) - (b.bezorgMinuten || 999));
  else if (f.sorteer === 'beoordeling') uit.sort((a, b) => ((b.rating || {}).score || 0) - ((a.rating || {}).score || 0));
  else if (f.sorteer === 'prijs') uit.sort((a, b) => (a.vanafCenten || 999999) - (b.vanafCenten || 999999));
  else uit.sort((a, b) => b._score - a._score || String(a.naam).localeCompare(String(b.naam)));
  uit = uit.map(z => { const x = Object.assign({}, z); delete x._treffer; delete x._score; return x; });
  return { filters:f, restaurants:uit, aantal:uit.length };
}

function ontdekGroepen(restaurants, favorieten, recent) {
  const fav = new Set(favorieten || []), rec = new Set(recent || []);
  const kies = fn => restaurants.filter(fn).slice(0, 8).map(z => z.code);
  return [
    { id:'opnieuw', titel:'Opnieuw bestellen', codes:kies(z => rec.has(z.code)) },
    { id:'favorieten', titel:'Jouw favorieten', codes:kies(z => fav.has(z.code)) },
    { id:'snel', titel:'Snel bezorgd', codes:kies(z => z.bezorgen && z.bezorgOpen && Number(z.bezorgMinuten) <= 30) },
    { id:'populair', titel:'Lokaal populair', codes:[...restaurants].sort((a,b) => ((b.rating || {}).aantal || 0) - ((a.rating || {}).aantal || 0)).slice(0,8).map(z => z.code) },
    { id:'nieuw', titel:'Nieuw bij RTG Eten', codes:kies(z => !z.rating) },
    { id:'premium', titel:'Premium restaurants', codes:kies(z => z.prijs === '€€€' || z.prijs === '€€€€') }
  ].filter(g => g.codes.length);
}

module.exports = { conciergeFilters, zoekResultaten, ontdekGroepen };
