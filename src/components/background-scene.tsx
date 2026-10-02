import {layerStyle, type BackgroundScene} from '@/lib/background-rules';

/** Faint images fixed behind the storefront (set in Admin → Settings → Background). The glass surfaces blur them. */
export default function BackgroundSceneLayers({scene, scale = 1, className = 'bg-scene'}: {scene: BackgroundScene; scale?: number; className?: string}) {
  return <div className={className} aria-hidden="true">{scene.layers.map((layer, index) => {
    const style = layerStyle(layer, scale);
    if (layer.kind === 'backdrop') return <div key={layer.id} className="bg-layer bg-backdrop" style={style.outer}><div style={style.inner}/></div>;
    // eslint-disable-next-line @next/next/no-img-element
    return <div key={layer.id} className={`bg-layer bg-floating ${layer.hideOnMobile ? 'bg-hide-mobile' : ''}`} style={style.outer}><img src={layer.imagePath} alt="" decoding="async" className={layer.float ? `bg-drift bg-drift-${index % 2}` : undefined} style={style.inner}/></div>;
  })}</div>;
}
