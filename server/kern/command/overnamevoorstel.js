/* OVERNAME, stap 2: welk veld van hen is welk veld van ons?

   DIT WORDT GEMETEN EN NIET GERADEN, maar het blijft een VERMOEDEN -- en dat
   verschil is hier het hele punt. Uit hun eigen rijen valt af te lezen welk
   veld overal gevuld en overal uniek is (dat gedraagt zich als een sleutel) en
   welk veld de langste tekst draagt (dat gedraagt zich als een naam). Wat er
   NIET uit valt af te lezen is of dat ook is wat zij ermee bedoelden.

   Daarom stelt deze module voor en beslist hij niets. Een afbeelding die de
   machine zelf vaststelt, importeert vroeg of laat de verkeerde kolom, en dan
   staat er een administratie in die er goed uitziet en niet klopt. */
'use strict';

function voorstel(o, register, s) {
  if (!o) return { error: 'Die partij bestaat niet.', status: 404 };
  const k = register.OP_TYPE.get(o.soort);
  const velden = new Map();
  for (const r of o.rijen) {
    if (!r || typeof r !== 'object') continue;
    for (const [veld, w] of Object.entries(r)) {
      if (w == null || typeof w === 'object') continue;
      if (!velden.has(veld)) velden.set(veld, { gevuld: 0, waarden: new Set(), lengte: 0 });
      const v = velden.get(veld);
      v.gevuld++; v.waarden.add(s(w)); v.lengte += s(w).length;
    }
  }
  const lijst = [...velden.entries()].map(([veld, v]) => ({
    veld, gevuld: v.gevuld,
    uniek: v.waarden.size === v.gevuld && v.gevuld === o.rijen.length,
    gemiddeldeLengte: v.gevuld ? Math.round(v.lengte / v.gevuld) : 0
  }));
  const sleutel = lijst.find(v => v.uniek);
  const naam = lijst.filter(v => !sleutel || v.veld !== sleutel.veld)
    .sort((a, b) => b.gemiddeldeLengte - a.gemiddeldeLengte)[0];
  return {
    partij: o.id, soort: o.soort, onzeSleutel: k.sleutel, hunVelden: lijst,
    voorstel: { [k.sleutel]: sleutel ? sleutel.veld : null },
    vermoeden: naam ? naam.veld + ' lijkt de naam te dragen' : null,
    let: 'dit is een VERMOEDEN uit hun eigen rijen en geen vaststelling. Bevestig de afbeelding; ' +
      'een machine die zelf besluit welke kolom de sleutel is, importeert vroeg of laat de verkeerde.'
  };
}

module.exports = { voorstel };
