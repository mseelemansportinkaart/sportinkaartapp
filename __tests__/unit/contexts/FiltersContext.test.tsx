import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { FiltersProvider, useFilters } from '@/contexts/FiltersContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FiltersProvider>{children}</FiltersProvider>
);

describe('FiltersContext', () => {
  it('should expose default filter values', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    expect(result.current.regionSlug).toBeNull();
    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedSports).toEqual([]);
    expect(result.current.selectedFaciliteiten).toEqual([]);
    expect(result.current.kostenFilterActive).toBe(false);
    expect(result.current.minKosten).toBe('');
    expect(result.current.maxKosten).toBe('');
    expect(result.current.selectedCostStructure).toBeNull();
  });

  it('should reset filters when region slug changes', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.setRegionSlug('almere');
      result.current.setSearchQuery('voetbal');
      result.current.setSelectedSports(['Voetbal']);
      result.current.setKostenFilterActive(true);
      result.current.setMinKosten('10');
      result.current.setSelectedCostStructure('monthly');
    });

    expect(result.current.searchQuery).toBe('voetbal');

    act(() => {
      result.current.setRegionSlug('utrecht');
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedSports).toEqual([]);
    expect(result.current.kostenFilterActive).toBe(false);
    expect(result.current.minKosten).toBe('');
    expect(result.current.selectedCostStructure).toBeNull();
  });

  it('should reset filters when resetFilters is called', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });

    act(() => {
      result.current.setSearchQuery('tennis');
      result.current.setSelectedSports(['Tennis']);
      result.current.setSelectedFaciliteiten(['Parkeren']);
      result.current.setKostenFilterActive(true);
      result.current.setMinKosten('5');
      result.current.setMaxKosten('50');
      result.current.setSelectedCostStructure('yearly');
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.selectedSports).toEqual([]);
    expect(result.current.selectedFaciliteiten).toEqual([]);
    expect(result.current.kostenFilterActive).toBe(false);
    expect(result.current.minKosten).toBe('');
    expect(result.current.maxKosten).toBe('');
    expect(result.current.selectedCostStructure).toBeNull();
  });
});
