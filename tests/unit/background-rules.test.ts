import {describe, expect, it} from 'vitest';
import {clampPercent, defaultScene, layerStyle, MAX_LAYERS, newLayer, sceneSchema} from '../../src/lib/background-rules';

describe('background scene rules', () => {
  it('accepts the built-in default and uploaded images', () => {
    expect(sceneSchema.safeParse(defaultScene).success).toBe(true);
    expect(sceneSchema.safeParse({layers: [newLayer('/api/product-images/abc123', 'layer-one')]}).success).toBe(true);
  });

  it('rejects outside images, bad values and too many layers', () => {
    expect(sceneSchema.safeParse({layers: [newLayer('https://example.com/a.jpg', 'layer-one')]}).success).toBe(false);
    expect(sceneSchema.safeParse({layers: [{...newLayer('/horse1.jpg', 'layer-one'), opacity: 2}]}).success).toBe(false);
    expect(sceneSchema.safeParse({layers: [{...newLayer('/horse1.jpg', 'layer-one'), extra: true}]}).success).toBe(false);
    expect(sceneSchema.safeParse({layers: Array.from({length: MAX_LAYERS + 1}, (_, i) => newLayer('/horse1.jpg', `layer-${i}x`))}).success).toBe(false);
  });

  it('keeps positions inside the window', () => {
    expect(clampPercent(-4)).toBe(0);
    expect(clampPercent(104)).toBe(100);
    expect(clampPercent(33.333)).toBe(33.3);
    expect(newLayer('/horse1.jpg', 'layer-one', {x: 120, y: -3})).toMatchObject({x: 100, y: 0});
  });

  it('places floating pictures by their centre and scales them for the preview', () => {
    const layer = {...newLayer('/horse2.jpg', 'layer-one', {x: 91, y: 25}), size: 180, rotate: 10, blur: 4};
    expect(layerStyle(layer).outer).toMatchObject({left: '91%', top: '25%', width: 180, transform: 'translate(-50%, -50%) rotate(10deg)'});
    expect(layerStyle(layer, 0.5)).toMatchObject({outer: {width: 90}, inner: {filter: 'blur(2px)'}});
    expect(layerStyle({...defaultScene.layers[0]}).inner).toMatchObject({backgroundImage: 'url("/minecraft-bg.jpg")', backgroundSize: 'cover'});
  });
});
