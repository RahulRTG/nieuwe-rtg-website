/* Runtime-zekeringen bovenop de lokale betaal-sandboxes. AAN kan uitsluitend
   als de bijbehorende veilige startconfiguratie bestaat; productie blijft dicht. */
'use strict';

module.exports = ({ connectGeconfigureerd, sepaGeconfigureerd }) => {
  let connectAan = !!connectGeconfigureerd;
  let sepaAan = !!sepaGeconfigureerd;

  function zet(kanaal, aan) {
    if (process.env.NODE_ENV === 'production')
      return { ok: false, code: 'SANDBOX_PRODUCTIE', error: 'Een lokale sandbox kan niet in productie worden geschakeld.' };
    if (kanaal === 'connect') {
      if (aan && !connectGeconfigureerd)
        return { ok: false, code: 'CONNECT_SANDBOX_NIET_INGERICHT', error: 'Zet STRIPE_CONNECT_SANDBOX=1 bij de lokale start.' };
      connectAan = !!aan;
      return { ok: true, aan: connectAan };
    }
    if (kanaal === 'sepa') {
      if (aan && !sepaGeconfigureerd)
        return { ok: false, code: 'SEPA_SANDBOX_NIET_INGERICHT', error: 'Zet SEPA_SANDBOX=1 bij de lokale start.' };
      sepaAan = !!aan;
      return { ok: true, aan: sepaAan };
    }
    return { ok: false, code: 'KANAAL_ONBEKEND', error: 'Onbekende betaalrail.' };
  }

  const stand = () => ({
    connect: { geconfigureerd: !!connectGeconfigureerd, aan: connectAan, live: false },
    sepa: { geconfigureerd: !!sepaGeconfigureerd, aan: sepaAan, live: false }
  });
  return {
    zet, stand,
    get connectAan() { return connectAan; }, get sepaAan() { return sepaAan; },
    connectGeconfigureerd: !!connectGeconfigureerd, sepaGeconfigureerd: !!sepaGeconfigureerd
  };
};
