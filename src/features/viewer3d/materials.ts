/**
 * Shared material cache for one theme + quality. Every mesh asks for a
 * material by (colour, finish, opacity) and receives the same instance;
 * everything is disposed together when the theme or quality changes.
 */
import {
  Color,
  DoubleSide,
  FrontSide,
  type Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import type { Quality } from '../../state/preferencesStore';
import type { NodeFinish, ThemeTokens } from './themes';

export type MaterialVariant = 'solid' | 'glass' | 'flat' | 'line';

export class MaterialLibrary {
  private readonly cache = new Map<string, Material>();

  constructor(
    readonly theme: ThemeTokens,
    readonly quality: Quality,
  ) {}

  surface(color: string, opacity = 1, finish: NodeFinish | 'platform' = 'matte'): Material {
    const key = `s|${color}|${opacity.toFixed(3)}|${finish}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const transparent = opacity < 1;
    let material: Material;
    if (finish === 'wire') {
      material = new MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.45, depthWrite: opacity >= 1 });
    } else if (this.quality === 'low') {
      material = new MeshLambertMaterial({ color, transparent, opacity, depthWrite: !transparent });
    } else {
      material = new MeshStandardMaterial({
        color,
        transparent,
        opacity,
        depthWrite: !transparent,
        roughness: finish === 'platform' ? 0.95 : this.theme.node.roughness,
        metalness: finish === 'platform' ? 0 : this.theme.node.metalness,
        ...(transparent ? { side: DoubleSide } : {}),
      });
    }
    this.cache.set(key, material);
    return material;
  }

  /**
   * Translucent glass layer on node models: clear-coated, slightly tinted and
   * self-lit so it reads as glass under any style. No transmission pass (too
   * costly for many nodes); depth writes off to avoid sorting artefacts.
   */
  glass(color: string, opacity: number): Material {
    const key = `g|${color}|${opacity.toFixed(3)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    let material: Material;
    if (this.theme.node.finish === 'wire') {
      material = new MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.6, depthWrite: false });
    } else if (this.quality === 'low') {
      material = new MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false });
    } else {
      material = new MeshPhysicalMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: FrontSide,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        specularIntensity: 1,
        emissive: new Color(color).multiplyScalar(this.theme.dark ? 0.35 : 0.12),
      });
    }
    this.cache.set(key, material);
    return material;
  }

  /** Glossy accent (cores, LEDs, bands): lacquered rather than matte. */
  gloss(color: string): Material {
    if (this.quality === 'low' || this.theme.node.finish === 'wire' || this.theme.node.finish === 'ink')
      return this.surface(color, 1, this.theme.node.finish);
    const key = `l|${color}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const material = new MeshPhysicalMaterial({
      color,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: new Color(color).multiplyScalar(this.theme.dark ? 0.2 : 0.04),
    });
    this.cache.set(key, material);
    return material;
  }

  /** Unlit material for lines, frames and arrowheads. */
  flat(color: string, opacity = 1): MeshBasicMaterial {
    const key = `f|${color}|${opacity.toFixed(3)}`;
    const cached = this.cache.get(key) as MeshBasicMaterial | undefined;
    if (cached) return cached;
    const material = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    this.cache.set(key, material);
    return material;
  }

  /** Lit material for connector tubes (keeps a subtle volume). */
  tube(color: string, opacity = 1): Material {
    const key = `t|${color}|${opacity.toFixed(3)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const material =
      this.quality === 'low'
        ? new MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
        : new MeshStandardMaterial({
            color,
            roughness: 0.5,
            metalness: 0.1,
            transparent: opacity < 1,
            opacity,
            emissive: new Color(color).multiplyScalar(this.theme.dark ? 0.35 : 0.05),
          });
    this.cache.set(key, material);
    return material;
  }

  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    this.cache.clear();
  }
}

/** Mixes a colour towards the background to express "dimmed" without transparency sorting issues. */
export function dimColor(color: string, background: string, amount: number): string {
  return `#${new Color(color).lerp(new Color(background), amount).getHexString()}`;
}
