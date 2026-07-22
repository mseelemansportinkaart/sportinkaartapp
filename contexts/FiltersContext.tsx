import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type CostStructure = 'monthly' | 'yearly' | 'lesson' | null;

interface FiltersContextValue {
  regionSlug: string | null;
  setRegionSlug: (slug: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedSports: string[];
  setSelectedSports: (value: string[]) => void;
  selectedFaciliteiten: string[];
  setSelectedFaciliteiten: (value: string[]) => void;
  kostenFilterActive: boolean;
  setKostenFilterActive: (value: boolean) => void;
  minKosten: string;
  setMinKosten: (value: string) => void;
  maxKosten: string;
  setMaxKosten: (value: string) => void;
  selectedCostStructure: CostStructure;
  setSelectedCostStructure: (value: CostStructure) => void;
  resetFilters: () => void;
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [regionSlug, setRegionSlugState] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedFaciliteiten, setSelectedFaciliteiten] = useState<string[]>([]);
  const [kostenFilterActive, setKostenFilterActive] = useState(false);
  const [minKosten, setMinKosten] = useState('');
  const [maxKosten, setMaxKosten] = useState('');
  const [selectedCostStructure, setSelectedCostStructure] = useState<CostStructure>(null);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedSports([]);
    setSelectedFaciliteiten([]);
    setKostenFilterActive(false);
    setMinKosten('');
    setMaxKosten('');
    setSelectedCostStructure(null);
  }, []);

  const setRegionSlug = useCallback(
    (slug: string) => {
      setRegionSlugState((prev) => {
        if (prev && prev !== slug) {
          resetFilters();
        }
        return slug;
      });
    },
    [resetFilters]
  );

  const value = useMemo(
    () => ({
      regionSlug,
      setRegionSlug,
      searchQuery,
      setSearchQuery,
      selectedSports,
      setSelectedSports,
      selectedFaciliteiten,
      setSelectedFaciliteiten,
      kostenFilterActive,
      setKostenFilterActive,
      minKosten,
      setMinKosten,
      maxKosten,
      setMaxKosten,
      selectedCostStructure,
      setSelectedCostStructure,
      resetFilters,
    }),
    [
      regionSlug,
      setRegionSlug,
      searchQuery,
      selectedSports,
      selectedFaciliteiten,
      kostenFilterActive,
      minKosten,
      maxKosten,
      selectedCostStructure,
      resetFilters,
    ]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error('useFilters must be used within FiltersProvider');
  }
  return ctx;
}
