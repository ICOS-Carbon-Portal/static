import 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.umd.js';

CookieConsent.run({

	cookie: {
		domain: '.icos-cp.eu',
	},

	categories: {
		necessary: {
			enabled: true,  // this category is enabled by default
			readOnly: true  // this category cannot be disabled
		},
		analytics: {
			services: {
				matomo: {
					label: 'Matomo',
					onAccept: () => {
						let waitingTime = 0;
						function acceptMatomo() {
							if (typeof _paq === "undefined") {
								waitingTime += 250;
								if (waitingTime > 10000) {
									clearInterval(acceptRetry);
								}
							} else {
								clearInterval(acceptRetry);
								_paq.push(['setCookieConsentGiven']);
								_paq.push(['rememberCookieConsentGiven']);
							}
						}
						const acceptRetry = setInterval(acceptMatomo, 250);
					},
					onReject: () => {
						let waitingTime = 0;
						function rejectMatomo() {
							if (typeof _paq === "undefined") {
								waitingTime += 250;
								if (waitingTime > 10000) {
									clearInterval(rejectRetry);
								}
							} else {
								clearInterval(rejectRetry);
								_paq.push(['forgetCookieConsentGiven']);  
								_paq.push(['deleteCookies']);
							}
						}
						const rejectRetry = setInterval(rejectMatomo, 250);
					}
				}
			}
		},
		functional: {
			services: {
				freshdesk: {
					label: 'Freshdesk',
					onAccept: () => {
						if (window.fwSettings) {
							CookieConsent.loadScript('https://euc-widget.freshworks.com/widgets/101000001800.js');
						}
					}
				}
			}
		}
	},

	language: {
		default: 'en',
		translations: {
			en: {
				consentModal: {
					title: 'We use cookies',
					description: 'We have one to keep connected to your account once you log in and another to better understand how to improve our website.',
					acceptAllBtn: 'Accept all',
					acceptNecessaryBtn: 'Reject all',
					showPreferencesBtn: 'Manage Individual preferences',
					footer: '<a href="https://www.icos-cp.eu/privacy" target="_blank">Privacy Policy</a>'
				},
				preferencesModal: {
					title: 'Manage cookie preferences',
					acceptAllBtn: 'Accept all',
					acceptNecessaryBtn: 'Reject all',
					savePreferencesBtn: 'Accept current selection',
					closeIconLabel: 'Close modal',
					sections: [
						{
							title: 'Strictly Necessary cookies',
							description: 'Once you create an account and log in to it, we use a cookie to keep you connected. This cookie is essential for the proper functioning of the website and cannot be disabled.',
							linkedCategory: 'necessary'
						},
						{
							title: 'Performance and Analytics',
							description: 'These cookies collect information about how you use our website. All of the data is anonymized and cannot be used to identify you.',
							linkedCategory: 'analytics'
						},
						{
							title: 'Functional',
							description: 'These cookies make it possible to use Freshdesk, a service we use to answer your questions.',
							linkedCategory: 'functional'
						},
						{
							title: 'More information',
							description: 'For any queries in relation to our policy on cookies and your choices, please <a href="https://www.icos-cp.eu/about/contact">contact us</a>'
						}
					]
				}
			}
		}
	}
});