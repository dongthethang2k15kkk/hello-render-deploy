// Storefront background scene: the faint images behind the page (pure; shared by server, storefront and the Admin editor).
import type {CSSProperties} from 'react';
import {z} from 'zod';
import {productImagePathPattern} from './product-image';

export const MAX_LAYERS = 8;
/** Width of the viewport the editor preview represents; floating sizes are stored in these pixels. */
export const DESIGN_WIDTH = 1440;
/** Images that ship with the site and can be used without uploading. */
export const BUILTIN_BACKGROUNDS = ['/minecraft-bg.jpg', '/horse1.jpg', '/horse2.jpg', '/horse3.jpg', '/horse4.jpg', '/horse5.jpg'] as const;

const imagePathSchema = z.string().refine(value => productImagePathPattern.test(value) || (BUILTIN_BACKGROUNDS as readonly string[]).includes(value), 'Upload the image first.');

export const layerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/),
  imagePath: imagePathSchema,
  /** "backdrop" covers the whole window; "floating" is a picture placed at x/y. */
  kind: z.enum(['backdrop', 'floating']),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  size: z.number().int().min(40).max(900),
  opacity: z.number().min(0.02).max(1),
  rotate: z.number().min(-45).max(45),
  blur: z.number().min(0).max(12),
  float: z.boolean(),
  hideOnMobile: z.boolean()
}).strict();

export const sceneSchema = z.object({layers: z.array(layerSchema).max(MAX_LAYERS, `Use at most ${MAX_LAYERS} images.`)}).strict();

export type BackgroundLayer = z.infer<typeof layerSchema>;
export type BackgroundScene = z.infer<typeof sceneSchema>;

/** The look the site shipped with: a faint Minecraft backdrop and two drifting horse pictures. */
export const defaultScene: BackgroundScene = {layers: [
  {id: 'backdrop-minecraft', imagePath: '/minecraft-bg.jpg', kind: 'backdrop', x: 50, y: 50, size: 400, opacity: 0.04, rotate: 0, blur: 0, float: false, hideOnMobile: false},
  {id: 'floating-horse-a', imagePath: '/horse2.jpg', kind: 'floating', x: 91, y: 25, size: 180, opacity: 0.18, rotate: 0, blur: 0, float: true, hideOnMobile: true},
  {id: 'floating-horse-b', imagePath: '/horse5.jpg', kind: 'floating', x: 9, y: 76, size: 160, opacity: 0.15, rotate: 0, blur: 0, float: true, hideOnMobile: true}
]};

export function newLayer(imagePath: string, id: string, at: {x: number; y: number} = {x: 50, y: 50}): BackgroundLayer {
  return {id, imagePath, kind: 'floating', x: clampPercent(at.x), y: clampPercent(at.y), size: 220, opacity: 0.2, rotate: 0, blur: 0, float: true, hideOnMobile: true};
}

export const clampPercent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;

/**
 * Inline styles for one layer. `scale` shrinks pixel sizes for the editor preview (preview width / DESIGN_WIDTH).
 * The outer box is positioned and rotated; the picture inside carries the blur (and the drift animation).
 */
export function layerStyle(layer: BackgroundLayer, scale = 1): {outer: CSSProperties; inner: CSSProperties} {
  const filter = layer.blur ? `blur(${Math.round(layer.blur * scale * 10) / 10}px)` : undefined;
  if (layer.kind === 'backdrop') {
    return {outer: {inset: 0, opacity: layer.opacity}, inner: {position: 'absolute', inset: 0, backgroundImage: `url("${layer.imagePath}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter}};
  }
  return {
    outer: {left: `${layer.x}%`, top: `${layer.y}%`, width: Math.round(layer.size * scale), opacity: layer.opacity, transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`},
    inner: {filter}
  };
}
