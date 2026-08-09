/* Wie mag bezorgen, en wie bezorgt er NU -- als pure functies.

   Deze regel stond in kern/leverancier/zaak.js en werd daar gebruikt om het
   bezorgblok in het leveranciersscherm te tonen. De Mall wil er iets anders
   mee: hij wil kunnen filteren op "wat kan bij mij bezorgd worden". Datzelfde
   antwoord op twee plekken uitrekenen is hoe je een zaak in het ene scherm wel
   en in het andere niet ziet bezorgen (LAT-regel 4), dus staat hij hier een
   keer.

   TWEE VRAGEN, NIET EEN:
     magBezorgen  -- mag deze zaak uberhaupt een ophaal/bezorgdienst voeren?
                     Horeca (orders-caps) en zelfstandigen; hotels en vervoer
                     hebben hun eigen kanalen al.
     bezorgtNu    -- staat die dienst op dit moment aan, en bezorgt zij ook
                     echt (in plaats van alleen laten ophalen)?

   De Mall heeft de tweede nodig. Een zaak die MAG bezorgen maar de schakelaar
   uit heeft staan, hoort niet in een bezorgfilter te verschijnen: dan stuurt
   de Mall iemand op een bezorging af die er niet komt. */

function magBezorgen(db, s) {
  if (!s) return false;
  const caps = typeof db.capsVan === 'function' ? (db.capsVan(s) || []) : [];
  return caps.includes('orders') || s.type === 'zzp';
}

function bezorgtNu(db, s) {
  if (!magBezorgen(db, s)) return false;
  const b = s.bezorg;
  return !!(b && b.aan && b.bezorgen !== false);
}

module.exports = { magBezorgen, bezorgtNu };
