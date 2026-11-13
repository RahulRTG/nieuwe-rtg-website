'use strict';
module.exports = function actionNetwork({ kern, network }) {
  function prepare({ parameters }) {
    const checked = network.selection(parameters);
    if (checked.error) return checked;
    if (!kern.mall || !kern.mall.mallLijsten || !kern.mall.mallLijsten.samenstellen ||
        !kern.mall.mallLijsten.herstelSamenstelling)
      return { status: 503, error: 'Bewaren is tijdelijk niet beschikbaar.' };
    return { parameters: { title: checked.title, choices: checked.choices },
      policy: { decision: 'ALLOW_WITH_CONFIRMATION', policyId: 'policy:own-network-list', version: 'v1',
        reasonCodes: ['OWN_LIST', 'CURRENT_VISIBLE_OFFERS', 'NO_COMMITMENT'] },
      confirmation: { required: true, text: 'Bewaar ' + checked.choices.length + ' onderdelen in “' + checked.title +
        '”. Dit is een persoonlijke lijst; beschikbaarheid, data en betaling bevestigt u bij de aanbieder.' },
      consequence: { changesDomainTruth: true, changesExperienceState: false,
        createsFinancialCommitment: false, reversible: true, notificationSent: false } };
  }
  function execute({ key, preview }) {
    const lijsten = kern.mall && kern.mall.mallLijsten;
    if (!lijsten || !lijsten.samenstellen || !lijsten.herstelSamenstelling)
      return { status: 503, error: 'Bewaren is tijdelijk niet beschikbaar.' };
    const p = preview.parameters;
    const data = { naam: p.title, ids: p.choices.map(c => c.id) };
    // Uitsluitend uit de bewaarde server-preview; nooit een bron uit clientinvoer.
    const bron = { bron: 'experience:' + preview.id, actor: preview.actor,
      revisies: p.choices.map(c => c.revision) };
    let out = lijsten.herstelSamenstelling(key, data, bron);
    if (!out) {
      // Historische ontvangst blijft geldig. Een nieuw effect vereist actuele
      // revisies/zichtbaarheid en daarna de eigen Mall-aanbodcontrole.
      const checked = network.selection(p);
      if (checked.error) return checked;
      out = lijsten.samenstellen(key, data, bron);
    }
    if (out.error) return out;
    const receipt = out.ontvangst;
    return { objectRef: { domain: 'mall', type: 'lijst', id: receipt.id },
      result: { list: { id: receipt.id, title: receipt.naam, count: receipt.aantal },
        destination: '/apps/mijnmall.html', bookingStatus: 'NOT_BOOKED' } };
  }
  return { prepare, execute };
};
