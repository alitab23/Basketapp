import { describe, expect, it } from 'vitest';
import { fitWithin, isAcceptedImage, outputType } from './images';

describe('image scaling (SPEC.md section 5)', () => {
  it('scales the longest side down to 1600 px and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 3000)).toEqual({ width: 533, height: 1600 });
  });

  it('never scales up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('accepts JPG, PNG and WebP only', () => {
    expect(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].map(isAcceptedImage)).toEqual([true, true, true, false, false]);
  });

  it('keeps PNG and turns photos into JPEG', () => {
    expect(outputType('image/png')).toBe('image/png');
    expect(outputType('image/webp')).toBe('image/jpeg');
  });
});
