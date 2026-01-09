import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageSwitcherProps {
  inline?: boolean;
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const handleLanguageChange = (lang: 'nl' | 'en') => {
    setLanguage(lang);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={inline ? styles.flagButtonInline : styles.flagButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={inline ? styles.flagEmojiInline : styles.flagEmoji}>{language === 'nl' ? '🇳🇱' : '🇬🇧'}</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('language.selectLanguage')}</Text>

            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'nl' && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageChange('nl')}
            >
              <Text style={styles.languageFlag}>🇳🇱</Text>
              <Text style={[
                styles.languageText,
                language === 'nl' && styles.languageTextSelected,
              ]}>
                Nederlands
              </Text>
              {language === 'nl' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'en' && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={styles.languageFlag}>🇬🇧</Text>
              <Text style={[
                styles.languageText,
                language === 'en' && styles.languageTextSelected,
              ]}>
                English
              </Text>
              {language === 'en' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flagButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#1a3b30',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#04e1b2',
  },
  flagEmoji: {
    fontSize: 28,
  },
  flagButtonInline: {
    width: 50,
    height: 50,
    backgroundColor: '#1a3b30',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#04e1b2',
  },
  flagEmojiInline: {
    fontSize: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1a3b30',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 2,
    borderColor: '#04e1b2',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(4, 225, 178, 0.1)',
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(4, 225, 178, 0.25)',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  languageTextSelected: {
    color: '#04e1b2',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#04e1b2',
    fontWeight: 'bold',
  },
});
