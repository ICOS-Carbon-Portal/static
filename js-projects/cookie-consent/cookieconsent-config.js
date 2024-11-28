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
						_paq.push(['setCookieConsentGiven']);
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
							title: 'More information',
							description: 'For any queries in relation to our policy on cookies and your choices, please <a href="https://www.icos-cp.eu/about/contact">contact us</a>'
						}
					]
				}
			}
		}
	}
});