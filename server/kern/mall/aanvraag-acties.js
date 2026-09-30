'use strict';
/* De bron bepaalt de levensloop. Interfaces projecteren deze besluiten; de
   routepoort blijft daarnaast sessie, personeelsrechten en schakelaars toetsen.
   Afronden betekent een gedocumenteerd antwoord, nooit een betaalde boeking. */
const DAGEN_GELDIG = 30;
const versie = a => a.versie || 1;
const verlopen = a => a.status === 'open' && Date.now() - Date.parse(a.at) > DAGEN_GELDIG * 86400000;
const eigenaar = a => (a.reacties || []).find(r => r.gekozen);
function padVoor(actor, id) {
  return actor.code ? '/api/supplier/mall/aanvraag/' + (id === 'reageer' ? 'reageer' : 'behandel')
    : '/api/mall/aanvraag/' + id;
}
function acties(a, actor) {
  const ids = [];
  if (actor.key && actor.key === a.key) {
    if (a.status === 'open' && !verlopen(a)) {
      ids.push('wijzig');
      if ((a.reacties || []).some(r => !r.ingetrokken)) ids.push('kies');
    }
    if (['open', 'gegund', 'in_behandeling'].includes(a.status)) ids.push('sluit');
    if (['gesloten', 'afgerond'].includes(a.status) || verlopen(a)) ids.push('heropen');
  } else if (actor.code) {
    if (a.status === 'open' && !verlopen(a) && actor.past) {
      ids.push('reageer');
      if ((a.reacties || []).some(r => r.code === actor.code && !r.ingetrokken)) ids.push('intrekken');
    }
    if (eigenaar(a)?.code === actor.code) {
      if (a.status === 'gegund') ids.push('aanvaard', 'teruggeven');
      if (a.status === 'in_behandeling') ids.push('afronden', 'teruggeven');
    }
  }
  const labels = { wijzig: 'Vraag wijzigen', kies: 'Reactie kiezen', sluit: 'Aanvraag intrekken',
    heropen: 'Opnieuw openen', reageer: 'Reageren', intrekken: 'Reactie intrekken',
    aanvaard: 'In behandeling nemen', teruggeven: 'Teruggeven aan het lid', afronden: 'Antwoord afronden' };
  return ids.filter(id => !actor.beleid || !actor.beleid(padVoor(actor, id)))
    .map(id => ({ id, label: labels[id], versie: versie(a) }));
}
function controle(a, actor, actie, data = {}) {
  if (data.versie !== versie(a))
    return { status: 409, error: 'Deze aanvraag is gewijzigd. Vernieuw en bekijk de huidige stand.' };
  if (!acties(a, actor).some(x => x.id === actie))
    return { status: 409, error: 'Deze handeling is niet meer beschikbaar.' };
  return null;
}
function noteer(a, actor, actie, tekst) {
  a.versie = versie(a) + 1;
  a.bij = new Date().toISOString();
  a.verloop = (a.verloop || []).concat({ versie: a.versie, at: a.bij,
    door: actor.key === a.key ? 'lid' : actor.code, actie, tekst: tekst || null });
}
module.exports = { acties, controle, noteer, versie, verlopen, eigenaar, DAGEN_GELDIG };
