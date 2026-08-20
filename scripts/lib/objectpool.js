/* ============================================================================
   DE OBJECTPOOL -- echte id's oogsten, en er lijven mee verrijken.

   HET GAT DAT DIT DICHT. 1025 routes (de grootste post op BEWIJSSCHULD.json)
   willen een BESTAAND object bedienen: een klus afronden, een order sluiten,
   een dossier openen. De proeven sturen een plausibel lijf met een verzonnen
   id, de route zoekt het object op, vindt het niet, en antwoordt 404 -- juist
   gedrag, en de handler heeft nooit gedraaid. De sluitweg in de schuldpost
   zei "per domein werk, geen generieke truc: een id raden levert dezelfde 404
   op". Dat klopt -- maar OOGSTEN is geen raden. De proeven zien zelf
   duizenden echte antwoorden, en daar staan de echte id's gewoon in. Deze
   pool onthoudt ze per domein, en verrijkt het volgende lijf ermee.

   TWEE REGELS HOUDEN HEM EERLIJK:

   1. ALLEEN UIT EIGEN WAARNEMING. De pool leert uitsluitend uit antwoorden
      die een proef zelf kreeg op de wegwerpserver van die ronde. Geen
      voorgebakken lijst -- id's verschillen per serverstart, en een lijst zou
      binnen een dag stil verouderen.
   2. GEEN DOMEINGRENS OVER. Een klus-id in een order-route geeft dezelfde
      404 en zou de meting alleen maar vertragen. Verrijkt wordt er alleen
      met waarden die in HETZELFDE domein (het tweede padsegment) zijn
      geoogst.

   WAT DE POOL NIET IS: een bewering dat het verrijkte lijf KLOPT. Hij maakt
   routes bereikbaar voor de meting; wat de meting daar vindt, is aan de
   meting. En routes waarvan het object alleen via een eigen keten te maken
   is (een betaling met vier ogen, een goedgekeurde school) blijven buiten
   bereik -- dat is dan een eerlijke rest, geen verstopte.
   ========================================================================== */
'use strict';

/* Een veldnaam die een verwijzing draagt. Bewust smal: een naam als `tekst`
   of `bedrag` mag hier nooit doorheen, anders verrijkt de pool lijven met
   rommel en meet de ronde zijn eigen vervuiling. */
const IDVELD = /^(id|code|sleutel|ref|referentie|nummer|handle|slug|key)$|(Id|Code|Sleutel|Ref|Nummer|Key)$/;

/* Aanvaardbare waarde: een korte scalar. Objecten, lange teksten en lege
   strings dragen geen verwijzing. */
function bruikbaar(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return true;
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && !v.includes('\n');
}

/* Het domein van een pad: het tweede segment (/api/werkplek/klus -> werkplek).
   Dezelfde afbakening als de blindenlijst-groepering gebruikt. */
function domeinVan(pad) {
  return String(pad || '').split('/')[2] || '';
}

/* Enkelvoud-gok voor een lijstveldnaam: klussen -> klus, orders -> order,
   dossiers -> dossier. Bewust simpel (strip -en/-s); een gok die mist kost
   niets, want het veld belandt er dan gewoon niet bij. */
function enkelvoud(naam) {
  const n = String(naam || '');
  if (n.length > 3 && n.endsWith('en')) {
    let e = n.slice(0, -2);
    /* klussen -> kluss -> klus: de verdubbelde slotmedeklinker valt weg. */
    if (e.length > 2 && e[e.length - 1] === e[e.length - 2] && !/[aeiou]/.test(e[e.length - 1])) e = e.slice(0, -1);
    return e;
  }
  if (n.length > 3 && n.endsWith('s')) return n.slice(0, -1);
  return n;
}

function maakPool() {
  /* domein -> veldnaam(lower) -> [waarden] (begrensd, eerste wint: de vroegst
     geoogste id's komen uit de seed en zijn het stabielst). */
  const per = new Map();
  const MAXW = 12;

  function zet(domein, veld, waarde) {
    if (!bruikbaar(waarde)) return;
    const d = per.get(domein) || per.set(domein, new Map()).get(domein);
    const rij = d.get(veld) || d.set(veld, []).get(veld);
    if (rij.length < MAXW && !rij.includes(waarde)) rij.push(waarde);
  }

  /* Oogsten uit een antwoord: id-achtige velden tot vier lagen diep, en van
     elke lijst de eerste drie elementen. De naam van een lijst geeft zijn
     elementen een tweede naam: { klussen: [{ id: K1 }] } leert zowel `id`
     als `klusId` en `klus`. */
  function leer(data, pad) {
    const domein = domeinVan(pad);
    if (!domein) return;
    (function loop(v, diepte, lijstNaam) {
      if (!v || typeof v !== 'object' || diepte > 4) return;
      if (Array.isArray(v)) { for (const el of v.slice(0, 3)) loop(el, diepte + 1, lijstNaam); return; }
      for (const [k, w] of Object.entries(v)) {
        if (IDVELD.test(k) && bruikbaar(w)) {
          zet(domein, k.toLowerCase(), w);
          if (lijstNaam) {
            const enk = enkelvoud(lijstNaam).toLowerCase();
            zet(domein, enk, w);
            zet(domein, enk + 'id', w);
          }
        }
        if (Array.isArray(w)) loop(w, diepte + 1, k);
        else if (w && typeof w === 'object') loop(w, diepte + 1, lijstNaam);
      }
    })(data, 0, null);
  }

  /* Verrijken: het basislijf krijgt voor elk geoogst veld uit HETZELFDE
     domein een echte waarde. Bestaande verzonnen kernvelden (id, code)
     worden overschreven -- die waren juist het probleem. */
  function verrijk(basisLijf, pad) {
    const d = per.get(domeinVan(pad));
    if (!d || !d.size) return { lijf: basisLijf, velden: [] };
    const lijf = { ...basisLijf };
    const velden = [];
    for (const [veld, waarden] of d) {
      lijf[veld] = waarden[0];
      velden.push(veld);
    }
    return { lijf, velden };
  }

  function grootte() {
    let velden = 0;
    for (const d of per.values()) velden += d.size;
    return { domeinen: per.size, velden };
  }

  return { leer, verrijk, grootte };
}

module.exports = { maakPool, domeinVan, enkelvoud, IDVELD };
