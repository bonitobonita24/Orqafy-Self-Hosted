import { describe, expect, it } from 'vitest';
import { buildExportFilename, toPrettyJson } from './download-json';

describe('buildExportFilename', () => {
  it('formats as prefix-YYYY-MM-DD.json using UTC date parts', () => {
    expect(buildExportFilename('orqafy-my-data', new Date('2026-10-10T23:30:00Z'))).toBe(
      'orqafy-my-data-2026-10-10.json',
    );
  });

  it('zero-pads single-digit month and day', () => {
    expect(buildExportFilename('orqafy-my-data', new Date('2026-01-05T00:00:00Z'))).toBe(
      'orqafy-my-data-2026-01-05.json',
    );
  });

  it('defaults to the current date when none is given', () => {
    const filename = buildExportFilename('orqafy-my-data');
    expect(filename).toMatch(/^orqafy-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('toPrettyJson', () => {
  it('pretty-prints with 2-space indentation', () => {
    expect(toPrettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('serializes Date values as ISO strings', () => {
    const iso = '2026-10-10T12:00:00.000Z';
    expect(toPrettyJson({ exportedAt: new Date(iso) })).toBe(`{\n  "exportedAt": "${iso}"\n}`);
  });

  it('serializes nested arrays/objects', () => {
    expect(toPrettyJson({ tasks: [{ id: '1' }] })).toBe(
      '{\n  "tasks": [\n    {\n      "id": "1"\n    }\n  ]\n}',
    );
  });
});
