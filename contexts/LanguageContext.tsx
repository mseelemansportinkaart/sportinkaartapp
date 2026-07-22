import React, { createContext, ReactNode, useContext, useState } from 'react';

type Language = 'nl' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
  nl: {
    // Home screen
    'home.tagline': 'Vind jouw perfecte sportclub in de regio',
    'home.loading': 'Regio\'s laden...',
    'home.error': 'Fout bij laden van regio\'s:',
    'home.retry': 'Opnieuw proberen',
    'home.noRegions': 'Geen regio\'s beschikbaar',
    'home.noRegionsSubtext': 'Check binnenkort opnieuw voor nieuwe regio\'s',
    'home.discover': 'Ontdek sportclubs in',
    'home.moreRegions': 'Meer regio\'s komen binnenkort',
    'home.favorites': 'Favorieten',
    'home.contact': 'Suggestie of vraag?',
    'home.map': 'Kaart',
    'home.locationCountLabel': 'locaties',
    'home.locationCountError': 'Kan locaties niet laden. Probeer het later opnieuw.',
    'home.locationCountErrorShort': 'Laden mislukt',
    'home.comingSoon': 'Binnenkort',
    'home.underConstruction': 'In ontwikkeling',
    'location.permissionTitle': 'Locatie gebruiken?',
    'location.permissionMessage': 'We gebruiken je locatie om sportlocaties in de buurt te kunnen tonen.',
    'location.permissionAllow': 'Toestaan',
    'location.permissionDeny': 'Niet nu',
    'location.permissionDenied': 'Locatie is uitgeschakeld. Je kunt dit altijd aanzetten in de instellingen.',
    'location.permissionSettingsTitle': 'Locatie inschakelen',
    'location.permissionSettingsMessage': 'Zet locatie-toestemming aan in de instellingen om de kaart te centreren op jouw locatie.',
    'location.permissionSettingsOpen': 'Open instellingen',
    'location.permissionSettingsClose': 'Sluiten',

    // Map screen
    'map.loading': 'Kaart laden...',
    'map.loadError': 'Fout bij laden',
    'map.back': 'Terug',
    'map.available': 'Beschikbaar',
    'map.comingSoon': 'Binnenkort',
    'map.markerAvailable': 'Tik om te bekijken',
    'map.markerComingSoon': 'Binnenkort beschikbaar',

    // Region screen
    'region.back': 'Terug',
    'region.locations': 'Sportlocaties',
    'region.locationsFound': 'locaties gevonden',
    'region.search': 'Zoek op naam of sport...',
    'region.filters': 'Filters',
    'region.hideFilters': 'Verberg filters',
    'region.sport': 'Sport',
    'region.facilities': 'Faciliteiten',
    'region.cost': 'Kosten',
    'region.costPerYear': 'Kosten per jaar',
    'region.loading': 'Locaties laden...',
    'region.error': 'Fout bij laden van locaties:',
    'region.noLocations': 'Geen locaties gevonden',
    'region.noLocationsSubtext': 'Probeer de filters aan te passen',
    'region.featured': 'Featured',
    'region.partner': 'Partner',
    'region.moreInfo': 'Meer info',
    'region.contactQuestion': 'Suggestie of vraag?',
    'region.costFromMonthly': 'Vanaf €{amount} per maand',
    'region.costFromYearly': 'Vanaf €{amount} per jaar',
    'region.costFromLesson': 'Vanaf €{amount} per les',

    // Filters
    'filter.selectSport': 'Selecteer sport',
    'filter.selectFacilities': 'Selecteer faciliteiten',
    'filter.allSports': 'Alle sporten',
    'filter.allFacilities': 'Alle faciliteiten',
    'filter.apply': 'Toepassen',
    'filter.min': 'Min €',
    'filter.max': 'Max €',
    'filter.youth': 'Jeugd',
    'filter.adults': 'Volwassenen',
    'filter.selected': 'geselecteerd',
    'filter.active': 'Actief',
    'filter.select': 'Selecteer',
    'filter.resetAll': 'Reset alle filters',
    'filter.confirm': 'Bevestig',
    'filter.distance': 'Afstand',
    'filter.allDistances': 'Alle',
    'filter.costStructure': 'Kosten',
    'filter.costRange': 'Kosten (min/max)',
    'filter.resetCost': 'Reset kosten filters',

    // Favorites screen
    'favorites.title': 'Mijn favorieten',
    'favorites.subtitle': 'favoriet',
    'favorites.subtitlePlural': 'favorieten',
    'favorites.noFavorites': 'Nog geen favorieten',
    'favorites.noFavoritesSubtext': 'Ontdek sportclubs in jouw regio en voeg ze toe aan je favorieten door op het hartje te tikken!',
    'favorites.back': 'Terug',
    'favorites.loading': 'Favorieten laden...',
    'favorites.removeTitle': 'Favoriet verwijderen',
    'favorites.removeMessage': 'Weet je zeker dat je {name} wilt verwijderen uit je favorieten?',
    'favorites.cancel': 'Annuleren',
    'favorites.remove': 'Verwijderen',
    'favorites.removeError': 'Er ging iets mis bij het verwijderen van je favoriet',
    'favorites.error': 'Fout',
    'favorites.discoverClubs': 'Clubs ontdekken',
    'favorites.searchPlaceholder': 'Zoek in je favorieten...',
    'favorites.statFavorites': 'Favorieten',
    'favorites.statSports': 'Sporten',
    'favorites.noResults': 'Geen favorieten gevonden voor',
    'favorites.becomeMember': 'Lid worden',
    'favorites.notAvailable': 'Niet beschikbaar',
    'favorites.moreInfo': 'Meer info',
    'favorites.contact': 'Suggestie of vraag?',

    // Footer
    'footer.missingLocation': 'Mist een locatie? Neem contact met ons op!',

    // Language
    'language.dutch': 'Nederlands',
    'language.english': 'English',
    'language.selectLanguage': 'Select language',

    // Suggestion Form
    'form.selectType': 'Hoe kunnen we helpen?',
    'form.selectTypeSubtitle': 'Selecteer het type vraag of suggestie',
    'form.addLocation': 'Nieuwe locatie toevoegen',
    'form.addLocationDesc': 'Voeg een sportlocatie toe die nog niet op de kaart staat',
    'form.changeLocation': 'Informatie wijzigen',
    'form.changeLocationDesc': 'Wijzig of update informatie van een bestaande locatie',
    'form.otherQuestion': 'Andere vraag',
    'form.otherQuestionDesc': 'Stel een andere vraag of stuur een bericht',
    'form.cancel': 'Annuleren',
    'form.back': 'Terug',
    'form.submit': 'Versturen',
    'form.ok': 'OK',

    // Add Location Form
    'form.addLocationSubtitle': 'Vul de details van de nieuwe locatie in',
    'form.locationDetails': 'Locatie details',
    'form.locationName': 'Naam locatie',
    'form.locationNamePlaceholder': 'Bijv. Sportclub Amsterdam',
    'form.sport': 'Sport',
    'form.sportPlaceholder': 'Bijv. Voetbal, Tennis, Zwemmen',
    'form.address': 'Adres',
    'form.addressPlaceholder': 'Straat, huisnummer, postcode, plaats',
    'form.yourDetails': 'Jouw gegevens',
    'form.name': 'Naam',
    'form.namePlaceholder': 'Jouw naam',
    'form.email': 'E-mail',
    'form.emailPlaceholder': 'jouw@email.nl',
    'form.customerDetails': 'Contactgegevens',

    // Change Location Form
    'form.changeLocationSubtitle': 'Welke informatie wil je wijzigen?',
    'form.changeDetails': 'Wijzigingsdetails',
    'form.existingLocation': 'Welke locatie',
    'form.existingLocationPlaceholder': 'Naam van de bestaande locatie',
    'form.city': 'Stad',
    'form.selectCity': 'Selecteer een stad',
    'form.selectFacility': 'Selecteer een locatie',
    'form.noCities': 'Geen steden beschikbaar',
    'form.noFacilities': 'Geen locaties beschikbaar',
    'form.cityLoadError': 'Kan steden niet laden. Probeer het later opnieuw.',
    'form.facilityLoadError': 'Kan locaties niet laden. Probeer het later opnieuw.',
    'form.changeInfo': 'Wat moet er aangepast worden',
    'form.changeInfoPlaceholder': 'Beschrijf wat er gewijzigd moet worden',

    // Email subjects and bodies
    'form.addLocationSubject': 'Nieuwe locatie toevoegen - Sportinkaart',
    'form.addLocationBody': 'Nieuwe locatie aanvraag:',
    'form.changeLocationSubject': 'Locatie informatie wijzigen - Sportinkaart',
    'form.changeLocationBody': 'Wijzigingsverzoek:',
    'form.otherQuestionSubject': 'Vraag over Sportinkaart',

    // Validation and errors
    'form.errorTitle': 'Fout',
    'form.successTitle': 'Gelukt',
    'form.fillAllFields': 'Vul alle verplichte velden in',
    'form.invalidEmail': 'Voer een geldig e-mailadres in',
    'form.emailOpened': 'Je e-mail app is geopend. Verstuur de e-mail om je aanvraag in te dienen.',
    'form.cannotOpenEmail': 'Kan e-mail app niet openen. Neem contact op via info@sportinkaart.nl',
    'form.emailError': 'Er is een fout opgetreden bij het openen van de e-mail app',
    'form.sending': 'Versturen...',
    'form.emailSent': 'Je aanvraag is succesvol verzonden! We nemen zo snel mogelijk contact met je op.',
    'form.emailSendError': 'Er is een fout opgetreden bij het verzenden. Probeer het later opnieuw of neem contact op via info@sportinkaart.nl',
  },
  en: {
    // Home screen
    'home.tagline': 'Find your perfect sports location in the region',
    'home.loading': 'Loading regions...',
    'home.error': 'Error loading regions:',
    'home.retry': 'Try again',
    'home.noRegions': 'No regions available',
    'home.noRegionsSubtext': 'Check back soon for new regions',
    'home.discover': 'Discover sports locations in',
    'home.moreRegions': 'More regions coming soon',
    'home.favorites': 'Favorites',
    'home.contact': 'Suggestion or question?',
    'home.map': 'Map',
    'home.locationCountLabel': 'locations',
    'home.locationCountError': 'Unable to load locations. Please try again later.',
    'home.locationCountErrorShort': 'Load failed',
    'home.comingSoon': 'Coming soon',
    'home.underConstruction': 'Under construction',
    'location.permissionTitle': 'Use your location?',
    'location.permissionMessage': 'We use your location to show nearby sports locations.',
    'location.permissionAllow': 'Allow',
    'location.permissionDeny': 'Not now',
    'location.permissionDenied': 'Location is disabled. You can enable it in settings.',
    'location.permissionSettingsTitle': 'Enable location',
    'location.permissionSettingsMessage': 'Enable location permission in settings to center the map on your location.',
    'location.permissionSettingsOpen': 'Open settings',
    'location.permissionSettingsClose': 'Close',

    // Map screen
    'map.loading': 'Loading map...',
    'map.loadError': 'Error loading',
    'map.back': 'Back',
    'map.available': 'Available',
    'map.comingSoon': 'Coming soon',
    'map.markerAvailable': 'Tap to view',
    'map.markerComingSoon': 'Coming soon',

    // Region screen
    'region.back': 'Back',
    'region.locations': 'Sports locations',
    'region.locationsFound': 'locations found',
    'region.search': 'Search by name or sport...',
    'region.filters': 'Filters',
    'region.hideFilters': 'Hide filters',
    'region.sport': 'Sport',
    'region.facilities': 'Facilities',
    'region.cost': 'Cost',
    'region.costPerYear': 'Cost per year',
    'region.loading': 'Loading locations...',
    'region.error': 'Error loading locations:',
    'region.noLocations': 'No locations found',
    'region.noLocationsSubtext': 'Try adjusting the filters',
    'region.featured': 'Featured',
    'region.partner': 'Partner',
    'region.moreInfo': 'More info',
    'region.contactQuestion': 'Suggestion or question?',
    'region.costFromMonthly': 'From €{amount} per month',
    'region.costFromYearly': 'From €{amount} per year',
    'region.costFromLesson': 'From €{amount} per lesson',

    // Filters
    'filter.selectSport': 'Select sport',
    'filter.selectFacilities': 'Select facilities',
    'filter.allSports': 'All sports',
    'filter.allFacilities': 'All facilities',
    'filter.apply': 'Apply',
    'filter.min': 'Min €',
    'filter.max': 'Max €',
    'filter.youth': 'Youth',
    'filter.adults': 'Adults',
    'filter.selected': 'selected',
    'filter.active': 'Active',
    'filter.select': 'Select',
    'filter.resetAll': 'Reset all filters',
    'filter.confirm': 'Confirm',
    'filter.distance': 'Distance',
    'filter.allDistances': 'All',
    'filter.costStructure': 'Costs',
    'filter.costRange': 'Cost (min/max)',
    'filter.resetCost': 'Reset cost filters',

    // Favorites screen
    'favorites.title': 'My favorites',
    'favorites.subtitle': 'favorite',
    'favorites.subtitlePlural': 'favorites',
    'favorites.noFavorites': 'No favorites yet',
    'favorites.noFavoritesSubtext': 'Discover sports locations in your area and add them to your favorites by tapping the heart!',
    'favorites.back': 'Back',
    'favorites.loading': 'Loading favorites...',
    'favorites.removeTitle': 'Remove favorite',
    'favorites.removeMessage': 'Are you sure you want to remove {name} from your favorites?',
    'favorites.cancel': 'Cancel',
    'favorites.remove': 'Remove',
    'favorites.removeError': 'Something went wrong while removing your favorite',
    'favorites.error': 'Error',
    'favorites.discoverClubs': 'Discover clubs',
    'favorites.searchPlaceholder': 'Search your favorites...',
    'favorites.statFavorites': 'Favorites',
    'favorites.statSports': 'Sports',
    'favorites.noResults': 'No favorites found for',
    'favorites.becomeMember': 'Become a member',
    'favorites.notAvailable': 'Not available',
    'favorites.moreInfo': 'More info',
    'favorites.contact': 'Suggestion or question?',

    // Footer
    'footer.missingLocation': 'Missing a location? Contact us!',

    // Language
    'language.dutch': 'Nederlands',
    'language.english': 'English',
    'language.selectLanguage': 'Select language',

    // Suggestion Form
    'form.selectType': 'How can we help?',
    'form.selectTypeSubtitle': 'Select the type of question or suggestion',
    'form.addLocation': 'Add new location',
    'form.addLocationDesc': 'Add a sports location that is not yet on the map',
    'form.changeLocation': 'Change information',
    'form.changeLocationDesc': 'Change or update information of an existing location',
    'form.otherQuestion': 'Other question',
    'form.otherQuestionDesc': 'Ask another question or send a message',
    'form.cancel': 'Cancel',
    'form.back': 'Back',
    'form.submit': 'Submit',
    'form.ok': 'OK',

    // Add Location Form
    'form.addLocationSubtitle': 'Fill in the details of the new location',
    'form.locationDetails': 'Location details',
    'form.locationName': 'Location name',
    'form.locationNamePlaceholder': 'E.g. Sports Club Amsterdam',
    'form.sport': 'Sport',
    'form.sportPlaceholder': 'E.g. Football, Tennis, Swimming',
    'form.address': 'Address',
    'form.addressPlaceholder': 'Street, number, postal code, city',
    'form.yourDetails': 'Your details',
    'form.name': 'Name',
    'form.namePlaceholder': 'Your name',
    'form.email': 'Email',
    'form.emailPlaceholder': 'your@email.com',
    'form.customerDetails': 'Contact details',

    // Change Location Form
    'form.changeLocationSubtitle': 'What information do you want to change?',
    'form.changeDetails': 'Change details',
    'form.existingLocation': 'Which location',
    'form.existingLocationPlaceholder': 'Name of the existing location',
    'form.city': 'City',
    'form.selectCity': 'Select a city',
    'form.selectFacility': 'Select a facility',
    'form.noCities': 'No cities available',
    'form.noFacilities': 'No facilities available',
    'form.cityLoadError': 'Unable to load cities. Please try again later.',
    'form.facilityLoadError': 'Unable to load facilities. Please try again later.',
    'form.changeInfo': 'What needs to be changed',
    'form.changeInfoPlaceholder': 'Describe what needs to be changed',

    // Email subjects and bodies
    'form.addLocationSubject': 'Add new location - Sportinkaart',
    'form.addLocationBody': 'New location request:',
    'form.changeLocationSubject': 'Change location information - Sportinkaart',
    'form.changeLocationBody': 'Change request:',
    'form.otherQuestionSubject': 'Question about Sportinkaart',

    // Validation and errors
    'form.errorTitle': 'Error',
    'form.successTitle': 'Success',
    'form.fillAllFields': 'Please fill in all required fields',
    'form.invalidEmail': 'Please enter a valid email address',
    'form.emailOpened': 'Your email app has been opened. Send the email to submit your request.',
    'form.cannotOpenEmail': 'Cannot open email app. Please contact info@sportinkaart.nl',
    'form.emailError': 'An error occurred while opening the email app',
    'form.sending': 'Sending...',
    'form.emailSent': 'Your request has been successfully sent! We will contact you as soon as possible.',
    'form.emailSendError': 'An error occurred while sending. Please try again later or contact us at info@sportinkaart.nl',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'nl',
  setLanguage: () => undefined,
  t: (key: string) => translations.nl[key] || key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('nl');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
