import { describe, expect, it } from 'vitest';

import { parseGeofenceStrings } from './geofence-parse';

describe('parseGeofenceStrings', () => {
  it('returns all-null for an all-empty input', () => {
    expect(parseGeofenceStrings({})).toEqual({ lat: null, lng: null, radiusMeters: null });
    expect(parseGeofenceStrings({ lat: '', lng: '', radius: '' })).toEqual({
      lat: null,
      lng: null,
      radiusMeters: null,
    });
  });

  it('parses valid numeric strings to numbers', () => {
    expect(parseGeofenceStrings({ lat: '14.5995', lng: '120.9842', radius: '150' })).toEqual({
      lat: 14.5995,
      lng: 120.9842,
      radiusMeters: 150,
    });
  });

  it('handles negative and integer coordinates', () => {
    expect(parseGeofenceStrings({ lat: '-33.8688', lng: '-70', radius: '5' })).toEqual({
      lat: -33.8688,
      lng: -70,
      radiusMeters: 5,
    });
  });

  it('parses partial inputs, nulling the missing fields', () => {
    expect(parseGeofenceStrings({ lat: '14.5', lng: '121' })).toEqual({
      lat: 14.5,
      lng: 121,
      radiusMeters: null,
    });
    expect(parseGeofenceStrings({ radius: '100' })).toEqual({
      lat: null,
      lng: null,
      radiusMeters: 100,
    });
  });

  it('returns null for non-numeric values and never throws', () => {
    expect(parseGeofenceStrings({ lat: 'abc', lng: 'xyz', radius: 'NaN' })).toEqual({
      lat: null,
      lng: null,
      radiusMeters: null,
    });
  });

  it('treats whitespace-only strings as empty (null)', () => {
    expect(parseGeofenceStrings({ lat: '   ', lng: '\t', radius: '  ' })).toEqual({
      lat: null,
      lng: null,
      radiusMeters: null,
    });
  });

  it('parses numbers surrounded by whitespace', () => {
    expect(parseGeofenceStrings({ lat: '  14.5  ', lng: ' 121 ', radius: ' 50 ' })).toEqual({
      lat: 14.5,
      lng: 121,
      radiusMeters: 50,
    });
  });

  it('handles undefined fields identically to empty', () => {
    expect(parseGeofenceStrings({ lat: undefined, lng: undefined, radius: undefined })).toEqual({
      lat: null,
      lng: null,
      radiusMeters: null,
    });
  });
});
