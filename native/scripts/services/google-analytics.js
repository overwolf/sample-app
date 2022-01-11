const kGAID = 'UA-144253676-6';

export class GoogleAnalytics {
  _loadGALib() {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = `https://www.google-analytics.com/analytics.js`;
      el.async = true;
      el.onload = resolve;
      el.onerror = reject;
      document.body.appendChild(el);
    });
  }

  _createGA() {
    window.ga = window.ga||function(){(ga.q=ga.q||[]).push(arguments)};ga.l=+new Date;
  }

  start() {
    this._createGA();

    const loadPromise = this._loadGALib();

    window.ga('create', {
      trackingId: kGAID,
      cookieDomain: 'none'
    });

    window.ga('set', 'checkProtocolTask', null);

    return loadPromise;
  }

  ga(...args) {
    if (window.ga) {
      return window.ga(...args);
    }
  }
}
