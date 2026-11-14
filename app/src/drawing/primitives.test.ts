import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/model';
import { diagramScene, sceneToSvg, toGrey } from './primitives';

const diagram: Diagram = {
  id: 'd',
  court: 'half',
  caption: 'Steg <1>',
  elements: [
    { id: 'o1', type: 'offense', x: 8, y: 0, label: '1' },
    { id: 'x1', type: 'defense', x: 9, y: 1, label: '1', rotation: 45 },
    { id: 'c', type: 'coach', x: 3, y: -5 },
    { id: 'b', type: 'ball', x: 8.4, y: -0.4, attachedTo: 'o1' },
    { id: 'k', type: 'cone', x: 5, y: 5 },
    { id: 'p', type: 'pass', points: [{ x: 8, y: 0 }, { x: 4, y: 3 }], curved: false, order: 1 },
    { id: 'dr', type: 'dribble', points: [{ x: 8, y: 0 }, { x: 10, y: -3 }], curved: true },
    { id: 't', type: 'text', x: 2, y: 2, text: 'A & B', size: 0.6 },
    { id: 'z', type: 'zone', shape: 'ellipse', x: 1, y: 1, w: 2, h: 1, color: '#22c55e' },
    { id: 'f', type: 'freehand', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: '#000000' },
  ],
};

describe('drawing primitives', () => {
  it('turns colours into greys of the same lightness', () => {
    expect(toGrey('#ffffff')).toBe('#ffffff');
    expect(toGrey('#000000')).toBe('#000000');
    expect(toGrey('#1d4ed8')).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it('draws every element on top of the court', () => {
    const scene = diagramScene(diagram, { style: 'white' });
    expect(scene.bounds.width).toBeCloseTo(15.2);
    const texts = scene.primitives.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text);
    expect(texts).toEqual(['1', '1', 'C', '1', 'A & B']);
    expect(scene.primitives.length).toBeGreaterThan(20);
  });

  it('has no colour left in black and white', () => {
    const scene = diagramScene(diagram, { style: 'wood', mono: true });
    const colours = JSON.stringify(scene.primitives).match(/#[0-9a-fA-F]{6}/g) ?? [];
    for (const c of colours) expect(c.toLowerCase()).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it('writes a valid stand-alone SVG with escaped text', () => {
    const svg = sceneToSvg(diagramScene(diagram, { style: 'wood' }), 1200, diagram.caption);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('width')).toBe('1200');
    expect(doc.querySelector('title')?.textContent).toBe('Steg <1>');
    expect([...doc.querySelectorAll('text')].map((t) => t.textContent)).toContain('A & B');
  });
});
