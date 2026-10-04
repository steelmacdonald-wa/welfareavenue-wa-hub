/* Welfare Avenue website (wave194 and wave195, 02/10/26): the account page, /account/ and /fr/compte/.
   Steel, 02/10/26: people sign up and sign in with Google or a code we email them (no passwords) and have their own profile:
   their details, their volunteering, their gifts and receipts, their email preferences. The accounts of the old website
   come with them: a sign-in connects to the record that has the same verified email. Volunteers ask here for an hours
   sign-off letter, a letter of recognition or their own form signed; the team signs on the Hub's Volunteer Manager and the
   signed PDF comes back here (and by email).
   Sign-in: Google Identity Services (its button; the ID token goes to Supabase Auth with a nonce), or the site-account
   function's emailed code, verified at /auth/v1/verify (the email's button opens this page with ?t=<token hash>&k=<type>).
   A volunteer's or a supporter's sign-in carries the wa_volunteer claim (the Hub's access token hook). Since wave195b (Steel,
   02/10/26) the team and the board have an account here too, with their own sign-in and the photo they have in the Hub (or
   Slack); the Hub itself stays for the team and the board. Everything else goes through the account_* and volunteer_me* database functions,
   which read only the signed-in person's own record, and the site-account function for files (a 60-second link to their own
   PDF, a signed upload address in their own folder). The switch is the Hub's site_accounts_mode: off (coming soon), test, on.
   ?next=/path returns to a page after signing in (a form that then fills in); ?link=<token> ties a text link's volunteer
   record to the account (volunteer_me_link). No inline scripts or styles: the site's Content-Security-Policy allows neither. */
