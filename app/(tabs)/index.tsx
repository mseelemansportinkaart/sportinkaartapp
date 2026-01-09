import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SuggestionForm } from '@/components/SuggestionForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Type definitions
interface Region {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  created_at: string;
  updated_at: string;
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);

  // Fetch regions from Supabase (memoized)
  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active regions and concept regions separately, then combine them
      const [activeRegionsResponse, conceptRegionsResponse] = await Promise.all([
        supabase
          .from('regions')
          .select('*')
          .eq('is_active', true)
          .eq('is_concept', false)
          .order('region_name'),
        supabase
          .from('regions')
          .select('*')
          .eq('is_active', false)
          .eq('is_concept', true)
          .order('region_name')
      ]);

      if (activeRegionsResponse.error) throw activeRegionsResponse.error;
      if (conceptRegionsResponse.error) throw conceptRegionsResponse.error;

      // Sort each group alphabetically and combine active regions first, then concept regions
      const sortedActiveRegions = (activeRegionsResponse.data || []).sort((a, b) =>
        a.region_name.localeCompare(b.region_name, 'nl', { sensitivity: 'base' })
      );
      const sortedConceptRegions = (conceptRegionsResponse.data || []).sort((a, b) =>
        a.region_name.localeCompare(b.region_name, 'nl', { sensitivity: 'base' })
      );

      const combinedRegions = [
        ...sortedActiveRegions,
        ...sortedConceptRegions
      ];

      setRegions(combinedRegions);
    } catch (err) {
      console.error('Error fetching regions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Er is een fout opgetreden bij het laden van de regios';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegionPress = useCallback((region: Region) => {
    // Don't navigate if region is a concept
    if (!region.is_active && region.is_concept) {
      return;
    }
    console.log('Navigating to region:', region);
    router.push('/region/' + region.slug as any);
  }, []);

  const handleContactPress = useCallback(() => {
    setShowSuggestionForm(true);
  }, []);

  // Fetch regions on mount
  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  // Memoize region rendering
  const renderRegion = useCallback((region: Region) => {
    const isConcept = !region.is_active && region.is_concept;

    return (
      <TouchableOpacity
        key={region.id}
        style={[
          styles.regionButtonWrapper,
          isConcept && styles.conceptRegionWrapper
        ]}
        onPress={() => handleRegionPress(region)}
        activeOpacity={isConcept ? 1 : 0.8}
        disabled={isConcept}
      >
        <LinearGradient
          colors={isConcept ? ['#3a3a3a', '#2a2a2a'] : ['#04e1b2', '#1a3b30']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.regionGradient}
        >
          <View style={styles.regionContent}>
            <View style={styles.regionHeader}>
              <Text style={[
                styles.regionName,
                isConcept && styles.conceptRegionName
              ]}>
                {region.region_name}
              </Text>
              {isConcept && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>
                    {t('home.comingSoon')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.regionDescription,
              isConcept && styles.conceptRegionDescription
            ]}>
              {isConcept
                ? t('home.underConstruction')
                : `${t('home.discover')} ${region.region_name}`
              }
            </Text>
          </View>
          <View style={[
            styles.regionIconContainer,
            isConcept && styles.conceptRegionIcon
          ]}>
            <Text style={styles.regionArrow}>
              {isConcept ? '🚧' : '→'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [handleRegionPress, t]);

  // Memoize the regions list to avoid recalculating
  const regionsList = useMemo(() =>
    regions.map(renderRegion),
    [regions, renderRegion]
  );

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/sportinkaart-banner.png')}
        style={styles.heroBanner}
        resizeMode="cover"
      >
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerSubtitle}>
            {t('home.tagline')}
          </Text>
        </View>
      </ImageBackground>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#04e1b2" />
              <Text style={styles.loadingText}>{t('home.loading')}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{t('home.error')}</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchRegions}>
                <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && regionsList}

          {!loading && !error && regions.length === 0 && (
            <View style={styles.noRegionsContainer}>
              <Text style={styles.noRegionsText}>{t('home.noRegions')}</Text>
              <Text style={styles.noRegionsSubtext}>{t('home.noRegionsSubtext')}</Text>
            </View>
          )}
        </View>

        <View style={styles.footerSpacer}>
          <Text style={styles.footerText}>
            {t('home.moreRegions')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.fixedButtonBar}>
        <TouchableOpacity
          style={styles.favoritesButtonWrapper}
          onPress={() => router.push('/(tabs)/favorites')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1a3b30', '#04e1b2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.favoritesGradient}
          >
            <Text style={styles.favoritesIcon}>♥</Text>
            <Text style={styles.favoritesText}>{t('home.favorites')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButtonWrapper}
          onPress={handleContactPress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#04e1b2', '#1a3b30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.contactGradient}
          >
            <Text style={styles.contactIcon}>✉️</Text>
            <Text style={styles.contactButtonText}>{t('home.contact')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <LanguageSwitcher inline={true} />
      </View>

      <SuggestionForm
        visible={showSuggestionForm}
        onClose={() => setShowSuggestionForm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  heroBanner: {
    height: 280,
    justifyContent: 'flex-end',
    paddingBottom: 30,
  },
  bannerOverlay: {
    backgroundColor: 'rgba(11, 36, 25, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  bannerSubtitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for fixed button bar
  },
  content: {
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#04e1b2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#0b2419',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noRegionsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noRegionsText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noRegionsSubtext: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.7,
    textAlign: 'center',
  },
  regionButtonWrapper: {
    marginBottom: 18,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0b2419',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  conceptRegionWrapper: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
  regionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 22,
    paddingHorizontal: 25,
  },
  regionContent: {
    flex: 1,
  },
  regionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  regionName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 0,
  },
  conceptRegionName: {
    opacity: 0.6,
  },
  comingSoonBadge: {
    backgroundColor: '#ffa500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  regionDescription: {
    fontSize: 15,
    color: '#ffffff',
    opacity: 0.9,
    fontWeight: '500',
  },
  conceptRegionDescription: {
    opacity: 0.5,
    fontStyle: 'italic',
  },
  regionIconContainer: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conceptRegionIcon: {
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
  },
  regionArrow: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '800',
  },
  footerSpacer: {
    paddingVertical: 30,
    paddingHorizontal: 25,
    alignItems: 'center',
    backgroundColor: '#050f08',
    marginTop: 5,
  },
  footerText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '500',
  },
  fixedButtonBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 25,
    paddingVertical: 15,
    paddingBottom: 25,
    backgroundColor: '#050f08',
  },
  favoritesButtonWrapper: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  favoritesGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  favoritesIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  favoritesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  contactButtonWrapper: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  contactGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  contactIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
});