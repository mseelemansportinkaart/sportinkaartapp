import { useFavorites } from '@/contexts/FavoritesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function FavoritesScreen() {
  const { favoriteClubs, toggleFavorite, loading } = useFavorites();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to capitalize text (first letter of each word)
  const capitalizeText = (text: string): string => {
    return text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Filter favorieten op basis van zoekterm
  const filteredFavorites = favoriteClubs.filter(club =>
    club.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.stadsdeel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveFavorite = async (club: any) => {
    Alert.alert(
      t('favorites.removeTitle'),
      t('favorites.removeMessage').replace('{name}', club.naam),
      [
        { text: t('favorites.cancel'), style: 'cancel' },
        {
          text: t('favorites.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await toggleFavorite(club);
            } catch (error) {
              Alert.alert(t('favorites.error'), t('favorites.removeError'));
            }
          }
        }
      ]
    );
  };

  const handleClubPress = (club: any) => {
    console.log(`Navigate to detail page for ${club.naam}`);
  };

  const handleLidWorden = (club: any) => {
    console.log(`Lid worden bij ${club.naam}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('favorites.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('favorites.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <Text style={styles.loadingEmoji}>⏳</Text>
          </View>
          <Text style={styles.loadingText}>{t('favorites.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← {t('favorites.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('favorites.title')}</Text>
        <Text style={styles.subtitle}>
          {favoriteClubs.length} {favoriteClubs.length === 1 ? t('favorites.subtitle') : t('favorites.subtitlePlural')}
        </Text>
      </View>

      {favoriteClubs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>💔</Text>
          </View>
          <Text style={styles.emptyTitle}>{t('favorites.noFavorites')}</Text>
          <Text style={styles.emptyText}>
            {t('favorites.noFavoritesSubtext')}
          </Text>
          <TouchableOpacity
            style={styles.exploreButtonContainer}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#04e1b2', '#1a3b30']}
              style={styles.exploreButton}
            >
              <Text style={styles.exploreButtonText}>🔍 {t('favorites.discoverClubs')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('favorites.searchPlaceholder')}
              placeholderTextColor="#1a3b30"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Statistics */}
          <View style={styles.statsContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#04e1b2', '#1a3b30']}
                  style={styles.statCardGradient}
                >
                  <Text style={styles.statNumber}>{favoriteClubs.length}</Text>
                  <Text style={styles.statLabel}>{t('favorites.statFavorites')}</Text>
                  <Text style={styles.statIcon}>❤️</Text>
                </LinearGradient>
              </View>
              <View style={styles.statCard}>
                <LinearGradient
                  colors={['#1a3b30', '#04e1b2']}
                  style={styles.statCardGradient}
                >
                  <Text style={styles.statNumber}>
                    {new Set(favoriteClubs.map(club => club.sport)).size}
                  </Text>
                  <Text style={styles.statLabel}>{t('favorites.statSports')}</Text>
                  <Text style={styles.statIcon}>⚽</Text>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Club cards */}
          <View style={styles.favoritesContainer}>
            {filteredFavorites.length === 0 && searchQuery !== '' ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsIcon}>🔍</Text>
                <Text style={styles.noResultsText}>
                  {t('favorites.noResults')} &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : (
              filteredFavorites.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={[
                    styles.favoriteCard,
                    club.is_featured && styles.featuredCard
                  ]}
                  onPress={() => handleClubPress(club)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={styles.favoriteCardGradient}
                  >
                    {/* Card header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.clubName}>{club.naam}</Text>
                        <View style={styles.sportTagContainer}>
                          <View style={styles.sportTag}>
                            <Text style={styles.sportText}>{capitalizeText(club.sport)}</Text>
                          </View>
                          {club.is_partner && (
                            <View style={styles.partnerTag}>
                              <Text style={styles.partnerText}>{t('region.partner')}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveFavorite(club)}
                      >
                        <Text style={styles.removeIcon}>♥</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Club details */}
                    <View style={styles.clubDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.clubInfo}>{club.stadsdeel}</Text>
                      </View>
                      {club.kosten !== 'Prijs op aanvraag' && club.kosten !== 'Price on request' && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>💰</Text>
                          <Text style={styles.clubInfo}>{club.kosten}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionButtons}>
                      {club.lidWordenMogelijk ? (
                        <TouchableOpacity
                          style={styles.lidWordenButtonContainer}
                          onPress={() => handleLidWorden(club)}
                        >
                          <LinearGradient
                            colors={['#04e1b2', '#1a3b30']}
                            style={styles.lidWordenButton}
                          >
                            <Text style={styles.lidWordenText}>{t('favorites.becomeMember')}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.unavailableButtonContainer}>
                          <Text style={styles.unavailableText}>{t('favorites.notAvailable')}</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() => handleClubPress(club)}
                      >
                        <Text style={styles.detailButtonText}>{t('favorites.moreInfo')}</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Contact Button */}
            <TouchableOpacity
              style={styles.contactButtonWrapper}
              onPress={() => console.log('Contact form pressed')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#04e1b2', '#1a3b30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.contactGradient}
              >
                <Text style={styles.contactButtonText}>{t('favorites.contact')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  
  // Header
  header: {
    backgroundColor: '#050f08',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  backButton: {
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    opacity: 0.8,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingSpinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a3b30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingEmoji: {
    fontSize: 32,
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
    opacity: 0.8,
  },
  
  // Content
  scrollContainer: {
    flex: 1,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 50,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a3b30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyIcon: {
    fontSize: 50,
    color: '#04e1b2', // Turquoise gebroken hartje
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 15,
    textAlign: 'center',
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
    opacity: 0.8,
  },
  exploreButtonContainer: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  exploreButton: {
    paddingHorizontal: 35,
    paddingVertical: 16,
    alignItems: 'center',
  },
  exploreButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#04e1b2',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#0b2419',
    fontWeight: '500',
  },
  clearButton: {
    position: 'absolute',
    right: 35,
    padding: 10,
  },
  clearIcon: {
    fontSize: 16,
    color: '#1a3b30',
    fontWeight: 'bold',
  },
  
  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
  statIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 16,
    opacity: 0.7,
  },
  
  // Favorites
  favoritesContainer: {
    paddingHorizontal: 20,
  },
  noResultsContainer: {
    padding: 50,
    alignItems: 'center',
    backgroundColor: '#1a3b30',
    borderRadius: 16,
    marginBottom: 20,
  },
  noResultsIcon: {
    fontSize: 40,
    marginBottom: 15,
  },
  noResultsText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  favoriteCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  featuredCard: {
    borderWidth: 4,
    borderColor: '#04e1b2',
  },
  favoriteCardGradient: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  clubName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    color: '#0b2419',
    lineHeight: 24,
  },
  sportTagContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sportTag: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sportText: {
    color: '#0b2419',
    fontSize: 12,
    fontWeight: '700',
  },
  partnerTag: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  partnerText: {
    color: '#0b2419',
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  removeIcon: {
    fontSize: 20,
    color: '#04e1b2',
  },
  clubDetails: {
    marginBottom: 20,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 20,
  },
  clubInfo: {
    fontSize: 14,
    color: '#1a3b30',
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  lidWordenButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lidWordenButton: {
    padding: 14,
    alignItems: 'center',
  },
  lidWordenText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  unavailableButtonContainer: {
    flex: 1,
    backgroundColor: '#e5e5e5',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  unavailableText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  detailButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#04e1b2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#04e1b2',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Footer
  footer: {
    paddingVertical: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    backgroundColor: '#050f08',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 25,
  },
  
  // Contact Button
  contactButtonWrapper: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#050f08',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  contactGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});