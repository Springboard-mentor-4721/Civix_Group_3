import { Injectable } from '@angular/core';

export type SupportedLanguage = 'English' | 'Hindi' | 'Odia' | 'Bengali' | 'Spanish';

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  English: {
    // Nav
    'nav.petitions': 'Petitions',
    'nav.polls': 'Polls & Ballots',
    'nav.officials': 'Officials Directory',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',

    // Dashboard & Topbar
    'topbar.welcome': 'Civic Operations Center',
    'topbar.sign_out': 'Sign Out',
    'topbar.search_placeholder': 'Search petitions, polls, location...',
    'topbar.official_portal': 'OFFICIAL PORTAL',

    // Action buttons
    'btn.save_settings': 'Save Settings',
    'btn.reset_settings': 'Reset Defaults',
    'btn.start_tour': 'Start App Tour',
    'btn.reset_pwd': 'Reset Password',
    'btn.request_erasure': 'Request Erasure',
    'btn.create_petition': 'Create Petition',
    'btn.inspect_respond': 'Inspect & Respond',
    'btn.sign_petition': 'Sign Petition',
    'btn.publish_response': 'Publish Response',
    'btn.clear_filters': 'Clear Filters',

    // Settings Tabs
    'tab.profile': 'Profile & Identity',
    'tab.notifications': 'Notifications',
    'tab.appearance': 'Appearance',
    'tab.locality': 'Locality Sync',
    'tab.privacy': 'Privacy & Security',

    // Profile Section
    'profile.title': 'Profile Information',
    'profile.subtitle': 'Manage your verified public identity and preferred language settings.',
    'profile.full_name': 'Full Display Name',
    'profile.phone': 'Contact Phone Number',
    'profile.pref_lang': 'Preferred Language',
    'profile.locked': 'Locked Verified',

    // Notifications Section
    'notif.title': 'Notification Preferences',
    'notif.subtitle': 'Configure automated email updates, browser push notifications, and sound effects.',
    'notif.petition_updates': 'Email Petition Progress Updates',
    'notif.petition_updates_desc': 'Receive instant emails when petitions you signed reach milestone signature goals.',
    'notif.official_alerts': 'Official Municipal Response Alerts',
    'notif.official_alerts_desc': 'Get notified when local council representatives respond to your petitions.',
    'notif.push': 'Browser Push Notifications',
    'notif.push_desc': 'Enable real-time pop-up alerts on desktop for urgent community updates.',
    'notif.weekly_digest': 'Weekly Civic Digest',
    'notif.digest_desc': 'A concise summary email every Monday highlighting top constituency petitions.',
    'notif.sounds': 'UI Sound Effects',
    'notif.sounds_desc': 'Play subtle audio tones when signing petitions or updating configurations.',

    // Appearance Section
    'app.title': 'Appearance & Typography',
    'app.subtitle': 'Customize system font family, text scaling, theme palette, and motion effects.',
    'app.font_family': 'Typography Font Family',
    'app.font_family_help': 'Applies font across the platform interface dynamically.',
    'app.color_theme': 'Color Theme Palette',
    'app.text_scale': 'Interface Text Scaling',
    'app.compact_list': 'Default Compact List View in Directory',
    'app.compact_list_desc': 'Open the petition directory in compact list row mode instead of grid cards.',
    'app.motion': 'Enable Motion Transitions & Animations',
    'app.motion_desc': 'Play smooth micro-animations across cards, progress bars, and tabs.',

    // Locality Section
    'loc.title': 'Locality & Municipal Sync',
    'loc.subtitle': 'Configure jurisdiction routing, GPS auto-detection, and hazard emergency alerts.',
    'loc.jurisdiction': 'Primary Constituency / Ward Jurisdiction',
    'loc.jurisdiction_help': 'Determines which municipal council officers receive your petitions.',
    'loc.auto_gps': 'Auto-Detect Geolocation on Login',
    'loc.auto_gps_desc': 'Use browser location services to automatically update your active ward.',
    'loc.emergency': 'Critical Emergency & Hazard Broadcasts',
    'loc.emergency_desc': 'Receive urgent municipal weather, infrastructure, and safety hazard alerts.',
    'loc.analytics': 'Anonymous Civic Analytics Contribution',
    'loc.analytics_desc': 'Share anonymized locality activity metrics to help improve municipal service allocation.',

    // Danger Zone
    'danger.title': 'Danger Zone & Security Actions',
    'danger.subtitle': 'Critical account security controls, password reset via email, and app walkthrough tour.',
    'danger.pwd_title': 'Reset Account Password via Email',
    'danger.pwd_desc': 'Send password reset verification link to your email.',
    'danger.tour_title': 'Interactive Platform Tour',
    'danger.tour_desc': 'Launch the CIVIX platform walkthrough splash tour.',
    'danger.erasure_title': 'Request Account Data Erasure',
    'danger.erasure_desc': 'Submit a formal request to municipal IT to erase profile data.'
  },
  Hindi: {
    // Nav
    'nav.petitions': 'याचिकाएं (Petitions)',
    'nav.polls': 'मतदान और मतपत्र (Polls)',
    'nav.officials': 'अधिकारी निर्देशिका (Officials)',
    'nav.analytics': 'विश्लेषण (Analytics)',
    'nav.settings': 'सेटिंग्स (Settings)',

    // Dashboard & Topbar
    'topbar.welcome': 'नागरिक संचालन केंद्र',
    'topbar.sign_out': 'साइन आउट करें',
    'topbar.search_placeholder': 'याचिकाएं, मतदान, स्थान खोजें...',
    'topbar.official_portal': 'आधिकारिक पोर्टल',

    // Action buttons
    'btn.save_settings': 'सेटिंग्स सहेजें',
    'btn.reset_settings': 'डिफ़ॉल्ट रीसेट करें',
    'btn.start_tour': 'टूर शुरू करें',
    'btn.reset_pwd': 'पासवर्ड रीसेट करें',
    'btn.request_erasure': 'डेटा हटाएं',
    'btn.create_petition': 'याचिका बनाएं',
    'btn.inspect_respond': 'निरीक्षण और उत्तर दें',
    'btn.sign_petition': 'याचिका पर हस्ताक्षर करें',
    'btn.publish_response': 'उत्तर प्रकाशित करें',
    'btn.clear_filters': 'फ़िल्टर हटाएं',

    // Settings Tabs
    'tab.profile': 'प्रोफ़ाइल और पहचान',
    'tab.notifications': 'सूचनाएं (Notifications)',
    'tab.appearance': 'दिखावट (Appearance)',
    'tab.locality': 'क्षेत्र और सिंक (Locality)',
    'tab.privacy': 'सुरक्षा और गोपनीयता',

    // Profile Section
    'profile.title': 'प्रोफ़ाइल जानकारी',
    'profile.subtitle': 'अपनी सत्यापित पहचान और पसंदीदा भाषा प्रबंधित करें।',
    'profile.full_name': 'पूरा नाम',
    'profile.phone': 'संपर्क फोन नंबर',
    'profile.pref_lang': 'पसंदीदा भाषा (Preferred Language)',
    'profile.locked': 'सत्यापित लॉक',

    // Notifications Section
    'notif.title': 'सूचना प्राथमिकताएं',
    'notif.subtitle': 'स्वचालित ईमेल अपडेट, ब्राउज़र पुश अलर्ट कॉन्फ़िगर करें।',
    'notif.petition_updates': 'ईमेल याचिका प्रगति अपडेट',
    'notif.petition_updates_desc': 'आपके द्वारा हस्ताक्षरित याचिकाओं के लक्ष्य तक पहुंचने पर तुरंत ईमेल प्राप्त करें।',
    'notif.official_alerts': 'नगर परिषद उत्तर अलर्ट',
    'notif.official_alerts_desc': 'स्थानीय अधिकारियों द्वारा उत्तर दिए जाने पर सूचना प्राप्त करें।',
    'notif.push': 'ब्राउज़र पुश सूचनाएं',
    'notif.push_desc': 'तत्काल सामुदायिक अपडेट के लिए डेस्कटॉप अलर्ट सक्षम करें।',
    'notif.weekly_digest': 'साप्ताहिक नागरिक डाइजेस्ट',
    'notif.digest_desc': 'हर सोमवार शीर्ष याचिकाओं का संक्षिप्त ईमेल सारांश।',
    'notif.sounds': 'ध्वनि प्रभाव (Sound Effects)',
    'notif.sounds_desc': 'हस्ताक्षर या कॉन्फ़िगरेशन अपडेट करते समय सूक्ष्म ऑडियो सुनें।',

    // Appearance Section
    'app.title': 'दिखावट और फ़ॉन्ट',
    'app.subtitle': 'सिस्टम फ़ॉन्ट, टेक्स्ट आकार और थीम स्टाइल अनुकूलित करें।',
    'app.font_family': 'फ़ॉन्ट परिवार (Typography Font)',
    'app.font_family_help': 'पूरे प्लेटफॉर्म इंटरफेस पर तुरंत फ़ॉन्ट लागू करता है।',
    'app.color_theme': 'कलर थीम पैलेट',
    'app.text_scale': 'इंटरफ़ेस टेक्स्ट आकार',
    'app.compact_list': 'निर्देशिका में डिफ़ॉल्ट कॉम्पैक्ट सूची दृश्य',
    'app.compact_list_desc': 'कार्ड के बजाय सूची पंक्तियों में याचिकाएं खोलें।',
    'app.motion': 'एनिमेशन और ट्रांज़िशन सक्षम करें',
    'app.motion_desc': 'कार्ड और प्रगति बार में सुचारू एनिमेशन चलाएं।',

    // Locality Section
    'loc.title': 'क्षेत्र और नगर पालिका सिंक',
    'loc.subtitle': 'क्षेत्राधिकार रूटिंग और जीपीएस स्वचालित पहचान कॉन्फ़िगर करें।',
    'loc.jurisdiction': 'प्राथमिक निर्वाचन क्षेत्र / वार्ड क्षेत्राधिकार',
    'loc.jurisdiction_help': 'यह निर्धारित करता है कि आपकी याचिकाएं किस नगर अधिकारी को प्राप्त होती हैं।',
    'loc.auto_gps': 'लॉगिन पर जीपीएस स्थान पहचानें',
    'loc.auto_gps_desc': 'अपने सक्रिय वार्ड को स्वचालित रूप से अपडेट करने के लिए स्थान सेवाओं का उपयोग करें।',
    'loc.emergency': 'आपातकालीन और खतरा अलर्ट',
    'loc.emergency_desc': 'ज़रूरी नगर निगम मौसम और सुरक्षा अलर्ट प्राप्त करें।',
    'loc.analytics': 'नागरिक विश्लेषण योगदान',
    'loc.analytics_desc': 'सेवा आवंटन में सुधार के लिए अनाम गतिविधि मेट्रिक्स साझा करें।',

    // Danger Zone
    'danger.title': 'सुरक्षा और कार्रवाई',
    'danger.subtitle': 'खाता सुरक्षा नियंत्रण और पासवर्ड रीसेट।',
    'danger.pwd_title': 'ईमेल द्वारा पासवर्ड रीसेट करें',
    'danger.pwd_desc': 'अपने ईमेल पर पासवर्ड रीसेट लिंक भेजें।',
    'danger.tour_title': 'इंटरएक्टिव प्लेटफॉर्म टूर',
    'danger.tour_desc': 'प्लेटफॉर्म वॉकथ्रू गाइड चालू करें।',
    'danger.erasure_title': 'खाता डेटा हटाने का अनुरोध',
    'danger.erasure_desc': 'प्रोफ़ाइल डेटा हटाने के लिए औपचारिक अनुरोध दर्ज करें।'
  },
  Odia: {
    // Nav
    'nav.petitions': 'ଆବେଦନ ସମୂହ (Petitions)',
    'nav.polls': 'ଭୋଟ୍ ଏବଂ ମତଦାନ (Polls)',
    'nav.officials': 'ଅଧିକାରୀ ଡିରେକ୍ଟୋରୀ (Officials)',
    'nav.analytics': 'ବିଶ୍ଳେଷଣ (Analytics)',
    'nav.settings': 'ସେଟିଂସ (Settings)',

    // Dashboard & Topbar
    'topbar.welcome': 'ନାଗରିକ ପରିଚାଳନା କେନ୍ଦ୍ର',
    'topbar.sign_out': 'ସାଇନ୍ ଆଉଟ୍ କରନ୍ତୁ',
    'topbar.search_placeholder': 'ଆବେଦନ, ଭୋଟ୍, ସ୍ଥାନ ଖୋଜନ୍ତୁ...',
    'topbar.official_portal': 'ଅଫିସିଆଲ୍ ପୋର୍ଟାଲ୍',

    // Action buttons
    'btn.save_settings': 'ସେଟିଂସ ସଂରକ୍ଷଣ କରନ୍ତୁ',
    'btn.reset_settings': 'ପୂର୍ବବତ୍ କରନ୍ତୁ',
    'btn.start_tour': 'ଗାଇଡ୍ ଟୁର୍ ଆରମ୍ଭ କରନ୍ତୁ',
    'btn.reset_pwd': 'ପାସୱାର୍ଡ ରିସେଟ୍ କରନ୍ତୁ',
    'btn.request_erasure': 'ତଥ୍ୟ ହଟାନ୍ତୁ',
    'btn.create_petition': 'ନୂଆ ଆବେଦନ ତିଆରି କରନ୍ତୁ',
    'btn.inspect_respond': 'ସମୀକ୍ଷା ଏବଂ ଉତ୍ତର ଦିଅନ୍ତୁ',
    'btn.sign_petition': 'ଦସ୍ତଖତ କରନ୍ତୁ',
    'btn.publish_response': 'ଉତ୍ତର ପ୍ରକାଶ କରନ୍ତୁ',
    'btn.clear_filters': 'ଫିଲ୍ଟର୍ ହଟାନ୍ତୁ',

    // Settings Tabs
    'tab.profile': 'ପ୍ରୋଫାଇଲ୍ ଏବଂ ପରିଚୟ',
    'tab.notifications': 'ବିଜ୍ଞପ୍ତି (Notifications)',
    'tab.appearance': 'ରୂପରେଖ (Appearance)',
    'tab.locality': 'ଅଞ୍ଚଳ ଏବଂ ସିଙ୍କ (Locality)',
    'tab.privacy': 'ସୁରକ୍ଷା ଏବଂ ଗୋପନୀୟତା',

    // Profile Section
    'profile.title': 'ପ୍ରୋଫାଇଲ୍ ତଥ୍ୟ',
    'profile.subtitle': 'ଆପଣଙ୍କ ପରିଚୟ ଏବଂ ପସନ୍ଦର ଭାଷା ପରିଚାଳନା କରନ୍ତୁ।',
    'profile.full_name': 'ପୂର୍ଣ୍ଣ ନାମ',
    'profile.phone': 'ଯୋଗାଯୋଗ ଫୋନ୍ ନମ୍ବର',
    'profile.pref_lang': 'ପସନ୍ଦର ଭାଷା (Preferred Language)',
    'profile.locked': 'ଯାଞ୍ଚ ହୋଇଥିବା ଲକ୍',

    // Notifications Section
    'notif.title': 'ବିଜ୍ଞପ୍ତି ପସନ୍ଦ',
    'notif.subtitle': 'ସ୍ୱୟଂଚାଳିତ ଇମେଲ୍ ଅପଡେଟ୍ ଏବଂ ପୁଶ୍ ନୋଟିଫିକେସନ୍ ସେଟ୍ କରନ୍ତୁ।',
    'notif.petition_updates': 'ଆବେଦନ ଅଗ୍ରଗତି ଇମେଲ୍',
    'notif.petition_updates_desc': 'ଆପଣ ଦସ୍ତଖତ କରିଥିବା ଆବେଦନ ଲକ୍ଷ୍ୟରେ ପହଞ୍ଚିଲେ ସୂଚନା ପାଆନ୍ତୁ।',
    'notif.official_alerts': 'ଅଫିସିଆଲ୍ ଉତ୍ତର ଆଲର୍ଟ',
    'notif.official_alerts_desc': 'ସ୍ଥାନୀୟ ଅଧିକାରୀ ଉତ୍ତର ଦେଲେ ସୂଚନା ପାଆନ୍ତୁ।',
    'notif.push': 'ବ୍ରାଉଜର ପୁଶ୍ ନୋଟିଫିକେସନ୍',
    'notif.push_desc': 'ଜରୁରୀ ସୂଚନା ପାଇଁ ପପ୍-ଅପ୍ ଆଲର୍ଟ ସକ୍ଷମ କରନ୍ତୁ।',
    'notif.weekly_digest': 'ସାପ୍ତାହିକ ନାଗରିକ ରିପୋର୍ଟ',
    'notif.digest_desc': 'ପ୍ରତି ସୋମବାର ଶୀର୍ଷ ଆବେଦନଗୁଡ଼ିକର ଇମେଲ୍ ସାରାଂଶ।',
    'notif.sounds': 'ଶବ୍ଦ ପ୍ରଭାବ (Sound Effects)',
    'notif.sounds_desc': 'ଦସ୍ତଖତ କିମ୍ବା ସେଟିଂସ ବଦଳାଇବା ସମୟରେ ଶବ୍ଦ ଶୁଣନ୍ତୁ।',

    // Appearance Section
    'app.title': 'ରୂପରେଖ ଏବଂ ଫଣ୍ଟ',
    'app.subtitle': 'ଫଣ୍ଟ ଷ୍ଟାଇଲ୍, ଟେକ୍ସଟ୍ ଆକାର ଏବଂ ଥିମ୍ ପସନ୍ଦ କରନ୍ତୁ।',
    'app.font_family': 'ଫଣ୍ଟ ପରିବାର (Typography Font)',
    'app.font_family_help': 'ସମ୍ପୂର୍ଣ୍ଣ ଆପ୍-ରେ ଫଣ୍ଟ ପ୍ରୟୋଗ ହୁଏ।',
    'app.color_theme': 'କଲର୍ ଥିମ୍',
    'app.text_scale': 'ଟେକ୍ସଟ୍ ଆକାର',
    'app.compact_list': 'ତାଲିକା ଭ୍ୟୁ ସକ୍ଷମ କରନ୍ତୁ',
    'app.compact_list_desc': 'କାର୍ଡ ପରିବର୍ତ୍ତେ ଧାଡ଼ି ଆକାରରେ ଆବେଦନଗୁଡ଼ିକ ଦେଖନ୍ତୁ।',
    'app.motion': 'ଆନିମେସନ୍ ସକ୍ଷମ କରନ୍ତୁ',
    'app.motion_desc': 'ମସୃଣ ଆନିମେସନ୍ ପ୍ରଭାବ ସକ୍ଷମ କରନ୍ତୁ।',

    // Locality Section
    'loc.title': 'ଅଞ୍ଚଳ ଏବଂ ସିଙ୍କ',
    'loc.subtitle': 'ୱାର୍ଡ ସୀମା ଏବଂ ଜିପିଏସ୍ ସ୍ଥାନ ସେଟ୍ କରନ୍ତୁ।',
    'loc.jurisdiction': 'ମୁଖ୍ୟ ନିର୍ବାଚନ ମଣ୍ଡଳୀ / ୱାର୍ଡ',
    'loc.jurisdiction_help': 'କେଉଁ ସୌର ଅଧିକାରୀ ଆପଣଙ୍କ ଆବେଦନ ପାଇବେ ତାହା ନିର୍ଦ୍ଧାରଣ କରେ।',
    'loc.auto_gps': 'ଜିପିଏସ୍ ସ୍ଥାନ ସ୍ୱୟଂଚାଳିତ ଚିହ୍ନଟ',
    'loc.auto_gps_desc': 'ଆପଣଙ୍କ ୱାର୍ଡ ଅପଡେଟ୍ କରିବା ପାଇଁ ସ୍ଥାନ ସେବା ବ୍ୟବହାର କରନ୍ତୁ।',
    'loc.emergency': 'ଜରୁରୀକାଳୀନ ସୂଚନା',
    'loc.emergency_desc': 'ଜରୁରୀ ପାଣିପାଗ ଏବଂ ସୁରକ୍ଷା ସୂଚନା ପାଆନ୍ତୁ।',
    'loc.analytics': 'ନାଗରିକ ତଥ୍ୟ ସହଯୋଗ',
    'loc.analytics_desc': 'ସେବା ସୁଧାର ପାଇଁ ଅଜ୍ଞାତ ତଥ୍ୟ ଅଂଶୀଦାର କରନ୍ତୁ।',

    // Danger Zone
    'danger.title': 'ସୁରକ୍ଷା କାର୍ଯ୍ୟାନୁଷ୍ଠାନ',
    'danger.subtitle': 'ଖାତା ସୁରକ୍ଷା ଏବଂ ପାସୱାର୍ଡ ରିସେଟ୍।',
    'danger.pwd_title': 'ଇମେଲ୍ ମାଧ୍ୟମରେ ପାସୱାର୍ଡ ରିସେଟ୍',
    'danger.pwd_desc': 'ଆପଣଙ୍କ ଇମେଲ୍-କୁ ରିସେଟ୍ ଲିଙ୍କ୍ ପଠାନ୍ତୁ।',
    'danger.tour_title': 'ଗାଇଡ୍ ଟୁର୍',
    'danger.tour_desc': 'ପ୍ଲାଟଫର୍ମ ଟୁର୍ ଚଲାନ୍ତୁ।',
    'danger.erasure_title': 'ତଥ୍ୟ ହଟାଇବା ଅନୁରୋଧ',
    'danger.erasure_desc': 'ପ୍ରୋଫାଇଲ୍ ତଥ୍ୟ ହଟାଇବା ପାଇଁ ଅନୁରୋଧ କରନ୍ତୁ।'
  },
  Bengali: {
    // Nav
    'nav.petitions': 'পিটিশনসমূহ (Petitions)',
    'nav.polls': 'ভোট ও পোল (Polls)',
    'nav.officials': 'কর্মকর্তা ডিরেক্টরি (Officials)',
    'nav.analytics': 'বিশ্লেষণ (Analytics)',
    'nav.settings': 'সেটিংস (Settings)',

    // Dashboard & Topbar
    'topbar.welcome': 'নাগরিক অপারেশন সেন্টার',
    'topbar.sign_out': 'সাইন আউট করুন',
    'topbar.search_placeholder': 'পিটিশন, ভোট, এলাকা খুঁজুন...',
    'topbar.official_portal': 'অফিসিয়াল পোর্টাল',

    // Action buttons
    'btn.save_settings': 'সেটিংস সংরক্ষণ করুন',
    'btn.reset_settings': 'পুনরায় সেট করুন',
    'btn.start_tour': 'ট্যুর শুরু করুন',
    'btn.reset_pwd': 'পাসওয়ার্ড রিসেট করুন',
    'btn.request_erasure': 'তথ্য মুছুন',
    'btn.create_petition': 'নতুন পিটিশন তৈরি করুন',
    'btn.inspect_respond': 'পর্যালোচনা ও উত্তর দিন',
    'btn.sign_petition': 'স্বাক্ষর করুন',
    'btn.publish_response': 'উত্তর প্রকাশ করুন',
    'btn.clear_filters': 'ফিল্টার মুছুন',

    // Settings Tabs
    'tab.profile': 'প্রোফাইল ও পরিচয়',
    'tab.notifications': 'বিজ্ঞপ্তি (Notifications)',
    'tab.appearance': 'চেহারা ও ফন্ট (Appearance)',
    'tab.locality': 'এলাকা ও সিঙ্ক (Locality)',
    'tab.privacy': 'সুরক্ষা ও গোপনীয়তা',

    // Profile Section
    'profile.title': 'প্রোফাইল তথ্য',
    'profile.subtitle': 'আপনার পরিচয় এবং পছন্দের ভাষা পরিচালনা করুন।',
    'profile.full_name': 'পূর্ণ নাম',
    'profile.phone': 'যোগাযোগ ফোন নম্বর',
    'profile.pref_lang': 'পছন্দের ভাষা (Preferred Language)',
    'profile.locked': 'যাচাইকৃত লকড',

    // Notifications Section
    'notif.title': 'বিজ্ঞপ্তি পছন্দসমূহ',
    'notif.subtitle': 'স্বয়ংক্রিয় ইমেল আপডেট এবং পুশ নোটিফিকেশন কনফিগার করুন।',
    'notif.petition_updates': 'ইমেল পিটিশন অগ্রগতি আপডেট',
    'notif.petition_updates_desc': 'আপনার স্বাক্ষরিত পিটিশন লক্ষ্যে পৌঁছালে ইমেল পান।',
    'notif.official_alerts': 'অফিসিয়াল উত্তর সতর্কতা',
    'notif.official_alerts_desc': 'পৌরসভার প্রতিনিধি উত্তর দিলে তাৎক্ষণিক বিজ্ঞপ্তি পান।',
    'notif.push': 'ব্রাউজার পুশ বিজ্ঞপ্তি',
    'notif.push_desc': 'জরুরি আপডেটের জন্য ডেসktop পপ-আপ সতর্কতা সক্ষম করুন।',
    'notif.weekly_digest': 'সাপ্তাহিক নাগরিক ডাইজেস্ট',
    'notif.digest_desc': 'প্রতি সোমবার সেরা পিটিশনগুলির ইমেল সারসংক্ষেপ।',
    'notif.sounds': 'শব্দ প্রভাব (Sound Effects)',
    'notif.sounds_desc': 'কনফিগারেশন আপডেটের সময় সূক্ষ্ম শব্দ শুনুন।',

    // Appearance Section
    'app.title': 'চেহারা এবং টাইপোগ্রাফি',
    'app.subtitle': 'সিস্টেম ফন্ট, টেক্সটের আকার এবং থিম কাস্টমাইজ করুন।',
    'app.font_family': 'টাইপোগ্রাফি ফন্ট ফ্যামিলি',
    'app.font_family_help': 'সম্পূর্ণ ইন্টারফেসে ফন্ট প্রয়োগ করে।',
    'app.color_theme': 'কালার থিম প্যালেট',
    'app.text_scale': 'ইন্টারফেস টেক্সট স্কেলিং',
    'app.compact_list': 'ডিরেক্টরিতে কমপ্যাক্ট তালিকা দৃশ্য',
    'app.compact_list_desc': 'কার্ডের বদলে তালিকা আকারে পিটিশন খুলুন।',
    'app.motion': 'অ্যানিমেশন সক্ষম করুন',
    'app.motion_desc': 'মসৃণ মাইক্রো-অ্যানিমেশন প্রয়োগ করুন।',

    // Locality Section
    'loc.title': 'এলাকা ও মিউনিসিপ্যাল সিঙ্ক',
    'loc.subtitle': 'এলাকার বিচারব্যবস্থা এবং জিপিএস অবস্থান কনফিগার করুন।',
    'loc.jurisdiction': 'প্রাথমিক এলাকা / ওয়ার্ড এলাকা',
    'loc.jurisdiction_help': 'কোন কর্মকর্তা আপনার পিটিশন পাবেন তা নির্ধারণ করে।',
    'loc.auto_gps': 'লগইনে জিপিএস অবস্থান সনাক্ত করুন',
    'loc.auto_gps_desc': 'সক্রিয় ওয়ার্ড আপডেট করতে অবস্থান পরিষেবা ব্যবহার করুন।',
    'loc.emergency': 'জরুরি এবং বিপদ সতর্কতা',
    'loc.emergency_desc': 'জরুরি পৌরসভা আবহাওয়া ও নিরাপত্তা সতর্কতা পান।',
    'loc.analytics': 'বেনামী নাগরিক বিশ্লেষণ অবদান',
    'loc.analytics_desc': 'পরিষেবা উন্নত করতে বেনামী মেট্রিক্স ভাগ করুন।',

    // Danger Zone
    'danger.title': 'সুরক্ষা এবং পদক্ষেপ',
    'danger.subtitle': 'অ্যাকাউন্ট নিরাপত্তা এবং পাসওয়ার্ড রিসেট।',
    'danger.pwd_title': 'ইমেলের মাধ্যমে পাসওয়ার্ড রিসেট করুন',
    'danger.pwd_desc': 'আপনার ইমেলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠান।',
    'danger.tour_title': 'ইন্টারেক্টিভ প্ল্যাটফর্ম ট্যুর',
    'danger.tour_desc': 'প্ল্যাটফর্ম ওয়াকথ্রু শুরু করুন।',
    'danger.erasure_title': 'অ্যাকাউন্ট ডেটা মোছার অনুরোধ',
    'danger.erasure_desc': 'প্রোফাইল ডেটা মোছার জন্য অনুরোধ জানান।'
  },
  Spanish: {
    // Nav
    'nav.petitions': 'Peticiones (Petitions)',
    'nav.polls': 'Votaciones y Encuestas',
    'nav.officials': 'Directorio de Funcionarios',
    'nav.analytics': 'Analítica',
    'nav.settings': 'Configuración (Settings)',

    // Dashboard & Topbar
    'topbar.welcome': 'Centro de Operaciones Cívicas',
    'topbar.sign_out': 'Cerrar Sesión',
    'topbar.search_placeholder': 'Buscar peticiones, votaciones, lugar...',
    'topbar.official_portal': 'PORTAL OFICIAL',

    // Action buttons
    'btn.save_settings': 'Guardar Configuración',
    'btn.reset_settings': 'Restablecer',
    'btn.start_tour': 'Iniciar Recorrido',
    'btn.reset_pwd': 'Restablecer Contraseña',
    'btn.request_erasure': 'Solicitar Eliminación',
    'btn.create_petition': 'Crear Petición',
    'btn.inspect_respond': 'Inspeccionar y Responder',
    'btn.sign_petition': 'Firmar Petición',
    'btn.publish_response': 'Publicar Respuesta',
    'btn.clear_filters': 'Limpiar Filtros',

    // Settings Tabs
    'tab.profile': 'Perfil e Identidad',
    'tab.notifications': 'Notificaciones',
    'tab.appearance': 'Apariencia y Fuente',
    'tab.locality': 'Localidad y Sincronización',
    'tab.privacy': 'Privacidad y Seguridad',

    // Profile Section
    'profile.title': 'Información del Perfil',
    'profile.subtitle': 'Gestione su identidad verificada y preferencia de idioma.',
    'profile.full_name': 'Nombre Completo',
    'profile.phone': 'Teléfono de Contacto',
    'profile.pref_lang': 'Idioma Preferido (Preferred Language)',
    'profile.locked': 'Verificado Bloqueado',

    // Notifications Section
    'notif.title': 'Preferencias de Notificación',
    'notif.subtitle': 'Configure actualizaciones por correo, alertas push y efectos de sonido.',
    'notif.petition_updates': 'Actualizaciones de Progreso de Peticiones',
    'notif.petition_updates_desc': 'Reciba correos cuando las peticiones firmadas alcancen metas de firmas.',
    'notif.official_alerts': 'Alertas de Respuesta Oficial',
    'notif.official_alerts_desc': 'Notificaciones cuando representantes locales respondan a sus peticiones.',
    'notif.push': 'Notificaciones Push del Navegador',
    'notif.push_desc': 'Alertas emergentes en tiempo real para actualizaciones comunitarias urgentes.',
    'notif.weekly_digest': 'Resumen Cívico Semanal',
    'notif.digest_desc': 'Un correo resumen cada lunes destacando las principales peticiones.',
    'notif.sounds': 'Efectos de Sonido',
    'notif.sounds_desc': 'Reproduzca tonos sutiles al firmar peticiones o actualizar opciones.',

    // Appearance Section
    'app.title': 'Apariencia y Tipografía',
    'app.subtitle': 'Personalice la fuente del sistema, escala de texto, paleta de colores y efectos.',
    'app.font_family': 'Familia Tipográfica',
    'app.font_family_help': 'Aplica la fuente dinámicamente en toda la interfaz.',
    'app.color_theme': 'Paleta de Color',
    'app.text_scale': 'Escala de Texto de la Interfaz',
    'app.compact_list': 'Vista de Lista Compacta',
    'app.compact_list_desc': 'Abra el directorio en modo de filas de lista compacta.',
    'app.motion': 'Activar Transiciones y Animaciones',
    'app.motion_desc': 'Reproduzca microanimaciones en tarjetas, barras de progreso y pestañas.',

    // Locality Section
    'loc.title': 'Localidad y Sincronización Municipal',
    'loc.subtitle': 'Configure enrutamiento de jurisdicción y autodetección GPS.',
    'loc.jurisdiction': 'Jurisdicción del Distrito Principal',
    'loc.jurisdiction_help': 'Determina qué funcionarios municipales reciben sus peticiones.',
    'loc.auto_gps': 'Autodetectar Ubicación al Iniciar Sesión',
    'loc.auto_gps_desc': 'Use servicios de ubicación para actualizar su distrito activo.',
    'loc.emergency': 'Alertas Críticas de Emergencia',
    'loc.emergency_desc': 'Reciba alertas municipales sobre clima, infraestructura y riesgos.',
    'loc.analytics': 'Contribución Analítica Anónima',
    'loc.analytics_desc': 'Comparta métricas anónimas para mejorar los servicios municipales.',

    // Danger Zone
    'danger.title': 'Acciones de Seguridad',
    'danger.subtitle': 'Controles de seguridad de la cuenta y restablecimiento de contraseña.',
    'danger.pwd_title': 'Restablecer Contraseña por Correo',
    'danger.pwd_desc': 'Envíe un enlace de verificación a su correo.',
    'danger.tour_title': 'Recorrido Interactivo de la Plataforma',
    'danger.tour_desc': 'Inicie la guía interactiva por la plataforma.',
    'danger.erasure_title': 'Solicitar Eliminación de Datos',
    'danger.erasure_desc': 'Envíe una solicitud formal para eliminar los datos del perfil.'
  }
};

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLanguage: SupportedLanguage = 'English';

  constructor() {
    const savedSettings = localStorage.getItem('civix_citizen_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.preferred_language && TRANSLATIONS[parsed.preferred_language as SupportedLanguage]) {
          this.currentLanguage = parsed.preferred_language as SupportedLanguage;
        }
      } catch {}
    }
  }

  setLanguage(lang: SupportedLanguage) {
    if (TRANSLATIONS[lang]) {
      this.currentLanguage = lang;
    }
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  t(key: string): string {
    const dict = TRANSLATIONS[this.currentLanguage] || TRANSLATIONS['English'];
    return dict[key] || TRANSLATIONS['English'][key] || key;
  }
}
