import React, { createContext, ReactNode, useContext, useState } from 'react';

type Language = 'nl' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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
    'home.comingSoon': 'Binnenkort',
    'home.underConstruction': 'In ontwikkeling',

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

    // Filters
    'filter.selectSport': 'Selecteer Sport',
    'filter.selectFacilities': 'Selecteer Faciliteiten',
    'filter.allSports': 'Alle sporten',
    'filter.allFacilities': 'Alle faciliteiten',
    'filter.apply': 'Toepassen',
    'filter.min': 'Min €',
    'filter.max': 'Max €',
    'filter.youth': 'Jeugd',
    'filter.adults': 'Volwassenen',
    'filter.selected': 'geselecteerd',

    // Favorites screen
    'favorites.title': 'Favorieten',
    'favorites.noFavorites': 'Geen favorieten',
    'favorites.noFavoritesSubtext': 'Voeg locaties toe aan je favorieten door op het hartje te klikken',

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
    'home.tagline': 'Find your perfect sports club in the region',
    'home.loading': 'Loading regions...',
    'home.error': 'Error loading regions:',
    'home.retry': 'Try again',
    'home.noRegions': 'No regions available',
    'home.noRegionsSubtext': 'Check back soon for new regions',
    'home.discover': 'Discover sports clubs in',
    'home.moreRegions': 'More regions coming soon',
    'home.favorites': 'Favorites',
    'home.contact': 'Suggestion or question?',
    'home.comingSoon': 'Coming Soon',
    'home.underConstruction': 'Under Construction',

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

    // Filters
    'filter.selectSport': 'Select Sport',
    'filter.selectFacilities': 'Select Facilities',
    'filter.allSports': 'All sports',
    'filter.allFacilities': 'All facilities',
    'filter.apply': 'Apply',
    'filter.min': 'Min €',
    'filter.max': 'Max €',
    'filter.youth': 'Youth',
    'filter.adults': 'Adults',
    'filter.selected': 'selected',

    // Favorites screen
    'favorites.title': 'Favorites',
    'favorites.noFavorites': 'No favorites',
    'favorites.noFavoritesSubtext': 'Add locations to your favorites by clicking the heart icon',

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
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
