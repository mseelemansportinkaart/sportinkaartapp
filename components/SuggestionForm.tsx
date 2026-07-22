import { useLanguage } from '@/contexts/LanguageContext';
import { sendAddLocationEmail, sendChangeLocationEmail } from '@/lib/emailService';
import { supabase } from '@/lib/supabase';
import { Linking ,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';

interface SuggestionFormProps {
  visible: boolean;
  onClose: () => void;
}

type FormType = 'add' | 'change' | 'other' | null;
interface RegionOption {
  id: string;
  region_name: string;
}

interface FacilityOption {
  id: string;
  name: string;
}

export function SuggestionForm({ visible, onClose }: SuggestionFormProps) {
  const { t } = useLanguage();
  const [formType, setFormType] = useState<FormType>(null);

  // Add Location Form State
  const [locationName, setLocationName] = useState('');
  const [sport, setSport] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Change Location Form State
  const [existingLocation, setExistingLocation] = useState('');
  const [changeInfo, setChangeInfo] = useState('');
  const [changeCustomerName, setChangeCustomerName] = useState('');
  const [changeCustomerEmail, setChangeCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<RegionOption | null>(null);
  const [addSelectedCity, setAddSelectedCity] = useState<RegionOption | null>(null);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<FacilityOption | null>(null);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [addCityDropdownOpen, setAddCityDropdownOpen] = useState(false);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);

  const resetForm = () => {
    setFormType(null);
    setLocationName('');
    setSport('');
    setAddress('');
    setCustomerName('');
    setCustomerEmail('');
    setExistingLocation('');
    setChangeInfo('');
    setChangeCustomerName('');
    setChangeCustomerEmail('');
    setCities([]);
    setCitiesError(null);
    setSelectedCity(null);
    setAddSelectedCity(null);
    setFacilities([]);
    setFacilitiesError(null);
    setSelectedFacility(null);
    setCityDropdownOpen(false);
    setAddCityDropdownOpen(false);
    setFacilityDropdownOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFormTypeSelect = (type: FormType) => {
    if (type === 'other') {
      handleOtherQuestion();
    } else {
      setFormType(type);
    }
  };

  const fetchCities = useCallback(async () => {
    setCitiesLoading(true);
    setCitiesError(null);

    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id, region_name')
        .eq('is_active', true)
        .eq('is_concept', false)
        .order('region_name');

      if (error) throw error;

      const sortedCities = (data || []).sort((a, b) =>
        a.region_name.localeCompare(b.region_name, 'nl', { sensitivity: 'base' })
      );

      setCities(sortedCities);
    } catch (err) {
      console.error('Error fetching cities:', err);
      setCitiesError(t('form.cityLoadError'));
    } finally {
      setCitiesLoading(false);
    }
  }, [t]);

  const fetchFacilitiesForCity = useCallback(async (city: RegionOption) => {
    setFacilitiesLoading(true);
    setFacilitiesError(null);

    try {
      const tableName = city.region_name.toLowerCase();
      const { data, error } = await supabase
        .from(tableName)
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const sortedFacilities = (data || []).sort((a, b) =>
        a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' })
      );

      setFacilities(sortedFacilities);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setFacilitiesError(t('form.facilityLoadError'));
    } finally {
      setFacilitiesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible && (formType === 'change' || formType === 'add')) {
      fetchCities();
    }
  }, [visible, formType, fetchCities]);

  useEffect(() => {
    if (selectedFacility) {
      setExistingLocation(selectedFacility.name);
    } else {
      setExistingLocation('');
    }
  }, [selectedFacility]);

  const handleOtherQuestion = async () => {
    const email = 'info@sportinkaart.nl';
    const subject = t('form.otherQuestionSubject');
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        handleClose();
      } else {
        Alert.alert(
          t('form.errorTitle'),
          t('form.cannotOpenEmail')
        );
      }
    } catch (error) {
      console.error('Error opening email app:', error);
      Alert.alert(
        t('form.errorTitle'),
        t('form.emailError')
      );
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddLocationSubmit = async () => {
    // Validate form
    if (!addSelectedCity || !locationName.trim() || !sport.trim() || !address.trim() || !customerName.trim() || !customerEmail.trim()) {
      Alert.alert(t('form.errorTitle'), t('form.fillAllFields'));
      return;
    }

    if (!validateEmail(customerEmail)) {
      Alert.alert(t('form.errorTitle'), t('form.invalidEmail'));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await sendAddLocationEmail({
        city: addSelectedCity.region_name,
        locationName: locationName.trim(),
        sport: sport.trim(),
        address: address.trim(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
      });

      Alert.alert(
        t('form.successTitle'),
        t('form.emailSent'),
        [{ text: t('form.ok'), onPress: handleClose }]
      );
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error sending email:', error);
      }
      Alert.alert(
        t('form.errorTitle'),
        t('form.emailSendError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeLocationSubmit = async () => {
    // Validate form
    if (!existingLocation.trim() || !changeInfo.trim() || !changeCustomerName.trim() || !changeCustomerEmail.trim()) {
      Alert.alert(t('form.errorTitle'), t('form.fillAllFields'));
      return;
    }

    if (!validateEmail(changeCustomerEmail)) {
      Alert.alert(t('form.errorTitle'), t('form.invalidEmail'));
      return;
    }

    setIsSubmitting(true);

    try {
      await sendChangeLocationEmail({
        existingLocation: existingLocation.trim(),
        changeInfo: changeInfo.trim(),
        customerName: changeCustomerName.trim(),
        customerEmail: changeCustomerEmail.trim(),
      });

      Alert.alert(
        t('form.successTitle'),
        t('form.emailSent'),
        [{ text: t('form.ok'), onPress: handleClose }]
      );
    } catch (error) {
      if (__DEV__) {
        console.error('Error sending email:', error);
      }
      Alert.alert(
        t('form.errorTitle'),
        t('form.emailSendError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormTypeSelection = () => (
    <View style={styles.content}>
      <Text style={styles.title}>{t('form.selectType')}</Text>
      <Text style={styles.subtitle}>{t('form.selectTypeSubtitle')}</Text>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => handleFormTypeSelect('add')}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>➕</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{t('form.addLocation')}</Text>
          <Text style={styles.optionDescription}>{t('form.addLocationDesc')}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => handleFormTypeSelect('change')}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>✏️</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{t('form.changeLocation')}</Text>
          <Text style={styles.optionDescription}>{t('form.changeLocationDesc')}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => handleFormTypeSelect('other')}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>💬</Text>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{t('form.otherQuestion')}</Text>
          <Text style={styles.optionDescription}>{t('form.otherQuestionDesc')}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelButtonText}>{t('form.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddLocationForm = () => (
    <View style={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => setFormType(null)}>
        <Text style={styles.backButtonText}>← {t('form.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('form.addLocation')}</Text>
      <Text style={styles.subtitle}>{t('form.addLocationSubtitle')}</Text>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('form.city')}</Text>

        <Text style={styles.label}>{t('form.city')} *</Text>
        <TouchableOpacity
          style={[
            styles.dropdown,
            citiesLoading && styles.dropdownDisabled,
          ]}
          onPress={() => setAddCityDropdownOpen(true)}
          activeOpacity={0.8}
          disabled={citiesLoading}
        >
          <Text
            style={[
              styles.dropdownText,
              !addSelectedCity && styles.dropdownPlaceholder,
            ]}
          >
            {addSelectedCity ? addSelectedCity.region_name : t('form.selectCity')}
          </Text>
          {citiesLoading ? (
            <ActivityIndicator size="small" color="#04e1b2" />
          ) : (
            <Text style={styles.dropdownArrow}>▾</Text>
          )}
        </TouchableOpacity>
        {citiesError ? <Text style={styles.errorText}>{citiesError}</Text> : null}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('form.locationDetails')}</Text>

        <Text style={styles.label}>{t('form.locationName')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.locationNamePlaceholder')}
          placeholderTextColor="#7a9d92"
          value={locationName}
          onChangeText={setLocationName}
        />

        <Text style={styles.label}>{t('form.sport')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.sportPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={sport}
          onChangeText={setSport}
        />

        <Text style={styles.label}>{t('form.address')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('form.addressPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('form.yourDetails')}</Text>

        <Text style={styles.label}>{t('form.name')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.namePlaceholder')}
          placeholderTextColor="#7a9d92"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <Text style={styles.label}>{t('form.email')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.emailPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleAddLocationSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? t('form.sending') : t('form.submit')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelButtonText}>{t('form.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderChangeLocationForm = () => (
    <View style={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => setFormType(null)}>
        <Text style={styles.backButtonText}>← {t('form.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('form.changeLocation')}</Text>
      <Text style={styles.subtitle}>{t('form.changeLocationSubtitle')}</Text>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('form.changeDetails')}</Text>

        <Text style={styles.label}>{t('form.city')} *</Text>
        <TouchableOpacity
          style={[
            styles.dropdown,
            citiesLoading && styles.dropdownDisabled,
          ]}
          onPress={() => setCityDropdownOpen(true)}
          activeOpacity={0.8}
          disabled={citiesLoading}
        >
          <Text
            style={[
              styles.dropdownText,
              !selectedCity && styles.dropdownPlaceholder,
            ]}
          >
            {selectedCity ? selectedCity.region_name : t('form.selectCity')}
          </Text>
          {citiesLoading ? (
            <ActivityIndicator size="small" color="#04e1b2" />
          ) : (
            <Text style={styles.dropdownArrow}>▾</Text>
          )}
        </TouchableOpacity>
        {citiesError ? <Text style={styles.errorText}>{citiesError}</Text> : null}

        <Text style={styles.label}>{t('form.existingLocation')} *</Text>
        <TouchableOpacity
          style={[
            styles.dropdown,
            (!selectedCity || facilitiesLoading) && styles.dropdownDisabled,
          ]}
          onPress={() => setFacilityDropdownOpen(true)}
          activeOpacity={0.8}
          disabled={!selectedCity || facilitiesLoading}
        >
          <Text
            style={[
              styles.dropdownText,
              !selectedFacility && styles.dropdownPlaceholder,
            ]}
          >
            {selectedFacility ? selectedFacility.name : t('form.selectFacility')}
          </Text>
          {facilitiesLoading ? (
            <ActivityIndicator size="small" color="#04e1b2" />
          ) : (
            <Text style={styles.dropdownArrow}>▾</Text>
          )}
        </TouchableOpacity>
        {facilitiesError ? <Text style={styles.errorText}>{facilitiesError}</Text> : null}

        <Text style={styles.label}>{t('form.changeInfo')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('form.changeInfoPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={changeInfo}
          onChangeText={setChangeInfo}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>{t('form.yourDetails')}</Text>

        <Text style={styles.label}>{t('form.name')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.namePlaceholder')}
          placeholderTextColor="#7a9d92"
          value={changeCustomerName}
          onChangeText={setChangeCustomerName}
        />

        <Text style={styles.label}>{t('form.email')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.emailPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={changeCustomerEmail}
          onChangeText={setChangeCustomerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleChangeLocationSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? t('form.sending') : t('form.submit')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelButtonText}>{t('form.cancel')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {formType === null && renderFormTypeSelection()}
          {formType === 'add' && renderAddLocationForm()}
          {formType === 'change' && renderChangeLocationForm()}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={addCityDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddCityDropdownOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setAddCityDropdownOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.dropdownSheet}>
              <Text style={styles.dropdownTitle}>{t('form.selectCity')}</Text>
              <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                {cities.length === 0 && !citiesLoading ? (
                  <Text style={styles.dropdownEmpty}>{t('form.noCities')}</Text>
                ) : (
                  cities.map((city) => (
                    <Pressable
                      key={city.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setAddSelectedCity(city);
                        setAddCityDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{city.region_name}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <Modal
        visible={cityDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityDropdownOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setCityDropdownOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.dropdownSheet}>
              <Text style={styles.dropdownTitle}>{t('form.selectCity')}</Text>
              <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                {cities.length === 0 && !citiesLoading ? (
                  <Text style={styles.dropdownEmpty}>{t('form.noCities')}</Text>
                ) : (
                  cities.map((city) => (
                    <Pressable
                      key={city.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedCity(city);
                        setSelectedFacility(null);
                        setFacilities([]);
                        setFacilitiesError(null);
                        setCityDropdownOpen(false);
                        fetchFacilitiesForCity(city);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{city.region_name}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <Modal
        visible={facilityDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFacilityDropdownOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setFacilityDropdownOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.dropdownSheet}>
              <Text style={styles.dropdownTitle}>{t('form.selectFacility')}</Text>
              <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                {facilities.length === 0 && !facilitiesLoading ? (
                  <Text style={styles.dropdownEmpty}>{t('form.noFacilities')}</Text>
                ) : (
                  facilities.map((facility) => (
                    <Pressable
                      key={facility.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedFacility(facility);
                        setFacilityDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{facility.name}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 25,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.7,
    marginBottom: 30,
    lineHeight: 22,
  },
  optionButton: {
    backgroundColor: '#0b2419',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a3b30',
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#04e1b2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionIconText: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.6,
  },
  arrow: {
    fontSize: 20,
    color: '#04e1b2',
    fontWeight: 'bold',
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#04e1b2',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0b2419',
    borderWidth: 1,
    borderColor: '#1a3b30',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#ffffff',
  },
  dropdown: {
    backgroundColor: '#0b2419',
    borderWidth: 1,
    borderColor: '#1a3b30',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownDisabled: {
    opacity: 0.6,
  },
  dropdownText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  dropdownPlaceholder: {
    color: '#7a9d92',
  },
  dropdownArrow: {
    color: '#04e1b2',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownSheet: {
    backgroundColor: '#0b2419',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a3b30',
    maxHeight: '70%',
    paddingVertical: 12,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  dropdownList: {
    paddingHorizontal: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#ffffff',
  },
  dropdownEmpty: {
    color: '#7a9d92',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    color: '#ff9a9a',
    fontSize: 12,
    marginTop: 6,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b2419',
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    opacity: 0.7,
  },
});
