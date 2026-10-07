import { describe, expect, it } from 'vitest';
import { findPreset, LIBRARY_CATEGORIES, LIBRARY_PRESETS, presetSeed, searchPresets } from './library';
import { NODE_KINDS } from './types';

describe('component library', () => {
  it('has unique ids and labels', () => {
    expect(new Set(LIBRARY_PRESETS.map((preset) => preset.id)).size).toBe(LIBRARY_PRESETS.length);
    expect(new Set(LIBRARY_PRESETS.map((preset) => preset.label)).size).toBe(LIBRARY_PRESETS.length);
  });

  it('fills every category and keeps one essential per kind', () => {
    for (const category of LIBRARY_CATEGORIES)
      expect(LIBRARY_PRESETS.some((preset) => preset.category === category.id)).toBe(true);
    const essentials = LIBRARY_PRESETS.filter((preset) => preset.category === 'essentials').map(
      (preset) => preset.kind,
    );
    expect(essentials).toEqual([...NODE_KINDS]);
  });

  it('searches without accents and across tags and providers', () => {
    expect(searchPresets('cache').map((preset) => preset.id)).toContain('cache');
    expect(searchPresets('debezium').map((preset) => preset.id)).toEqual(['cdc']);
    const awsQueues = searchPresets('aws cola');
    expect(awsQueues.map((preset) => preset.id)).toContain('sqs');
    expect(awsQueues.every((preset) => preset.provider === 'AWS' && preset.kind === 'queue')).toBe(true);
    expect(searchPresets('  ')).toHaveLength(LIBRARY_PRESETS.length);
    expect(searchPresets('zzz-nada')).toEqual([]);
  });

  it('seeds provider presets with the generic-icon note', () => {
    const sqs = findPreset('sqs');
    expect(sqs && presetSeed(sqs)).toEqual({
      kind: 'queue',
      label: 'SQS',
      provider: 'AWS',
      description: 'Icono genérico; no es un logo oficial',
    });
    const postgres = findPreset('postgres');
    expect(postgres && presetSeed(postgres)).toEqual({ kind: 'database', label: 'PostgreSQL' });
  });
});