(function () {
  'use strict';
  var box = document.getElementById('acct');
  if (!box || !window.WA || !window.fetch || !window.Promise) return;
  var WA = window.WA, B = document.body, LANG = B.getAttribute('data-lang') === 'fr' ? 'fr' : 'en';
  var SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var FN = SUPA + '/functions/v1/site-account', HUB = 'https://hub.welfareavenue.com', MAIL = 'info@welfareavenue.com';
  var ST = SUPA + '/storage/v1/object/public/content-images/';
  var VOL_URL = LANG === 'fr' ? '/fr/benevolat/#apply' : '/volunteer/#apply', PRIV = LANG === 'fr' ? '/fr/confidentialite/' : '/privacy/';
  var GIVE = LANG === 'fr' ? HUB + '/give/?lang=fr' : HUB + '/give';
  var MILES = [1, 5, 10, 25, 50, 100, 150, 200];
  var TX = {
    en: {
      loading: 'Loading your account…', loading2: 'Loading…', retry: 'Try again', errT: 'Something went wrong',
      signinT: 'Sign in to your account', signinP: 'See your volunteering, your gifts and receipts, and keep your details up to date. When you are signed in, our forms fill in for you.',
      linkP: 'Sign in to save your volunteering to your account.', testNote: 'Accounts are being tested with the team for now.',
      emailL: 'Your email', codeBtn: 'Email me a sign-in code', sending: 'Sending…', or: 'or', noPass: 'No password needed. The code works once, for one hour.',
      gsiErr: 'Google sign-in could not load here. You can sign in with a code by email.',
      oldT: 'Had an account on our old website?', oldP: 'Sign in with the same email. Your volunteering, your gifts and your details come with you, and there is no password to reset.',
      volT: 'Volunteers', volP: 'Your servings, your hours and the letters you need for school or work are all here. The links in our texts keep working without an account.',
      privacy: 'How we handle your information',
      checkT: 'Check your email', checkP: 'We sent a sign-in code to {e}. It works once, for one hour. You can also tap the button in that email.',
      codeL: 'Sign-in code', signIn: 'Sign in', signingIn: 'Signing in…', resend: 'Send a new code', resendIn: 'Send a new code ({s})', resent: 'We sent a new code.', other: 'Use another email',
      spam: 'Nothing after a few minutes? Check your spam folder, or write to us at info@welfareavenue.com.',
      errEmail: 'Please enter a valid email address.', errCodeShort: 'Please enter the code from the email.', errCode: 'That code did not work. Check it and try again, or ask for a new one.',
      errLink: 'That sign-in link has expired or was already used. Ask for a new code below.',
      errRate: 'Too many codes were asked for this address or from here. Please wait a while and try again.',
      errBusy: 'We are sending a lot of sign-in codes right now. Please try again in a little while.',
      errTest: 'Accounts are being tested with the team for now. They open to everyone soon.',
      errOff: 'Accounts are not open yet.', errServer: 'Something went wrong on our side. Please try again in a minute.',
      errOffline: 'We could not reach Welfare Avenue. Check your connection and try again.',
      errGoogle: 'Google sign-in did not go through. Please try again, or use a code by email.',
      teamOn: 'On the Welfare Avenue team', teamHub: 'Open the Hub',
      soonT: 'Accounts are coming soon', soonP: 'Soon you will be able to sign in here to see your volunteering, your gifts and receipts, and your email preferences. Until then, the links in our texts have everything for your next serving.',
      hookT: 'Accounts are not open yet', hookP: 'We are switching them on soon. Please come back in a little while.',
      unlinkedT: 'We could not open your record', unlinkedTaken: 'Your record is already connected to another sign-in. Write to us at info@welfareavenue.com and we will sort it out.',
      unlinkedUnverified: 'We could not confirm your email address. Please sign in again with a code by email.', again: 'Sign in again',
      linkedOk: 'Your volunteering is saved to your account.', linkedOther: 'That link belongs to another volunteer, so we did not add it to your account.',
      hi: 'Hi {n}', hiNone: 'Your account', signedAs: 'Signed in as {e}', out: 'Sign out', navL: 'Your account',
      nav_details: 'Your details', nav_vol: 'Volunteering', nav_letters: 'Letters', nav_gifts: 'Gifts and receipts', nav_emails: 'Emails',
      detailsT: 'Your details', detailsP: 'What we have on file. Keep it up to date and our forms fill in with it.', edit: 'Edit my details', save: 'Save', saving: 'Saving…', cancel: 'Cancel',
      saved: 'Saved. Thank you.', nothingChanged: 'Nothing changed.', notGiven: 'Not given', fName: 'Name', fAddress: 'Address',
      f_first_name: 'First name', f_last_name: 'Last name', f_pronouns: 'Pronouns', f_email: 'Email', f_phone: 'Phone', f_address: 'Street address', f_city: 'City',
      f_province: 'Province', f_postal_code: 'Postal code', f_country: 'Country', f_language: 'Language we write to you in',
      langEn: 'English', langFr: 'Français', langNone: 'No preference', emailNote: 'You sign in with this email. To change it, write to us:',
      e_required: 'Please add your first or last name.', e_long: 'That is too long.', e_phone: 'Please enter a phone number we can reach.', e_choice: 'Please pick one.',
      e_date: 'Please check the dates.', e_order: 'The first date is after the second.', e_range: 'Please check the dates.', e_empty: 'You have no servings in those dates.',
      e_form: 'Please add your form.', e_type: 'Please upload a PDF, PNG or JPEG file.', e_size: 'That file is over 10 MB.', e_used: 'That file is already on another request.',
      e_missing: 'Please add your form.', e_upload: 'The upload did not go through. Please try again.', e_files: 'You have uploaded the most forms we keep. Write to us at info@welfareavenue.com.',
      volT2: 'Your volunteering', volNoneP: 'You do not have a volunteer record with us yet. When you volunteer, your servings and hours show here.', volNoneBtn: 'Volunteer with us',
      volOther: 'Volunteered with us under another email? Write to us at info@welfareavenue.com and we will connect it.',
      volNotLinked: 'We could not find your volunteer record. Write to us at info@welfareavenue.com and we will connect it.',
      servings: 'servings', serving1: 'serving', hours: 'hours', since: 'since {d}', milestoneNext: '{n} more to your {m} serving', milestoneHit: 'You reached {m} servings. Thank you!', rolesT: 'Your roles',
      upT: 'Coming up', upNone: 'Nothing coming up yet. Take an open spot below.', open: 'Open', stOk: 'Confirmed', stNo: 'Can’t make it', stWait: 'To confirm',
      openT: 'Open spots', openP: 'Pick a serving and a role. We text you to confirm 7 days before.', openNone: 'No open spots right now. We will text you when new servings are posted.',
      spots1: '1 spot', spotsN: '{n} spots', askT: 'Sign up as {r} on {d}?', askYes: 'Yes, sign me up', askNo: 'Not now',
      joined: 'You’re signed up as {r} on {d}! We will text you to confirm 7 days before.', full: 'That spot was just taken. Please pick another.', already: 'You’re already on that serving.',
      histT: 'Where you’ve been', histNone: 'Your servings show here after you volunteer with us.', survey: 'Take the survey', surveyDone: 'Survey answered', showAll: 'Show all ({n})',
      lettersT: 'Letters and sign-offs', lettersP: 'For school, a job or a scholarship: ask for a letter signed by our team. We email you when it is ready, and it stays here to download.',
      lettersNone: 'Letters are available after your first serving with us.', askBtn: 'Ask for a letter', tooMany: 'You have {n} requests waiting. Please wait for one to be signed before asking again.',
      k_hours: 'Hours sign-off letter', k_hoursD: 'Your servings and hours, signed by our team.', k_recognition: 'Letter of recognition', k_recognitionD: 'A letter about what you bring to our community, signed by our team.',
      k_form: 'Your own form, signed', k_formD: 'Upload the form your school or employer gave you and we sign it.',
      reqKind: 'What do you need?', reqFor: 'Who is it for?', reqForH: 'For example your school or employer. We address the letter to them.',
      reqPurpose: 'What is it for?', reqPurposeH: 'For example community service hours for your diploma.', reqFrom: 'From', reqTo: 'To', reqPeriodH: 'Leave the dates empty for all your servings.',
      reqNotes: 'Anything we should know?', reqFile: 'Your form', reqFileH: 'PDF, PNG or JPEG, up to 10 MB.', reqChosen: 'Chosen: {n}', reqSend: 'Send my request', optional: '(optional)',
      reqSent: 'Request sent. We email you when it is signed.', cancelReq: 'Cancel this request', cancelAsk: 'Cancel this request?', cancelYes: 'Yes, cancel it', cancelNo: 'Keep it', cancelled: 'Request cancelled.',
      stWaiting: 'Waiting to be signed', stSigned: 'Signed {d}', stSignedM: 'Signed {d}', stDeclined: 'Declined {d}', stDeclinedM: 'Declined {d}',
      asked: 'Asked {d}', forOrg: 'For {o}', ref: 'Reference {r}', signedBy: 'Signed by {s}', signedByM: 'Signed by {s}', declinedWhy: 'Our note: {r}', download: 'Download PDF',
      errFile: 'We could not open that file. Please try again in a minute.',
      quickT: 'Need something today?', quickP: 'Print a summary of your hours right now. It is not signed, but it has a reference we can confirm.', quickBtn: 'Print my hours summary',
      print: 'Print or save as PDF', back: 'Back to my account', charity: 'Registered charity 713048502RR0001',
      lTo: 'To whom it may concern,',
      lBody1: 'This letter confirms that {n} has volunteered with Welfare Avenue, a youth-powered registered charity that serves home-cooked meals and connects people experiencing homelessness with support in Montreal and Toronto.',
      lBody2: 'Between {a} and {b}, {f} volunteered at {s} of our servings, for a total of about {h} hours, as {r}.',
      lBody2one: 'On {a}, {f} volunteered at one of our servings, for about {h} hours, as {r}.',
      lBody3: 'We are grateful for {f}’s time and care. Please contact us with any question about this letter.', lSig: 'The Welfare Avenue team',
      lRef: 'Reference {ref} · issued {d}. To confirm this letter, email info@welfareavenue.com with the reference.', and: 'and',
      giftsT: 'Gifts and receipts', giftsN: '{n} gifts, {t} in all, since {d}. Thank you.', gifts1: 'One gift of {t}, on {d}. Thank you.', giftsNone: 'No gifts on your record yet.',
      giveBtn: 'Make a gift', monthly: 'Monthly', refunded: 'Refunded', receiptsT: 'Official tax receipts', receiptsNone: 'Your official tax receipts show here once they are issued.',
      receiptN: 'Receipt {s}', oldReceipt: 'Receipt no. {n}', receiptFor: 'Tax year {y} · eligible amount {a}', issued: 'Issued {d}',
      emailsT: 'Email preferences', newsOn: 'You get our newsletter, about once a month.', newsOff: 'You do not get our newsletter.', newsSince: 'You said yes on {d}.',
      newsTurnOn: 'Send me the newsletter', newsTurnOff: 'Stop the newsletter', newsOnNote: 'About once a month. You can stop it anytime.',
      newsBlocked: 'Our emails are not reaching this address, so we stopped sending. Write to us at info@welfareavenue.com if that is a mistake.',
      newsNote: 'Messages about your volunteering, your gifts and your receipts still come when needed.', newsDoneOn: 'You are on the list. Thank you!', newsDoneOff: 'Done. You will not get the newsletter anymore.',
      helpT: 'Something not right?', helpP: 'Write to us at info@welfareavenue.com to correct your record, connect another email or delete your account.'
    },
    fr: {
      loading: 'Chargement de votre compte…', loading2: 'Chargement…', retry: 'Réessayer', errT: 'Un problème est survenu',
      signinT: 'Connectez-vous à votre compte', signinP: 'Consultez votre bénévolat, vos dons et vos reçus, et gardez vos coordonnées à jour. Une fois la connexion faite, nos formulaires se remplissent pour vous.',
      linkP: 'Connectez-vous pour enregistrer votre bénévolat dans votre compte.', testNote: 'Les comptes sont en essai avec l’équipe pour l’instant.',
      emailL: 'Votre courriel', codeBtn: 'Recevoir un code par courriel', sending: 'Envoi…', or: 'ou', noPass: 'Aucun mot de passe. Le code fonctionne une seule fois, pendant une heure.',
      gsiErr: 'La connexion avec Google n’a pas pu se charger ici. Vous pouvez vous connecter avec un code par courriel.',
      oldT: 'Vous aviez un compte sur notre ancien site?', oldP: 'Connectez-vous avec le même courriel. Votre bénévolat, vos dons et vos coordonnées vous suivent, et il n’y a aucun mot de passe à réinitialiser.',
      volT: 'Bénévoles', volP: 'Vos services, vos heures et les lettres dont vous avez besoin pour l’école ou le travail sont ici. Les liens de nos textos fonctionnent toujours sans compte.',
      privacy: 'Comment nous traitons vos renseignements',
      checkT: 'Vérifiez vos courriels', checkP: 'Nous avons envoyé un code de connexion à {e}. Il fonctionne une seule fois, pendant une heure. Vous pouvez aussi toucher le bouton dans ce courriel.',
      codeL: 'Code de connexion', signIn: 'Se connecter', signingIn: 'Connexion…', resend: 'Envoyer un nouveau code', resendIn: 'Envoyer un nouveau code ({s})', resent: 'Nous avons envoyé un nouveau code.', other: 'Utiliser un autre courriel',
      spam: 'Rien après quelques minutes? Vérifiez vos courriels indésirables, ou écrivez-nous à info@welfareavenue.com.',
      errEmail: 'Veuillez entrer une adresse courriel valide.', errCodeShort: 'Veuillez entrer le code reçu par courriel.', errCode: 'Ce code n’a pas fonctionné. Vérifiez-le et réessayez, ou demandez-en un nouveau.',
      errLink: 'Ce lien de connexion a expiré ou a déjà servi. Demandez un nouveau code ci-dessous.',
      errRate: 'Trop de codes ont été demandés pour cette adresse ou depuis cet appareil. Veuillez patienter un peu et réessayer.',
      errBusy: 'Nous envoyons beaucoup de codes en ce moment. Veuillez réessayer un peu plus tard.',
      errTest: 'Les comptes sont en essai avec l’équipe pour l’instant. Ils ouvriront à tout le monde bientôt.',
      errOff: 'Les comptes ne sont pas encore ouverts.', errServer: 'Un problème est survenu de notre côté. Veuillez réessayer dans une minute.',
      errOffline: 'Impossible de joindre Welfare Avenue. Vérifiez votre connexion et réessayez.',
      errGoogle: 'La connexion avec Google n’a pas fonctionné. Veuillez réessayer, ou utilisez un code par courriel.',
      teamOn: 'Dans l’équipe Welfare Avenue', teamHub: 'Ouvrir le Hub',
      soonT: 'Les comptes arrivent bientôt', soonP: 'Vous pourrez bientôt vous connecter ici pour voir votre bénévolat, vos dons et vos reçus, et vos préférences de courriel. D’ici là, les liens de nos textos contiennent tout pour votre prochain service.',
      hookT: 'Les comptes ne sont pas encore ouverts', hookP: 'Nous les activons bientôt. Revenez un peu plus tard.',
      unlinkedT: 'Nous n’avons pas pu ouvrir votre dossier', unlinkedTaken: 'Votre dossier est déjà relié à une autre connexion. Écrivez-nous à info@welfareavenue.com et nous réglerons la situation.',
      unlinkedUnverified: 'Nous n’avons pas pu confirmer votre adresse courriel. Connectez-vous de nouveau avec un code par courriel.', again: 'Se connecter de nouveau',
      linkedOk: 'Votre bénévolat est enregistré dans votre compte.', linkedOther: 'Ce lien appartient à un autre bénévole; nous ne l’avons donc pas ajouté à votre compte.',
      hi: 'Bonjour {n}', hiNone: 'Votre compte', signedAs: 'Connexion : {e}', out: 'Se déconnecter', navL: 'Votre compte',
      nav_details: 'Vos coordonnées', nav_vol: 'Bénévolat', nav_letters: 'Lettres', nav_gifts: 'Dons et reçus', nav_emails: 'Courriels',
      detailsT: 'Vos coordonnées', detailsP: 'Ce que nous avons à votre dossier. Gardez-le à jour : nos formulaires s’en servent pour se remplir.', edit: 'Modifier mes coordonnées', save: 'Enregistrer', saving: 'Enregistrement…', cancel: 'Annuler',
      saved: 'C’est enregistré. Merci.', nothingChanged: 'Rien n’a changé.', notGiven: 'Non indiqué', fName: 'Nom', fAddress: 'Adresse',
      f_first_name: 'Prénom', f_last_name: 'Nom de famille', f_pronouns: 'Pronoms', f_email: 'Courriel', f_phone: 'Téléphone', f_address: 'Adresse', f_city: 'Ville',
      f_province: 'Province', f_postal_code: 'Code postal', f_country: 'Pays', f_language: 'Langue de nos messages',
      langEn: 'English', langFr: 'Français', langNone: 'Aucune préférence', emailNote: 'Vous vous connectez avec ce courriel. Pour le changer, écrivez-nous :',
      e_required: 'Veuillez indiquer votre prénom ou votre nom de famille.', e_long: 'C’est trop long.', e_phone: 'Veuillez entrer un numéro où vous joindre.', e_choice: 'Veuillez faire un choix.',
      e_date: 'Veuillez vérifier les dates.', e_order: 'La première date est après la deuxième.', e_range: 'Veuillez vérifier les dates.', e_empty: 'Vous n’avez aucun service entre ces dates.',
      e_form: 'Veuillez ajouter votre formulaire.', e_type: 'Veuillez téléverser un fichier PDF, PNG ou JPEG.', e_size: 'Ce fichier dépasse 10 Mo.', e_used: 'Ce fichier est déjà joint à une autre demande.',
      e_missing: 'Veuillez ajouter votre formulaire.', e_upload: 'Le téléversement n’a pas fonctionné. Veuillez réessayer.', e_files: 'Vous avez atteint le nombre maximal de formulaires conservés. Écrivez-nous à info@welfareavenue.com.',
      volT2: 'Votre bénévolat', volNoneP: 'Vous n’avez pas encore de dossier de bénévole chez nous. Quand vous ferez du bénévolat, vos services et vos heures apparaîtront ici.', volNoneBtn: 'Devenir bénévole',
      volOther: 'Vous avez fait du bénévolat avec nous sous un autre courriel? Écrivez-nous à info@welfareavenue.com et nous ferons le lien.',
      volNotLinked: 'Nous n’avons pas trouvé votre dossier de bénévole. Écrivez-nous à info@welfareavenue.com et nous ferons le lien.',
      servings: 'services', serving1: 'service', hours: 'heures', since: 'depuis {d}', milestoneNext: 'Encore {n} avant votre {m}e service', milestoneHit: 'Vous avez atteint {m} services. Merci!', rolesT: 'Vos rôles',
      upT: 'À venir', upNone: 'Rien à venir pour l’instant. Prenez une place libre ci-dessous.', open: 'Ouvrir', stOk: 'Confirmé', stNo: 'Absent', stWait: 'À confirmer',
      openT: 'Places libres', openP: 'Choisissez un service et un rôle. Nous vous texterons pour confirmer 7 jours avant.', openNone: 'Aucune place libre pour l’instant. Nous vous texterons quand de nouveaux services seront affichés.',
      spots1: '1 place', spotsN: '{n} places', askT: 'Vous inscrire comme {r} le {d}?', askYes: 'Oui, inscrivez-moi', askNo: 'Pas maintenant',
      joined: 'Vous êtes inscrit comme {r} le {d}! Nous vous texterons pour confirmer 7 jours avant.', full: 'Cette place vient d’être prise. Choisissez-en une autre.', already: 'Vous êtes déjà inscrit à ce service.',
      histT: 'Vos services', histNone: 'Vos services apparaîtront ici après votre premier bénévolat.', survey: 'Répondre au sondage', surveyDone: 'Sondage rempli', showAll: 'Tout afficher ({n})',
      lettersT: 'Lettres et attestations', lettersP: 'Pour l’école, un emploi ou une bourse : demandez une lettre signée par notre équipe. Nous vous écrivons quand elle est prête, et elle reste ici à télécharger.',
      lettersNone: 'Les lettres sont offertes après votre premier service avec nous.', askBtn: 'Demander une lettre', tooMany: 'Vous avez {n} demandes en attente. Attendez qu’une soit signée avant d’en faire une autre.',
      k_hours: 'Attestation d’heures', k_hoursD: 'Vos services et vos heures, signés par notre équipe.', k_recognition: 'Lettre de reconnaissance', k_recognitionD: 'Une lettre sur ce que vous apportez à notre communauté, signée par notre équipe.',
      k_form: 'Votre formulaire, signé', k_formD: 'Téléversez le formulaire de votre école ou de votre employeur et nous le signons.',
      reqKind: 'De quoi avez-vous besoin?', reqFor: 'À qui est-ce destiné?', reqForH: 'Par exemple votre école ou votre employeur. La lettre leur sera adressée.',
      reqPurpose: 'À quoi cela servira-t-il?', reqPurposeH: 'Par exemple des heures de bénévolat pour votre diplôme.', reqFrom: 'Du', reqTo: 'Au', reqPeriodH: 'Laissez les dates vides pour tous vos services.',
      reqNotes: 'Autre chose à nous dire?', reqFile: 'Votre formulaire', reqFileH: 'PDF, PNG ou JPEG, 10 Mo au maximum.', reqChosen: 'Fichier choisi : {n}', reqSend: 'Envoyer ma demande', optional: '(facultatif)',
      reqSent: 'Demande envoyée. Nous vous écrirons quand elle sera signée.', cancelReq: 'Annuler cette demande', cancelAsk: 'Annuler cette demande?', cancelYes: 'Oui, l’annuler', cancelNo: 'La garder', cancelled: 'Demande annulée.',
      stWaiting: 'En attente de signature', stSigned: 'Signée le {d}', stSignedM: 'Signé le {d}', stDeclined: 'Refusée le {d}', stDeclinedM: 'Refusé le {d}',
      asked: 'Demandée le {d}', forOrg: 'Pour : {o}', ref: 'Référence {r}', signedBy: 'Signée par {s}', signedByM: 'Signé par {s}', declinedWhy: 'Notre note : {r}', download: 'Télécharger le PDF',
      errFile: 'Nous n’avons pas pu ouvrir ce fichier. Veuillez réessayer dans une minute.',
      quickT: 'Besoin de quelque chose aujourd’hui?', quickP: 'Imprimez dès maintenant un résumé de vos heures. Il n’est pas signé, mais il porte une référence que nous pouvons confirmer.', quickBtn: 'Imprimer mon résumé d’heures',
      print: 'Imprimer ou enregistrer en PDF', back: 'Retour à mon compte', charity: 'Organisme de bienfaisance enregistré 713048502RR0001',
      lTo: 'À qui de droit,',
      lBody1: 'La présente confirme que {n} fait du bénévolat avec Welfare Avenue, un organisme de bienfaisance enregistré porté par les jeunes qui sert des repas maison et met les personnes en situation d’itinérance en lien avec du soutien, à Montréal et à Toronto.',
      lBody2: 'Entre le {a} et le {b}, {f} a participé à {s} de nos services, pour un total d’environ {h} heures, comme {r}.',
      lBody2one: 'Le {a}, {f} a participé à l’un de nos services, pour environ {h} heures, comme {r}.',
      lBody3: 'Nous remercions {f} pour son temps et son engagement. N’hésitez pas à nous écrire pour toute question au sujet de cette lettre.', lSig: 'L’équipe de Welfare Avenue',
      lRef: 'Référence {ref} · émise le {d}. Pour confirmer cette lettre, écrivez à info@welfareavenue.com en indiquant la référence.', and: 'et',
      giftsT: 'Dons et reçus', giftsN: '{n} dons, {t} au total, depuis le {d}. Merci.', gifts1: 'Un don de {t}, le {d}. Merci.', giftsNone: 'Aucun don à votre dossier pour l’instant.',
      giveBtn: 'Faire un don', monthly: 'Mensuel', refunded: 'Remboursé', receiptsT: 'Reçus officiels aux fins de l’impôt', receiptsNone: 'Vos reçus officiels apparaîtront ici une fois émis.',
      receiptN: 'Reçu {s}', oldReceipt: 'Reçu no {n}', receiptFor: 'Année d’imposition {y} · montant admissible {a}', issued: 'Émis le {d}',
      emailsT: 'Préférences de courriel', newsOn: 'Vous recevez notre infolettre, environ une fois par mois.', newsOff: 'Vous ne recevez pas notre infolettre.', newsSince: 'Vous avez dit oui le {d}.',
      newsTurnOn: 'M’envoyer l’infolettre', newsTurnOff: 'Arrêter l’infolettre', newsOnNote: 'Environ une fois par mois. Vous pouvez l’arrêter en tout temps.',
      newsBlocked: 'Nos courriels ne se rendent pas à cette adresse, alors nous avons arrêté les envois. Écrivez-nous à info@welfareavenue.com si c’est une erreur.',
      newsNote: 'Les messages au sujet de votre bénévolat, de vos dons et de vos reçus continuent d’arriver au besoin.', newsDoneOn: 'Vous êtes sur la liste. Merci!', newsDoneOff: 'C’est fait. Vous ne recevrez plus l’infolettre.',
      helpT: 'Quelque chose ne va pas?', helpP: 'Écrivez-nous à info@welfareavenue.com pour corriger votre dossier, relier un autre courriel ou supprimer votre compte.'
    }
  };

  /* ---------- words, dates, money ---------- */
  function t(k) { var v = TX[LANG][k]; return v == null ? (TX.en[k] == null ? k : TX.en[k]) : v; }
  function f(k, o) { return String(t(k)).replace(/\{(\w+)\}/g, function (_, x) { return o && o[x] != null ? String(o[x]) : ''; }); }
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function fx(k, o) { // the words escaped, the values given as HTML
    return String(t(k)).split(/(\{\w+\})/).map(function (part) { var m = part.match(/^\{(\w+)\}$/); return m ? (o && o[m[1]] != null ? o[m[1]] : '') : E(part); }).join('');
  }
  function withMail(s) { return E(s).split(MAIL).join('<a href="mailto:' + MAIL + '">' + MAIL + '</a>'); }
  function L() { return LANG === 'fr' ? 'fr-CA' : 'en-CA'; }
  function dOf(iso) { var d = new Date(String(iso || '').slice(0, 10) + 'T12:00:00'); return isNaN(d.getTime()) ? null : d; }
  function dLong(iso) { var d = dOf(iso); if (!d) return String(iso || ''); try { return d.toLocaleDateString(L(), { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return String(iso); } }
  function dDay(iso) { var d = dOf(iso); if (!d) return String(iso || ''); try { return d.toLocaleDateString(L(), { weekday: 'long', month: 'long', day: 'numeric' }); } catch (e) { return String(iso); } }
  function monthYear(iso) { var d = dOf(iso); if (!d) return ''; try { return d.toLocaleDateString(L(), { year: 'numeric', month: 'long' }); } catch (e) { return String(iso); } }
  function money(n, cur) { try { return new Intl.NumberFormat(L(), { style: 'currency', currency: cur || 'CAD' }).format(Number(n || 0)); } catch (e) { return '$' + Number(n || 0).toFixed(2); } }
  function num(n) { var x = Math.round(Number(n || 0) * 10) / 10; return String(x).replace('.', LANG === 'fr' ? ',' : '.'); }
  function hm(s) { var m = String(s || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return ''; var h = Number(m[1]); return LANG === 'fr' ? h + ' h' + (m[2] === '00' ? '' : ' ' + m[2]) : (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm'); }
  function rn(o) { return (LANG === 'fr' ? o.role_fr : o.role_en) || o.role || ''; }
  function ordinal(m) { if (LANG === 'fr') return m; var s = ['th', 'st', 'nd', 'rd'], v = m % 100; return m + (s[(v - 20) % 10] || s[v] || s[0]); }
  function joinRoles(rs) { var n = (rs || []).map(function (r) { return rn(r).toLowerCase(); }).filter(Boolean); return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' ' + t('and') + ' ' + n[n.length - 1]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function json(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j || {} }; }); }
  function focus(id) { var el = document.getElementById(id); if (el) { try { el.focus(); } catch (e) { /* fine */ } } }

  /* ---------- the page's state ---------- */
  var q = new URLSearchParams(window.location.search);
  var NEXT = (function (n) { return n && n.length < 160 && /^\/(?!\/)[A-Za-z0-9\/_.~%#=?&-]*$/.test(n) ? n : ''; })(q.get('next') || '');
  var S = { cfg: { mode: 'off' }, view: 'loading', notes: {}, email: '', token: '', tokenAt: 0, sentAt: 0, err: {}, busy: false, justIn: false, had: false,
    me: null, vol: null, so: null, edit: false, draft: null, derrs: {}, ask: null, allHist: false, allGifts: false, req: null, reqFile: null, cancelAsk: null, letter: null, linkTried: false };
  function say(sec, msg, kind) { if (msg) S.notes[sec] = { m: msg, k: kind || 'info' }; else delete S.notes[sec]; }
  function note(sec) { var n = S.notes[sec]; return n ? '<div class="waf-banner ' + (n.k === 'warn' ? 'warn' : 'info') + '" role="status">' + withMail(n.m) + '</div>' : ''; }
  function cleanUrl(drop) {
    try { drop.forEach(function (k) { q.delete(k); }); var s = q.toString(); window.history.replaceState({}, '', window.location.pathname + (s ? '?' + s : '') + window.location.hash); } catch (e) { /* fine */ }
  }

  /* ---------- Google Identity Services: the button, its ID token to Supabase Auth with a nonce ---------- */
  var G = { loading: null, raw: '', ready: false };
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function loadGsi() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (!G.loading) {
      G.loading = new Promise(function (res, rej) {
        var sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
        sc.onload = function () { res(); }; sc.onerror = function () { G.loading = null; rej(new Error('gsi')); };
        document.head.appendChild(sc);
      });
    }
    return G.loading;
  }
  function googleButton() {
    if (!document.getElementById('gsi')) return;
    loadGsi().then(function () {
      if (G.ready) return null;
      var a = new Uint8Array(24); window.crypto.getRandomValues(a); G.raw = hex(a.buffer);
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(G.raw)).then(function (h) {
        window.google.accounts.id.initialize({ client_id: S.cfg.google_client_id, callback: onGoogle, nonce: hex(h), ux_mode: 'popup', auto_select: false,
          cancel_on_tap_outside: true, context: 'signin', itp_support: true, use_fedcm_for_prompt: true });
        G.ready = true;
      });
    }).then(function () {
      var el = document.getElementById('gsi'); if (!el) return;
      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left',
        width: Math.max(220, Math.min(380, el.clientWidth || 320)), locale: LANG });
      watchGsi(el);
    }).catch(function () { var el = document.getElementById('gsi'); if (el) el.innerHTML = '<p class="fine mb0">' + E(t('gsiErr')) + '</p>'; });
  }
  // wave202b: Google's frame sizes itself once Google accepts the website; if it is still empty after 8 seconds (the website's address
  // not allowed for the client ID, Google unreachable, a blocker), say so and point to the code by email. The note goes if the button
  // turns up later.
  function watchGsi(el) {
    var n = 0, iv = setInterval(function () {
      n++;
      if (!el.isConnected) { clearInterval(iv); return; }
      var f = el.querySelector('iframe'), nx = el.nextElementSibling, note = nx && nx.classList.contains('gsi-note') ? nx : null;
      if (f && parseFloat(f.style.height) > 0) { if (note) note.remove(); clearInterval(iv); return; }
      if (n === 16 && !note) { var p = document.createElement('p'); p.className = 'fine mb0 gsi-note'; p.textContent = t('gsiErr'); el.insertAdjacentElement('afterend', p); }
      if (n >= 120) clearInterval(iv);
    }, 500);
  }
  function onGoogle(resp) {
    if (!resp || !resp.credential || S.busy) return;
    S.busy = true; say('top', t('signingIn')); paint();
    WA.authFetch('token?grant_type=id_token', { provider: 'google', id_token: resp.credential, nonce: G.raw }).then(function (r) {
      S.busy = false;
      if (r.ok && r.body && r.body.access_token) { WA.keep(r.body); S.justIn = true; say('top', ''); return start(); }
      say('top', t('errGoogle'), 'warn'); paint();
      return null;
    }, function () { S.busy = false; say('top', t('errOffline'), 'warn'); paint(); });
  }

  /* ---------- a code by email (the site-account function), checked at /auth/v1/verify ---------- */
  function getToken() {
    return fetch(FN + '?action=token', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }).then(json).then(function (r) {
      if (r.ok && r.body.token) { S.token = r.body.token; S.tokenAt = Date.now(); }
    }, function () { /* the send tries again */ });
  }
  function tokenReady() { // the function wants a token between 2 seconds and an hour old
    var p = S.token && Date.now() - S.tokenAt < 3000000 ? Promise.resolve() : getToken();
    return p.then(function () { var age = Date.now() - S.tokenAt; return age < 2300 ? sleep(2300 - age) : null; });
  }
  function postCode(email, hp) {
    return fetch(FN, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'code', email: email, lang: LANG, token: S.token, hp: hp || '', next: NEXT.split('#')[0] }) }).then(json);
  }
  function sendCode(email, hp) {
    return tokenReady().then(function () { return postCode(email, hp); }).then(function (r) {
      if (r.status === 400 && (r.body.error === 'expired' || r.body.error === 'token')) { S.token = ''; return tokenReady().then(function () { return postCode(email, hp); }); }
      return r;
    });
  }
  function codeError(e) {
    return { rate: t('errRate'), busy: t('errBusy'), test: t('errTest'), off: t('errOff'), email: t('errEmail') }[e] || t('errServer');
  }
  function onCodeSubmit(fm) {
    if (S.busy) return;
    var email = String(fm.elements.email.value || '').trim().toLowerCase(), hp = fm.elements.website ? fm.elements.website.value : '';
    S.email = email; S.err = {};
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { S.err.email = t('errEmail'); paint(); focus('a-email'); return; }
    S.busy = true; say('top', ''); paint();
    sendCode(email, hp).then(function (r) {
      S.busy = false;
      if (r.ok && r.body.ok) { S.view = 'code'; S.sentAt = Date.now(); paint(); focus('a-code'); tick(); return; }
      say('top', codeError(r.body.error), 'warn'); paint();
    }, function () { S.busy = false; say('top', t('errOffline'), 'warn'); paint(); });
  }
  var ticking = null;
  function tick() { // the "send a new code" button opens after 30 seconds
    if (ticking) clearInterval(ticking);
    ticking = setInterval(function () {
      var b = box.querySelector('[data-act="resend"]'); if (!b || S.view !== 'code') { clearInterval(ticking); ticking = null; return; }
      var w = 30 - Math.floor((Date.now() - S.sentAt) / 1000);
      b.disabled = w > 0; b.textContent = w > 0 ? f('resendIn', { s: w }) : t('resend');
      if (w <= 0) { clearInterval(ticking); ticking = null; }
    }, 1000);
  }
  function onOtpSubmit(fm) {
    if (S.busy) return;
    var code = String(fm.elements.code.value || '').replace(/\D/g, '');
    S.err = {};
    if (code.length < 6) { S.err.code = t('errCodeShort'); paint(); focus('a-code'); return; }
    S.busy = true; say('top', ''); paint();
    WA.authFetch('verify', { type: 'email', email: S.email, token: code }).then(function (r) {
      S.busy = false;
      if (r.ok && r.body && r.body.access_token) { WA.keep(r.body); S.justIn = true; return start(); }
      S.err.code = t('errCode'); paint(); focus('a-code');
      return null;
    }, function () { S.busy = false; say('top', t('errOffline'), 'warn'); paint(); });
  }
  function verifyLink(hash, kind) { // the email's button: its token hash, as 'email' and then as the type the link was made with
    var kinds = ['email']; if (kind === 'magiclink' || kind === 'signup') kinds.push(kind);
    var i = 0;
    function next() {
      return WA.authFetch('verify', { type: kinds[i], token_hash: hash }).then(function (r) {
        if (r.ok && r.body && r.body.access_token) return r.body;
        i++; return i < kinds.length ? next() : null;
      });
    }
    return next();
  }

  /* ---------- start: the switch, a link from the email, the sign-in, then the profile ---------- */
  function start() {
    S.view = 'loading'; paint();
    return WA.config(true).then(function (cfg) {
      S.cfg = cfg && cfg.mode ? cfg : { mode: 'off' };
      var th = q.get('t'), p = Promise.resolve();
      if (th) {
        var kind = q.get('k');
        cleanUrl(['t', 'k']);
        if (S.cfg.mode !== 'off') {
          p = verifyLink(th, kind).then(function (sess) { if (sess) { WA.keep(sess); S.justIn = true; } else say('top', t('errLink'), 'warn'); },
            function () { say('top', t('errOffline'), 'warn'); });
        }
      }
      return p.then(function () { return WA.session(); });
    }).then(function (s) {
      if (S.cfg.mode === 'off') { S.had = !!s; S.view = 'soon'; paint(); return null; }
      if (!s) { S.view = 'signin'; paint(); return null; }
      return linkThenMe(s);
    }).catch(function () { say('top', t('errOffline'), 'warn'); S.view = 'error'; paint(); });
  }
  function linkThenMe(s) {
    var link = q.get('link'), p = Promise.resolve();
    if (link && !S.linkTried) {
      S.linkTried = true;
      p = WA.rpc('volunteer_me_link', { p_token: link }, s).then(function (r) {
        var b = r.body || {};
        if (b.ok && !b.already) say('top', t('linkedOk')); else if (b.reason === 'other') say('top', t('linkedOther'), 'warn');
        cleanUrl(['link']);
      }, function () { /* the profile still opens */ });
    }
    return p.then(loadMe);
  }
  function loadMe() {
    return WA.session().then(function (s) {
      if (!s) { S.view = 'signin'; paint(); return null; }
      return WA.rpc('account_me', { p_lang: LANG }, s).then(function (r) {
        var m = r.body || {};
        if (r.status === 401 || (r.ok && m.signed_in === false)) { WA.forget(); S.view = 'signin'; paint(); return; }
        if (!r.ok) { say('top', t('errServer'), 'warn'); S.view = 'error'; paint(); return; }
        if (m.hook === false) { WA.signOut(); S.view = 'hook'; paint(); return; }
        S.me = m;
        if (!m.linked) { S.view = 'unlinked'; paint(); return; }
        if (S.justIn && NEXT) { S.justIn = false; window.location.replace(NEXT); return; }
        S.justIn = false; S.view = 'profile'; paint();
        if (m.volunteer) { loadVol(); loadSo(); }
      });
    });
  }
  function loadVol() {
    return WA.session().then(function (s) { return WA.rpc('volunteer_me', {}, s); }).then(function (r) {
      S.vol = r.ok && r.body && r.body.signed_in ? r.body : { err: true }; sec('vol');
    }, function () { S.vol = { err: true }; sec('vol'); });
  }
  function loadSo() {
    return WA.session().then(function (s) { return WA.rpc('account_signoffs', {}, s); }).then(function (r) {
      S.so = r.ok && r.body && r.body.ok ? r.body : { err: true }; sec('letters');
    }, function () { S.so = { err: true }; sec('letters'); });
  }
  function signOut() {
    WA.signOut(); S.me = null; S.vol = null; S.so = null; S.edit = false; S.req = null; S.reqFile = null; S.letter = null; S.notes = {}; S.view = 'signin'; S.err = {};
    paint(); try { window.scrollTo(0, 0); } catch (e) { /* fine */ }
  }

  /* ---------- the views ---------- */
  function one(title, inner) { return '<div class="card acct-one"><h2>' + E(title) + '</h2>' + inner + '</div>'; }
  function outLine() { return '<p class="fine mt2 mb0"><button type="button" class="linkish" data-act="out">' + E(t('out')) + '</button></p>'; }
  function paint() {
    var v = S.view;
    if (v === 'loading') box.innerHTML = '<p class="loading">' + E(t('loading')) + '</p>';
    else if (v === 'soon') box.innerHTML = one(t('soonT'), '<p class="mb0">' + E(t('soonP')) + '</p>' + (S.had ? outLine() : ''));
    else if (v === 'signin') paintSignin();
    else if (v === 'code') paintCode();
    else if (v === 'hook') box.innerHTML = one(t('hookT'), '<p class="mb0">' + E(t('hookP')) + '</p>');
    else if (v === 'unlinked') {
      var taken = S.me && S.me.reason === 'taken';
      box.innerHTML = one(t('unlinkedT'), '<p>' + withMail(taken ? t('unlinkedTaken') : t('unlinkedUnverified')) + '</p>' +
        (taken ? outLine() : '<div class="btns mt1"><button type="button" class="btn small" data-act="out">' + E(t('again')) + '</button></div>'));
    }
    else if (v === 'error') box.innerHTML = one(t('errT'), note('top') + '<div class="btns mt1"><button type="button" class="btn small" data-act="retry">' + E(t('retry')) + '</button></div>');
    else if (v === 'letter') paintLetter();
    else if (v === 'profile') paintProfile();
  }
  function paintSignin() {
    var g = !!S.cfg.google_client_id;
    box.innerHTML = '<div class="acct-grid"><div class="card acct-main"><h2>' + E(t('signinT')) + '</h2><p>' + E(q.get('link') ? t('linkP') : t('signinP')) + '</p>' +
      (S.cfg.mode === 'test' ? '<p class="acct-test">' + E(t('testNote')) + '</p>' : '') + note('top') +
      (g ? '<div class="gsi" id="gsi"></div><p class="acct-or"><span>' + E(t('or')) + '</span></p>' : '') +
      '<form class="acct-form" id="f-code" novalidate><div class="q' + (S.err.email ? ' bad' : '') + '"><label for="a-email">' + E(t('emailL')) + '</label>' +
      '<input id="a-email" name="email" type="email" autocomplete="email" maxlength="200" value="' + E(S.email) + '"' + (S.err.email ? ' aria-invalid="true" aria-describedby="a-email-e"' : '') + '>' +
      (S.err.email ? '<p class="err" id="a-email-e">' + E(S.err.email) + '</p>' : '') + '</div>' +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>' + E(S.busy ? t('sending') : t('codeBtn')) + '</button></form>' +
      '<p class="fine mt1 mb0">' + E(t('noPass')) + '</p></div>' +
      '<aside class="card acct-side"><h3>' + E(t('oldT')) + '</h3><p>' + E(t('oldP')) + '</p><h3>' + E(t('volT')) + '</h3><p>' + E(t('volP')) + '</p>' +
      '<p class="fine mb0"><a href="' + PRIV + '">' + E(t('privacy')) + '</a></p></aside></div>';
    if (g) googleButton();
    if (!S.token) getToken();
  }
  function paintCode() {
    var w = 30 - Math.floor((Date.now() - S.sentAt) / 1000);
    box.innerHTML = one(t('checkT'), '<p>' + fx('checkP', { e: '<b>' + E(S.email) + '</b>' }) + '</p>' + note('top') +
      '<form class="acct-form" id="f-otp" novalidate><div class="q' + (S.err.code ? ' bad' : '') + '"><label for="a-code">' + E(t('codeL')) + '</label>' +
      '<input id="a-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12"' + (S.err.code ? ' aria-invalid="true" aria-describedby="a-code-e"' : '') + '>' +
      (S.err.code ? '<p class="err" id="a-code-e">' + E(S.err.code) + '</p>' : '') + '</div>' +
      '<button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>' + E(S.busy ? t('signingIn') : t('signIn')) + '</button></form>' +
      '<p class="fine mt2"><button type="button" class="linkish" data-act="resend"' + (w > 0 ? ' disabled' : '') + '>' + E(w > 0 ? f('resendIn', { s: w }) : t('resend')) + '</button> · ' +
      '<button type="button" class="linkish" data-act="other">' + E(t('other')) + '</button></p><p class="fine mb0">' + withMail(t('spam')) + '</p>');
    if (w > 0) tick();
  }

  /* ---------- the profile ---------- */
  function paintProfile() {
    var m = S.me, c = m.contact || {}, first = c.first_name || String(c.full_name || '').split(' ')[0] || '';
    var secs = ['details'].concat(m.volunteer ? ['vol', 'letters'] : ['vol']).concat(['gifts', 'emails']);
    // wave195b: a team or board member: the photo they have in the Hub (only from the Hub's avatars), their title, the Hub
    var tm = m.team || null, photo = tm && String(tm.photo || '').indexOf(SUPA + '/storage/v1/object/public/avatars/') === 0 ? String(tm.photo) : '';
    box.innerHTML = '<div class="acct-head"><div class="acct-who">' + (photo ? '<img class="acct-photo" src="' + E(photo) + '" alt="" width="72" height="72">' : '') +
      '<div><h2>' + E(first ? f('hi', { n: first }) : t('hiNone')) + '</h2><p class="fine mb0">' + E(f('signedAs', { e: m.email || '' })) +
      ' · <button type="button" class="linkish" data-act="out">' + E(t('out')) + '</button></p>' +
      (tm ? '<p class="fine mb0 acct-team">' + E(t('teamOn')) + (tm.title ? ' · ' + E(tm.title) : '') + ' · <a href="' + HUB + '">' + E(t('teamHub')) + '</a></p>' : '') +
      '</div></div><nav class="acct-nav" aria-label="' + E(t('navL')) + '"><ul>' +
      secs.map(function (s) { return '<li><a href="#a-' + s + '">' + E(t('nav_' + s)) + '</a></li>'; }).join('') + '</ul></nav></div>' + note('top') +
      '<div class="acct-secs">' + secs.map(function (s) { return '<section class="card acct-sec" id="a-' + s + '" aria-labelledby="a-' + s + '-h"></section>'; }).join('') +
      '<section class="card acct-sec acct-help"><h2>' + E(t('helpT')) + '</h2><p class="mb0">' + withMail(t('helpP')) + ' <a href="' + PRIV + '">' + E(t('privacy')) + '</a></p></section></div>';
    secs.forEach(sec);
  }
  var SECS = {};
  function sec(name) { var el = document.getElementById('a-' + name); if (el && SECS[name]) el.innerHTML = SECS[name](); }
  function head(name, title) { return '<h2 id="a-' + name + '-h">' + E(title) + '</h2>' + note(name); }

  // your details
  var FIELDS = [['first_name', 'given-name', 80], ['last_name', 'family-name', 80], ['pronouns', '', 40], ['phone', 'tel', 40], ['address', 'street-address', 200],
    ['city', 'address-level2', 80], ['province', 'address-level1', 40], ['postal_code', 'postal-code', 12], ['country', 'country-name', 60]];
  function langName(l) { return l === 'fr' ? t('langFr') : l === 'en' ? t('langEn') : ''; }
  SECS.details = function () {
    var c = S.me.contact || {}, h = head('details', t('detailsT'));
    if (!S.edit) {
      var rows = [[t('fName'), [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name], [t('f_pronouns'), c.pronouns], [t('f_email'), S.me.email], [t('f_phone'), c.phone],
        [t('fAddress'), [c.address, c.city, c.province, c.postal_code, c.country].filter(Boolean).join(', ')], [t('f_language'), langName(c.language)]];
      return h + '<p>' + E(t('detailsP')) + '</p><dl class="acct-dl">' + rows.map(function (r) {
        return '<div><dt>' + E(r[0]) + '</dt><dd>' + (r[1] ? E(r[1]) : '<span class="muted">' + E(t('notGiven')) + '</span>') + '</dd></div>';
      }).join('') + '</dl><div class="btns mt1"><button type="button" class="btn ghost small" data-act="edit">' + E(t('edit')) + '</button></div>';
    }
    var v = S.draft || {}, er = S.derrs || {};
    var input = function (fd) {
      var id = 'd-' + fd[0], e = er[fd[0]];
      return '<div class="q' + (e ? ' bad' : '') + '"><label for="' + id + '">' + E(t('f_' + fd[0])) + (fd[0] === 'first_name' ? '' : ' <span class="opt">' + E(t('optional')) + '</span>') + '</label>' +
        '<input id="' + id + '" name="' + fd[0] + '" type="' + (fd[0] === 'phone' ? 'tel' : 'text') + '"' + (fd[1] ? ' autocomplete="' + fd[1] + '"' : '') + ' maxlength="' + fd[2] + '" value="' + E(v[fd[0]] || '') + '"' +
        (e ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '') + '>' + (e ? '<p class="err" id="' + id + '-e">' + E(e) + '</p>' : '') + '</div>';
    };
    var lang = '<div class="q' + (er.language ? ' bad' : '') + '"><label for="d-language">' + E(t('f_language')) + '</label><select id="d-language" name="language">' +
      [['', t('langNone')], ['en', t('langEn')], ['fr', t('langFr')]].map(function (o) { return '<option value="' + o[0] + '"' + ((v.language || '') === o[0] ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') +
      '</select>' + (er.language ? '<p class="err">' + E(er.language) + '</p>' : '') + '</div>';
    return h + '<form class="acct-form" id="f-details" novalidate><div class="acct-cols">' + FIELDS.map(input).join('') + lang + '</div>' +
      '<p class="fine">' + E(t('emailNote')) + ' <a href="mailto:' + MAIL + '">' + MAIL + '</a>. <b>' + E(S.me.email || '') + '</b></p>' +
      '<div class="btns mt1"><button type="submit" class="btn small"' + (S.busyDetails ? ' disabled' : '') + '>' + E(S.busyDetails ? t('saving') : t('save')) + '</button>' +
      '<button type="button" class="btn ghost small" data-act="edit-cancel">' + E(t('cancel')) + '</button></div></form>';
  };
  function startEdit() {
    var c = S.me.contact || {}; S.draft = {}; S.derrs = {};
    FIELDS.forEach(function (fd) { S.draft[fd[0]] = c[fd[0]] || ''; }); S.draft.language = c.language || '';
    S.edit = true; say('details', ''); sec('details'); focus('d-first_name');
  }
  function onDetailsSubmit(fm) {
    if (S.busyDetails) return;
    var p = {}; FIELDS.forEach(function (fd) { p[fd[0]] = String(fm.elements[fd[0]].value || '').trim(); }); p.language = fm.elements.language.value || '';
    S.draft = p; S.derrs = {}; S.busyDetails = true; sec('details');
    WA.session().then(function (s) { return WA.rpc('account_update', { p: p }, s); }).then(function (r) {
      S.busyDetails = false;
      var b = r.body || {};
      if (r.ok && b.ok) {
        S.edit = false; say('details', (b.changed || []).length ? t('saved') : t('nothingChanged'));
        return WA.session().then(function (s) { return WA.rpc('account_me', { p_lang: LANG }, s); }).then(function (r2) { if (r2.ok && r2.body && r2.body.linked) S.me = r2.body; sec('details'); paintHead(); });
      }
      if (b.reason === 'invalid') { Object.keys(b.errors || {}).forEach(function (k) { S.derrs[k] = t('e_' + b.errors[k]); }); sec('details'); focus('d-' + Object.keys(S.derrs)[0]); return null; }
      if (b.reason === 'signin' || r.status === 401) return start();
      say('details', t('errServer'), 'warn'); sec('details');
      return null;
    }).catch(function () { S.busyDetails = false; say('details', t('errOffline'), 'warn'); sec('details'); });
  }
  function paintHead() { // the greeting follows a new first name
    var h = box.querySelector('.acct-head h2'), c = (S.me && S.me.contact) || {}, first = c.first_name || String(c.full_name || '').split(' ')[0] || '';
    if (h) h.textContent = first ? f('hi', { n: first }) : t('hiNone');
  }

  // your volunteering (volunteer_me, as on the Hub's volunteer page)
  SECS.vol = function () {
    var h = head('vol', t('volT2'));
    if (!S.me.volunteer) return h + '<p>' + E(t('volNoneP')) + '</p><div class="btns mt1"><a class="btn small" href="' + VOL_URL + '">' + E(t('volNoneBtn')) + '</a></div><p class="fine mt2 mb0">' + withMail(t('volOther')) + '</p>';
    var v = S.vol;
    if (!v) return h + '<p class="loading">' + E(t('loading2')) + '</p>';
    if (v.err) return h + '<p>' + E(t('errServer')) + '</p><button type="button" class="linkish" data-act="reload-vol">' + E(t('retry')) + '</button>';
    if (!v.linked) return h + '<p class="mb0">' + withMail(t('volNotLinked')) + '</p>';
    return h + volStats(v) + volUp(v) + volOpen(v) + volHist(v);
  };
  function volStats(m) {
    var n = Number(m.servings || 0), next = MILES.filter(function (x) { return x > n; })[0], prev = MILES.filter(function (x) { return x <= n; }).pop() || 0;
    var h = '<div class="stats"><div><b>' + n + '</b><span>' + E(n === 1 ? t('serving1') : t('servings')) + '</span></div><div><b>' + E(num(m.hours)) + '</b><span>' + E(t('hours')) + '</span></div>' +
      '<div><b>' + E(m.first_date ? String(m.first_date).slice(0, 4) : '–') + '</b><span>' + E(m.first_date ? f('since', { d: monthYear(m.first_date) }) : '') + '</span></div></div>';
    if (next) {
      var pct = Math.round(100 * (n - prev) / (next - prev));
      h += '<div class="mile"><img src="' + ST + 'brand/doodle-star-gold.png" alt="" width="30" height="30"><div class="in"><b>' +
        E(n && prev === n ? f('milestoneHit', { m: n }) : f('milestoneNext', { n: next - n, m: ordinal(next) })) + '</b><progress max="100" value="' + pct + '"></progress></div></div>';
    }
    if ((m.roles || []).length) h += '<ul class="chipsv" aria-label="' + E(t('rolesT')) + '">' + m.roles.map(function (r) { return '<li>' + E(rn(r)) + ' · ' + Number(r.n || 0) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  function volUp(m) {
    var up = m.upcoming || [];
    return '<h3>' + E(t('upT')) + '</h3>' + (up.length ? '<ul class="acct-list">' + up.map(function (o) {
      var st = o.state === 'confirmed' ? ['ok', t('stOk')] : o.state === 'declined' ? ['no', t('stNo')] : ['', t('stWait')];
      var tm = o.times && o.times.start ? ' · ' + hm(o.times.start) : '';
      return '<li><div class="d"><b>' + E(dDay(o.date)) + '</b><span>' + E(rn(o) + tm + ' · ' + (o.location || '')) + '</span></div><span class="st ' + st[0] + '">' + E(st[1]) + '</span>' +
        (o.token ? '<a href="' + HUB + '/c/' + encodeURIComponent(o.token) + '" rel="noopener">' + E(t('open')) + '</a>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="fine">' + E(t('upNone')) + '</p>');
  }
  function volOpen(m) {
    var ev = m.open || [];
    var h = '<h3>' + E(t('openT')) + '</h3>';
    if (!ev.length) return h + '<p class="fine">' + E(t('openNone')) + '</p>';
    return h + '<p class="fine">' + E(t('openP')) + '</p><ul class="acct-list">' + ev.map(function (e) {
      var ask = S.ask && S.ask.event_id === e.event_id ? S.ask : null;
      return '<li class="col"><div class="d"><b>' + E(dDay(e.date)) + '</b><span>' + E(hm(e.start) + ' · ' + (e.location || '')) + '</span></div><div class="opens">' +
        (e.roles || []).map(function (r) {
          return '<button type="button" data-act="join" data-ev="' + e.event_id + '" data-role="' + E(r.role) + '">' + E(rn(r)) + '<small>' + E(Number(r.left) === 1 ? t('spots1') : f('spotsN', { n: r.left })) + '</small></button>';
        }).join('') + '</div>' +
        (ask ? '<div class="ask" role="alertdialog" aria-label="' + E(f('askT', { r: rn(ask).toLowerCase(), d: dDay(e.date) })) + '"><b>' + E(f('askT', { r: rn(ask).toLowerCase(), d: dDay(e.date) })) + '</b>' +
          '<div class="btns"><button type="button" class="btn small" data-act="join-yes"' + (S.busyJoin ? ' disabled' : '') + '>' + E(t('askYes')) + '</button><button type="button" class="btn ghost small" data-act="join-no">' + E(t('askNo')) + '</button></div></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function volHist(m) {
    var hs = m.history || [], shown = S.allHist ? hs : hs.slice(0, 6);
    return '<h3>' + E(t('histT')) + '</h3>' + (hs.length ? '<ul class="acct-list">' + shown.map(function (o) {
      var sv = o.survey === 'answered' ? '<span class="st ok">' + E(t('surveyDone')) + '</span>' : (o.survey === 'open' && o.token ? '<a href="' + HUB + '/c/' + encodeURIComponent(o.token) + '#survey" rel="noopener">' + E(t('survey')) + '</a>' : '');
      return '<li><div class="d"><b>' + E(dDay(o.date)) + '</b><span>' + E(rn(o) + ' · ' + (o.location || '')) + '</span></div>' + sv + '</li>';
    }).join('') + '</ul>' + (hs.length > shown.length ? '<p class="mt1 mb0"><button type="button" class="linkish" data-act="all-hist">' + E(f('showAll', { n: hs.length })) + '</button></p>' : '') : '<p class="fine mb0">' + E(t('histNone')) + '</p>');
  }
  function join() {
    var a = S.ask; if (!a || S.busyJoin) return;
    S.busyJoin = true; sec('vol');
    WA.session().then(function (s) { return WA.rpc('volunteer_me_signup', { p_event: a.event_id, p_role: a.role }, s); }).then(function (r) {
      S.busyJoin = false; S.ask = null;
      var b = r.body || {};
      if (r.ok && b.ok) say('vol', f('joined', { r: rn(a).toLowerCase(), d: dDay(a.date) }));
      else say('vol', b.reason === 'full' ? t('full') : b.reason === 'already' ? t('already') : t('errServer'), 'warn');
      return loadVol();
    }).catch(function () { S.busyJoin = false; say('vol', t('errOffline'), 'warn'); sec('vol'); });
  }

  // letters and sign-offs (account_signoffs; the request through account_signoff_request, a form uploaded first)
  var KINDS = ['hours', 'recognition', 'form'];
  SECS.letters = function () {
    var h = head('letters', t('lettersT')), so = S.so;
    if (!so) return h + '<p class="loading">' + E(t('loading2')) + '</p>';
    if (so.err) return h + '<p>' + E(t('errServer')) + '</p><button type="button" class="linkish" data-act="reload-so">' + E(t('retry')) + '</button>';
    var list = so.requests || [], waiting = list.filter(function (r) { return r.status === 'requested'; }).length;
    h += '<p>' + E(t('lettersP')) + '</p>';
    if (list.length) h += '<ul class="acct-list">' + list.map(reqItem).join('') + '</ul>';
    if (!Number(so.servings || 0)) h += '<p class="fine mt1 mb0">' + E(t('lettersNone')) + '</p>';
    else if (S.req) h += reqForm();
    else if (waiting >= Number(so.max_open || 3)) h += '<p class="fine mt1">' + E(f('tooMany', { n: waiting })) + '</p>';
    else h += '<div class="btns mt1"><button type="button" class="btn small" data-act="ask">' + E(t('askBtn')) + '</button></div>';
    if (Number(so.servings || 0) && !S.req) h += '<div class="acct-quick"><h3>' + E(t('quickT')) + '</h3><p>' + E(t('quickP')) + '</p><button type="button" class="linkish" data-act="summary"' + (S.busyLetter ? ' disabled' : '') + '>' + E(t('quickBtn')) + '</button></div>';
    return h;
  };
  function reqItem(r) {
    var fem = r.kind !== 'form', st;
    if (r.status === 'signed') st = '<span class="st ok">' + E(f(fem ? 'stSigned' : 'stSignedM', { d: dLong(r.signed) })) + '</span>';
    else if (r.status === 'declined') st = '<span class="st no">' + E(f(fem ? 'stDeclined' : 'stDeclinedM', { d: dLong(r.declined) })) + '</span>';
    else st = '<span class="st">' + E(t('stWaiting')) + '</span>';
    var meta = [f('asked', { d: dLong(r.requested) }), r.for_org ? f('forOrg', { o: r.for_org }) : '', r.reference ? f('ref', { r: r.reference }) : '',
      r.status === 'signed' && r.signer ? f(fem ? 'signedBy' : 'signedByM', { s: r.signer }) : ''].filter(Boolean).join(' · ');
    var act = '';
    if (r.status === 'signed' && r.letter) act = '<button type="button" class="btn small" data-act="dl-signoff" data-id="' + Number(r.id) + '">' + E(t('download')) + '</button>';
    else if (r.status === 'requested') {
      act = S.cancelAsk === r.id ? '<span class="acct-confirm"><b>' + E(t('cancelAsk')) + '</b> <button type="button" class="linkish" data-act="cancel-yes" data-id="' + Number(r.id) + '">' + E(t('cancelYes')) + '</button> · ' +
        '<button type="button" class="linkish" data-act="cancel-no">' + E(t('cancelNo')) + '</button></span>' : '<button type="button" class="linkish" data-act="cancel-ask" data-id="' + Number(r.id) + '">' + E(t('cancelReq')) + '</button>';
    }
    return '<li><div class="d"><b>' + E(t('k_' + r.kind)) + '</b> ' + st + '<span>' + E(meta) + '</span>' +
      (r.status === 'declined' && r.decline_reason ? '<span>' + E(f('declinedWhy', { r: r.decline_reason })) + '</span>' : '') + '</div>' + act + '</li>';
  }
  function reqForm() {
    var R = S.req, k = R.kind || 'hours', e = R.errs || {};
    var txt = function (name, label, help, val, max, err, area) {
      var id = 'r-' + name;
      return '<div class="q' + (err ? ' bad' : '') + '"><label for="' + id + '">' + E(label) + ' <span class="opt">' + E(t('optional')) + '</span></label>' + (help ? '<p class="help" id="' + id + '-h">' + E(help) + '</p>' : '') +
        (area ? '<textarea id="' + id + '" name="' + name + '" maxlength="' + max + '"' + (help ? ' aria-describedby="' + id + '-h"' : '') + '>' + E(val || '') + '</textarea>'
          : '<input id="' + id + '" name="' + name + '" type="text" maxlength="' + max + '" value="' + E(val || '') + '"' + (help ? ' aria-describedby="' + id + '-h"' : '') + '>') +
        (err ? '<p class="err">' + E(err) + '</p>' : '') + '</div>';
    };
    return '<form class="acct-form acct-req" id="f-req" novalidate><fieldset class="q"><legend>' + E(t('reqKind')) + '</legend><div class="choices">' + KINDS.map(function (x) {
      return '<label class="choice"><input type="radio" name="kind" value="' + x + '"' + (k === x ? ' checked' : '') + '><span><b>' + E(t('k_' + x)) + '</b><br><span class="fine">' + E(t('k_' + x + 'D')) + '</span></span></label>';
    }).join('') + '</div></fieldset>' +
      (k === 'form' ? '<div class="q' + (e.form ? ' bad' : '') + '"><label for="r-file">' + E(t('reqFile')) + '</label><p class="help" id="r-file-h">' + E(t('reqFileH')) + '</p>' +
        '<input id="r-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" aria-describedby="r-file-h">' +
        (S.reqFile ? '<p class="fine mt1 mb0">' + E(f('reqChosen', { n: S.reqFile.name })) + '</p>' : '') + (e.form ? '<p class="err">' + E(e.form) + '</p>' : '') + '</div>' : '') +
      txt('for_org', t('reqFor'), t('reqForH'), R.for_org, 120, e.for_org) +
      txt('purpose', t('reqPurpose'), t('reqPurposeH'), R.purpose, 300, e.purpose) +
      (k !== 'recognition' ? '<div class="acct-cols2"><div class="q"><label for="r-from">' + E(t('reqFrom')) + ' <span class="opt">' + E(t('optional')) + '</span></label><input id="r-from" name="period_from" type="date" value="' + E(R.period_from || '') + '"></div>' +
        '<div class="q"><label for="r-to">' + E(t('reqTo')) + ' <span class="opt">' + E(t('optional')) + '</span></label><input id="r-to" name="period_to" type="date" value="' + E(R.period_to || '') + '"></div></div>' +
        '<p class="help">' + E(t('reqPeriodH')) + '</p>' + (e.period ? '<p class="err">' + E(e.period) + '</p>' : '') : '') +
      txt('notes', t('reqNotes'), '', R.notes, 1000, e.notes, true) +
      '<div class="btns mt1"><button type="submit" class="btn small"' + (S.busyReq ? ' disabled' : '') + '>' + E(S.busyReq ? t('sending') : t('reqSend')) + '</button>' +
      '<button type="button" class="btn ghost small" data-act="ask-cancel">' + E(t('cancel')) + '</button></div></form>';
  }
  function collectReq(fm) {
    var el = fm.elements, kind = (fm.querySelector('input[name="kind"]:checked') || {}).value || 'hours';
    var g = function (n) { return el[n] ? String(el[n].value || '').trim() : ''; };
    return { kind: kind, for_org: g('for_org'), purpose: g('purpose'), period_from: g('period_from'), period_to: g('period_to'), notes: g('notes'), errs: {} };
  }
  function uploadForm(file) {
    return WA.session().then(function (s) {
      if (!s) { var x = new Error('signin'); x.code = 'signin'; throw x; }
      return fetch(FN, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', type: file.type, bytes: file.size, name: file.name }) }).then(json);
    }).then(function (r) {
      if (!r.ok || !r.body.url || !r.body.path) { var x = new Error('upload'); x.code = r.body.error || 'upload'; throw x; }
      var fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', file);
      return fetch(r.body.url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: fd }).then(function (u) {
        if (!u.ok) { var x = new Error('upload'); x.code = 'upload'; throw x; }
        return r.body.path;
      });
    });
  }
  function onReqSubmit(fm) {
    if (S.busyReq) return;
    var R = collectReq(fm), file = S.reqFile; S.req = R;
    if (R.kind === 'form') {
      if (!file) R.errs.form = t('e_form');
      else if (!/^(application\/pdf|image\/png|image\/jpeg)$/.test(file.type)) R.errs.form = t('e_type');
      else if (file.size > 10485760) R.errs.form = t('e_size');
    }
    if (R.kind !== 'recognition' && R.period_from && R.period_to && R.period_from > R.period_to) R.errs.period = t('e_order');
    if (Object.keys(R.errs).length) { sec('letters'); return; }
    S.busyReq = true; say('letters', ''); sec('letters');
    (R.kind === 'form' ? uploadForm(file) : Promise.resolve('')).then(function (path) {
      return WA.session().then(function (s) {
        return WA.rpc('account_signoff_request', { p: { kind: R.kind, lang: LANG, for_org: R.for_org, purpose: R.purpose, notes: R.notes,
          period_from: R.kind === 'recognition' ? '' : R.period_from, period_to: R.kind === 'recognition' ? '' : R.period_to,
          form_path: path || '', form_name: R.kind === 'form' && file ? file.name : '' } }, s);
      });
    }).then(function (r) {
      S.busyReq = false;
      var b = r.body || {};
      if (r.ok && b.ok) { S.req = null; S.reqFile = null; say('letters', t('reqSent')); return loadSo(); }
      if (b.reason === 'invalid') {
        var er = b.errors || {};
        Object.keys(er).forEach(function (k) { R.errs[k] = t('e_' + er[k]); });
        sec('letters'); return null;
      }
      say('letters', b.reason === 'too_many' ? f('tooMany', { n: b.max_open || 3 }) : b.reason === 'no_servings' ? t('lettersNone') : t('errServer'), 'warn'); sec('letters');
      return null;
    }).catch(function (x) {
      S.busyReq = false;
      var c = x && x.code;
      if (c === 'type' || c === 'size') R.errs.form = t('e_' + c);
      else if (c === 'too_many') R.errs.form = t('e_files');
      else if (c === 'upload') R.errs.form = t('e_upload');
      else say('letters', t('errOffline'), 'warn');
      sec('letters');
    });
  }
  function cancelReq(id) {
    S.cancelAsk = null;
    WA.session().then(function (s) { return WA.rpc('account_signoff_cancel', { p_id: Number(id) }, s); }).then(function (r) {
      say('letters', r.ok && r.body && r.body.ok ? t('cancelled') : t('errServer'), r.ok && r.body && r.body.ok ? 'info' : 'warn');
      return loadSo();
    }).catch(function () { say('letters', t('errOffline'), 'warn'); sec('letters'); });
  }
  function download(kind, id) {
    var where = kind === 'receipt' ? 'gifts' : 'letters';
    WA.session().then(function (s) {
      if (!s) return { ok: false, body: {} };
      return fetch(FN, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'file', kind: kind, id: Number(id) }) }).then(json);
    }).then(function (r) {
      if (r.ok && r.body.url) { window.location.href = r.body.url; return; }
      say(where, t('errFile'), 'warn'); sec(where);
    }).catch(function () { say(where, t('errOffline'), 'warn'); sec(where); });
  }
  function summary() {
    if (S.busyLetter) return;
    S.busyLetter = true; sec('letters');
    WA.session().then(function (s) { return WA.rpc('volunteer_me_letter', {}, s); }).then(function (r) {
      S.busyLetter = false;
      if (r.ok && r.body && r.body.ok) { S.letter = r.body; S.view = 'letter'; paint(); try { window.scrollTo(0, 0); } catch (e) { /* fine */ } return; }
      say('letters', t('errServer'), 'warn'); sec('letters');
    }).catch(function () { S.busyLetter = false; say('letters', t('errOffline'), 'warn'); sec('letters'); });
  }
  function paintLetter() {
    var Lt = S.letter, nm = String(Lt.name || '').trim(), fn = nm.split(/\s+/)[0] || nm, n = Number(Lt.servings || 0);
    var body2 = n === 1 ? f('lBody2one', { a: dLong(Lt.first_date), f: fn, h: num(Lt.hours), r: joinRoles(Lt.roles) })
      : f('lBody2', { a: dLong(Lt.first_date), b: dLong(Lt.last_date), f: fn, s: n, h: num(Lt.hours), r: joinRoles(Lt.roles) });
    box.innerHTML = '<div class="acct-letter-bar noprint"><button type="button" class="btn small" data-act="print">' + E(t('print')) + '</button>' +
      '<button type="button" class="btn ghost small" data-act="back">' + E(t('back')) + '</button></div>' +
      '<article class="acct-letter" id="letterdoc"><div class="lh"><img src="/assets/logo-green.svg" alt="Welfare Avenue" width="130" height="44"><small>Welfare Avenue<br>' + MAIL +
      ' · welfareavenue.com<br>' + E(t('charity')) + '</small></div><p>' + E(dLong(Lt.issued)) + '</p><p>' + E(t('lTo')) + '</p><p>' + E(f('lBody1', { n: nm })) + '</p>' +
      '<p>' + E(body2) + '</p><p>' + E(f('lBody3', { f: fn })) + '</p><p class="sig">' + E(t('lSig')) + '</p><p class="ref">' + E(f('lRef', { ref: Lt.ref, d: dLong(Lt.issued) })) + '</p></article>';
  }

  // gifts and receipts
  SECS.gifts = function () {
    var m = S.me, g = m.gifts || [], tot = m.gift_totals || {}, rc = m.receipts || [], h = head('gifts', t('giftsT'));
    if (!g.length) h += '<p>' + E(t('giftsNone')) + '</p>';
    else {
      h += '<p>' + E(Number(tot.count) === 1 ? f('gifts1', { t: money(tot.total), d: dLong(tot.since) }) : f('giftsN', { n: Number(tot.count || g.length), t: money(tot.total), d: dLong(tot.since) })) + '</p>';
      var shown = S.allGifts ? g : g.slice(0, 8);
      h += '<ul class="acct-list">' + shown.map(function (x) {
        var tags = [x.recurring ? t('monthly') : '', x.refunded ? t('refunded') : ''].filter(Boolean);
        var rec = x.receipt ? f('receiptN', { s: x.receipt.serial }) : x.receipt_number ? f('oldReceipt', { n: x.receipt_number }) : '';
        return '<li><div class="d"><b>' + E(money(x.amount, x.currency)) + '</b><span>' + E([dLong(x.date), x.campaign].filter(Boolean).join(' · ')) + '</span>' + (rec ? '<span>' + E(rec) + '</span>' : '') + '</div>' +
          tags.map(function (tg) { return '<span class="st">' + E(tg) + '</span>'; }).join('') + '</li>';
      }).join('') + '</ul>' + (g.length > shown.length ? '<p class="mt1 mb0"><button type="button" class="linkish" data-act="all-gifts">' + E(f('showAll', { n: g.length })) + '</button></p>' : '');
    }
    h += '<h3>' + E(t('receiptsT')) + '</h3>';
    if (!rc.length) h += '<p class="fine">' + E(t('receiptsNone')) + '</p>';
    else h += '<ul class="acct-list">' + rc.map(function (r) {
      return '<li><div class="d"><b>' + E(f('receiptN', { s: r.serial })) + '</b><span>' + E(f('receiptFor', { y: r.year, a: money(r.eligible) })) + '</span><span>' + E(f('issued', { d: dLong(r.issued) })) + '</span></div>' +
        (r.pdf ? '<button type="button" class="btn small" data-act="dl-receipt" data-id="' + Number(r.id) + '">' + E(t('download')) + '</button>' : '') + '</li>';
    }).join('') + '</ul>';
    return h + '<div class="btns mt1"><a class="btn ghost small" href="' + GIVE + '" data-wa-donate>' + E(t('giveBtn')) + '</a></div>';
  };

  // email preferences
  SECS.emails = function () {
    var n = S.me.newsletter || {}, h = head('emails', t('emailsT'));
    if (n.blocked) return h + '<p class="mb0">' + withMail(t('newsBlocked')) + '</p>';
    h += '<p>' + E(n.on ? t('newsOn') : t('newsOff')) + (n.on && n.since ? ' ' + E(f('newsSince', { d: dLong(n.since) })) : '') + '</p>';
    h += '<div class="btns mt1"><button type="button" class="btn small' + (n.on ? ' ghost' : '') + '" data-act="news" data-on="' + (n.on ? '0' : '1') + '"' + (S.busyNews ? ' disabled' : '') + '>' +
      E(n.on ? t('newsTurnOff') : t('newsTurnOn')) + '</button></div>' + (n.on ? '' : '<p class="fine mt1">' + E(t('newsOnNote')) + '</p>');
    return h + '<p class="fine mt1 mb0">' + E(t('newsNote')) + '</p>';
  };
  function news(on) {
    if (S.busyNews) return;
    S.busyNews = true; sec('emails');
    WA.session().then(function (s) { return WA.rpc('account_newsletter', { p_on: on }, s); }).then(function (r) {
      S.busyNews = false;
      var b = r.body || {};
      if (r.ok && b.ok) {
        var n = S.me.newsletter = S.me.newsletter || {};
        n.on = on; n.status = on ? 'subscribed' : 'unsubscribed'; if (on) n.since = new Date().toISOString().slice(0, 10);
        say('emails', on ? t('newsDoneOn') : t('newsDoneOff'));
      } else if (b.reason === 'blocked') { S.me.newsletter.blocked = true; say('emails', ''); }
      else say('emails', t('errServer'), 'warn');
      sec('emails');
    }).catch(function () { S.busyNews = false; say('emails', t('errOffline'), 'warn'); sec('emails'); });
  }

  /* ---------- what people press ---------- */
  box.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el || !box.contains(el)) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (el.tagName === 'BUTTON') ev.preventDefault();
    if (act === 'out') signOut();
    else if (act === 'retry') start();
    else if (act === 'other') { S.view = 'signin'; S.err = {}; say('top', ''); paint(); focus('a-email'); }
    else if (act === 'resend') {
      if (S.busy || Date.now() - S.sentAt < 30000) return;
      S.busy = true;
      sendCode(S.email, '').then(function (r) {
        S.busy = false;
        if (r.ok && r.body.ok) { S.sentAt = Date.now(); say('top', t('resent')); } else say('top', codeError(r.body.error), 'warn');
        paint();
      }, function () { S.busy = false; say('top', t('errOffline'), 'warn'); paint(); });
    }
    else if (act === 'edit') startEdit();
    else if (act === 'edit-cancel') { S.edit = false; S.derrs = {}; sec('details'); }
    else if (act === 'reload-vol') { S.vol = null; sec('vol'); loadVol(); }
    else if (act === 'reload-so') { S.so = null; sec('letters'); loadSo(); }
    else if (act === 'all-hist') { S.allHist = true; sec('vol'); }
    else if (act === 'all-gifts') { S.allGifts = true; sec('gifts'); }
    else if (act === 'join') {
      var evId = el.getAttribute('data-ev'), role = el.getAttribute('data-role');
      var e2 = ((S.vol && S.vol.open) || []).filter(function (x) { return String(x.event_id) === evId; })[0]; if (!e2) return;
      var r2 = (e2.roles || []).filter(function (x) { return x.role === role; })[0]; if (!r2) return;
      S.ask = { event_id: e2.event_id, date: e2.date, role: r2.role, role_en: r2.role_en, role_fr: r2.role_fr }; say('vol', ''); sec('vol');
      var yes = box.querySelector('[data-act="join-yes"]'); if (yes) yes.focus();
    }
    else if (act === 'join-yes') join();
    else if (act === 'join-no') { S.ask = null; sec('vol'); }
    else if (act === 'ask') { S.req = { kind: 'hours', errs: {} }; S.reqFile = null; say('letters', ''); sec('letters'); var k = box.querySelector('#f-req input[name="kind"]'); if (k) k.focus(); }
    else if (act === 'ask-cancel') { S.req = null; S.reqFile = null; sec('letters'); }
    else if (act === 'cancel-ask') { S.cancelAsk = Number(id); sec('letters'); }
    else if (act === 'cancel-no') { S.cancelAsk = null; sec('letters'); }
    else if (act === 'cancel-yes') cancelReq(id);
    else if (act === 'dl-signoff') download('signoff', id);
    else if (act === 'dl-receipt') download('receipt', id);
    else if (act === 'summary') summary();
    else if (act === 'print') window.print();
    else if (act === 'back') { S.letter = null; S.view = 'profile'; paint(); var a = document.getElementById('a-letters'); if (a) { try { a.scrollIntoView(); } catch (e) { /* fine */ } } }
    else if (act === 'news') news(el.getAttribute('data-on') === '1');
  });
  box.addEventListener('submit', function (ev) {
    var fm = ev.target; if (!fm || !fm.id) return;
    ev.preventDefault();
    if (fm.id === 'f-code') onCodeSubmit(fm);
    else if (fm.id === 'f-otp') onOtpSubmit(fm);
    else if (fm.id === 'f-details') onDetailsSubmit(fm);
    else if (fm.id === 'f-req') onReqSubmit(fm);
  });
  box.addEventListener('change', function (ev) {
    var el = ev.target; if (!el || !el.form || el.form.id !== 'f-req') return;
    if (el.name === 'kind') { var R = collectReq(el.form); S.req = R; sec('letters'); var k = box.querySelector('#f-req input[name="kind"]:checked'); if (k) k.focus(); }
    else if (el.name === 'file') {
      S.reqFile = el.files && el.files[0] ? el.files[0] : null;
      if (S.req) { S.req.errs = S.req.errs || {}; delete S.req.errs.form; }
      var q2 = el.closest('.q'); // a chosen file clears the "add your form" note without redrawing the input
      if (q2) { q2.classList.remove('bad'); Array.prototype.forEach.call(q2.querySelectorAll('.err, .fine'), function (n) { n.parentNode.removeChild(n); }); }
    }
  });

  start();
})();
