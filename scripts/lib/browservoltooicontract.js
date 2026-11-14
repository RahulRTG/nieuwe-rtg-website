'use strict';

/* Pure koppeling tussen een gedeclareerd browserscenario en de feitelijk
   waargenomen browsertaak. Bestandslezing blijft geïnjecteerd: deze module
   trekt geen meet- of versheidsmotor de browserrunner in. */
function browserHerstartKoppeling(bewijs, schakels, herstarts) {
  if (!herstarts || !Number.isInteger(herstarts.netjes) || herstarts.netjes < 0 ||
      !Number.isInteger(herstarts.crash) || herstarts.crash < 0)
    return 'browserresultaat draagt geen geldige uiteindelijke herstarttellers';
  let vorige = { netjes: 0, crash: 0 };
  for (const schakel of schakels) {
    const voor = schakel?.herstartsVoor;
    if (!voor || !Number.isInteger(voor.netjes) || voor.netjes < 0 ||
        !Number.isInteger(voor.crash) || voor.crash < 0)
      return 'browserresultaat draagt geen geldige herstartsnapshot voor ' + bewijs;
    if (voor.netjes > herstarts.netjes || voor.crash > herstarts.crash)
      return 'browserresultaat draagt een herstartsnapshot uit de toekomst voor ' + bewijs;
    if (voor.netjes < vorige.netjes || voor.crash < vorige.crash)
      return 'browserresultaat draagt een teruglopende herstartsnapshot voor ' + bewijs;
    vorige = voor;
  }
  if (bewijs === 'persistent' && !schakels.some(s => s.stand === 'gesloten' && s.herstartsVoor.netjes > 0))
    return 'browserresultaat voor persistent bevat geen geslaagde stap na een nette herstart';
  if (bewijs === 'herstelbaar' && !schakels.some(s => s.stand === 'gesloten' && s.herstartsVoor.crash > 0))
    return 'browserresultaat voor herstelbaar bevat geen geslaagde stap na een crash';
  return null;
}

function browserKoppeling(functie, ingang, c, bron, lees, bewijs = null) {
  const pad = waarde => {
    if (typeof waarde !== 'string' || !waarde.startsWith('/') || waarde.startsWith('//') || /[\\#\s]/.test(waarde)) return false;
    try { const u = new URL(waarde, 'https://rtg.invalid'); return u.origin === 'https://rtg.invalid' && u.pathname + u.search === waarde; }
    catch (_) { return false; }
  };
  const scherm = bron.scherm;
  if (!scherm || !pad(scherm.ingang) || !Array.isArray(scherm.bestemmingen) || !scherm.bestemmingen.every(pad) ||
      typeof scherm.toestand !== 'string' || !scherm.toestand.trim()) return { fout: 'ongeldig browser-schermcontract' };
  const feitelijkeIngang = typeof ingang === 'string' && ingang.startsWith('/') ? ingang : c.ingang;
  if (feitelijkeIngang !== scherm.ingang || (c.ingang && c.ingang !== scherm.ingang)) return { fout: 'browsercontract hoort bij een andere ingang' };
  if (typeof bron.instrument !== 'string' || !lees(bron.instrument)) return { fout: 'browserscenario ontbreekt' };
  const tekst = lees(bron.register);
  let reg;
  try { reg = JSON.parse(tekst); } catch (_) { return { fout: 'browserregister ontbreekt of is onleesbaar' }; }
  const app = reg?.apps?.[functie], b = app?.browser;
  if (reg?.stempel?.instrument !== 'scripts/voltooiproef.js' || app?.scenario !== bron.instrument ||
      app?.kanaal !== 'browser' || app?.ingang !== scherm.ingang || b?.ingang !== scherm.ingang || app?.afgebroken)
    return { fout: 'browserresultaat hoort niet bij dezelfde voltooiproef, ingang en scenario, of brak af' };
  if (!Array.isArray(b.bezocht) || !b.bezocht.every(pad) ||
      ![scherm.ingang, ...scherm.bestemmingen].every(p => b.bezocht.includes(p)))
    return { fout: 'niet alle verplichte browserbestemmingen zijn waargenomen' };
  if (!Array.isArray(b.toestanden) || !b.toestanden.every(t => t && pad(t.pad) && b.bezocht.includes(t.pad) &&
      typeof t.selector === 'string' && !!t.selector.trim() && t.zichtbaar === true) ||
      !b.toestanden.some(t => t.pad === scherm.ingang && t.selector === scherm.toestand))
    return { fout: 'de verplichte zichtbare toestand op de browseringang ontbreekt' };
  if (!Array.isArray(b.fouten) || !Array.isArray(b.documentfouten)) return { fout: 'browserfoutwaarneming ontbreekt' };
  if (bewijs) {
    const deel = app[bewijs], schakels = deel?.schakels;
    if (!deel || !Array.isArray(schakels) || schakels.length < 3)
      return { fout: 'browserresultaat draagt minder dan drie schakels voor ' + bewijs };
    const telling = deel.telling;
    const geteld = { gesloten: 0, open: 0, stuk: 0 };
    for (const schakel of schakels) {
      if (!schakel || !Object.hasOwn(geteld, schakel.stand))
        return { fout: 'browserresultaat draagt een ongeldige schakel voor ' + bewijs };
      geteld[schakel.stand]++;
    }
    const herstartFout = browserHerstartKoppeling(bewijs, schakels, app.herstarts);
    if (herstartFout) return { fout: herstartFout };
    const hoortTeSluiten = geteld.gesloten === schakels.length;
    if (!telling || telling.schakels !== schakels.length ||
        telling.gesloten !== geteld.gesloten || telling.open !== geteld.open || telling.stuk !== geteld.stuk ||
        deel.sluit !== hoortTeSluiten)
      return { fout: 'browserresultaat draagt een tegenstrijdige telling voor ' + bewijs };
  }
  return { tekst, scherm, defect: b.fouten.length + b.documentfouten.length };
}

module.exports = { browserKoppeling, browserHerstartKoppeling };
