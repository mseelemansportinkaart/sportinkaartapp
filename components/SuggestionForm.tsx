import { useLanguage } from '@/contexts/LanguageContext';
import { sendAddLocationEmail, sendChangeLocationEmail } from '@/lib/emailService';
import { Linking } from 'react-native';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

interface SuggestionFormProps {
  visible: boolean;
  onClose: () => void;
}

type FormType = 'add' | 'change' | 'other' | null;

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
    if (!locationName.trim() || !sport.trim() || !address.trim() || !customerName.trim() || !customerEmail.trim()) {
      Alert.alert(t('form.errorTitle'), t('form.fillAllFields'));
      return;
    }

    if (!validateEmail(customerEmail)) {
      Alert.alert(t('form.errorTitle'), t('form.invalidEmail'));
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📧 Attempting to send email...');
      const result = await sendAddLocationEmail({
        locationName: locationName.trim(),
        sport: sport.trim(),
        address: address.trim(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
      });
      console.log('✅ Email sent successfully:', result);

      Alert.alert(
        t('form.successTitle'),
        t('form.emailSent'),
        [{ text: t('form.ok'), onPress: handleClose }]
      );
    } catch (error) {
      console.error('❌ Error sending email:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        t('form.errorTitle'),
        t('form.emailSendError') + '\n\nDebug: ' + (error instanceof Error ? error.message : 'Unknown error')
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
      console.error('Error sending email:', error);
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

        <Text style={styles.label}>{t('form.existingLocation')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.existingLocationPlaceholder')}
          placeholderTextColor="#7a9d92"
          value={existingLocation}
          onChangeText={setExistingLocation}
        />

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
