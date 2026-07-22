/**
 * Integration tests for MapHomepage basic rendering and marker behavior.
 */

import React from "react";
import { waitFor } from "@testing-library/react-native";
import { renderWithProviders } from "../../setup/test-utils";
import MapHomepageDevScreen from "@/app/map";
import { supabase } from "@/lib/supabase";

type CityRegion = {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  latitude: number | null;
  longitude: number | null;
};

// Mock Supabase to return test data
const mockRegionsData: CityRegion[] = [
  {
    id: "1",
    region_name: "Amsterdam",
    slug: "amsterdam",
    is_active: true,
    is_concept: false,
    latitude: 52.37,
    longitude: 4.9,
  },
  {
    id: "2",
    region_name: "Rotterdam",
    slug: "rotterdam",
    is_active: true,
    is_concept: false,
    latitude: 51.92,
    longitude: 4.48,
  },
  {
    id: "3",
    region_name: "Utrecht",
    slug: "utrecht",
    is_active: true,
    is_concept: false,
    latitude: 52.09,
    longitude: 5.12,
  },
  {
    id: "4",
    region_name: "Den Haag",
    slug: "den-haag",
    is_active: false,
    is_concept: true,
    latitude: 52.07,
    longitude: 4.3,
  },
];

const createSupabaseQuery = (data: CityRegion[]) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.order = jest.fn().mockResolvedValue({ data, error: null });

  return query;
};

describe("MapHomepage integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders markers for valid regions", async () => {
    const mockSupabaseFrom = supabase.from as jest.Mock;
    const activeRegions = mockRegionsData.filter(
      (region) => region.is_active && !region.is_concept
    );
    const conceptRegions = mockRegionsData.filter(
      (region) => region.is_concept
    );

    mockSupabaseFrom
      .mockImplementationOnce(() => createSupabaseQuery(activeRegions))
      .mockImplementationOnce(() => createSupabaseQuery(conceptRegions))
      .mockImplementation(() => createSupabaseQuery([]));

    const { getByTestId } = renderWithProviders(<MapHomepageDevScreen />);

    await waitFor(() => getByTestId("map-homepage-map"));

    expect(getByTestId("marker-region-1")).toBeTruthy();
    expect(getByTestId("marker-region-2")).toBeTruthy();
    expect(getByTestId("marker-region-3")).toBeTruthy();
    expect(getByTestId("marker-region-4")).toBeTruthy();
  });

  it("skips invalid marker override items", async () => {
    const mockSupabaseFrom = supabase.from as jest.Mock;

    mockSupabaseFrom
      .mockImplementationOnce(() => createSupabaseQuery([]))
      .mockImplementationOnce(() => createSupabaseQuery([]))
      .mockImplementation(() => createSupabaseQuery([]));

    const validRegion = mockRegionsData[0];
    const invalidRegion: CityRegion = {
      ...validRegion,
      id: "bad",
      latitude: null,
      longitude: null,
    };

    const { getByTestId, queryByTestId } = renderWithProviders(
      <MapHomepageDevScreen markerItemsOverride={[validRegion, invalidRegion]} />
    );

    await waitFor(() => getByTestId("map-homepage-map"));

    expect(getByTestId("marker-region-1")).toBeTruthy();
    expect(queryByTestId("marker-region-bad")).toBeNull();
  });
});
