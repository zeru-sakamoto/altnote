import { describe, it, expect } from 'vitest';
import { toggleTaskMarkerText } from './livePreview';

describe('toggleTaskMarkerText', () => {
  it('checks an unchecked marker', () => {
    expect(toggleTaskMarkerText('[ ]')).toBe('[x]');
  });

  it('unchecks a lowercase-checked marker', () => {
    expect(toggleTaskMarkerText('[x]')).toBe('[ ]');
  });

  it('unchecks an uppercase-checked marker', () => {
    expect(toggleTaskMarkerText('[X]')).toBe('[ ]');
  });
});
