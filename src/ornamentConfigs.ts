import { registerDesigns } from './data/designs'
import type { OrnamentDesign } from './data/designs'
import type { TextPreviewProfile } from './textPreview'
import { API } from './DownloadPanel'

// Backend-published ornament configuration (public projection of
// backend/ornaments/*.json — no server paths or Houdini internals).

export interface ConfigParamOption {
  id: string
  label: string
}

export interface ConfigParam {
  key: string
  label: string
  type: 'toggle' | 'string' | 'float' | 'int' | 'menu'
  default?: unknown
  order?: number
  help?: string
  range?: [number, number]
  step?: number
  options?: ConfigParamOption[]
  visibleWhen?: { param: string; equals: unknown }
  validation?: {
    requiredIfVisible?: boolean
    requireAlnum?: boolean
    maxLength?: number
    pattern?: string
    allowedChars?: string
  }
}

export interface PublicOrnamentConfig {
  id: string
  schemaVersion: number
  displayName: string
  category?: string
  enabled: boolean
  gallery?: {
    collection?: string
    collectionSub?: string
    cta?: string
    variants?: { id: string; label: string; blurb?: string }[]
  }
  preview?: {
    type?: string
    modelParam?: string
    models?: Record<string, string>
    flipNormals?: boolean
    unitScale?: number
    textProfile?: TextPreviewProfile
    text?: {
      toggleParam?: string
      nameParam?: string
      fontParam?: string
      sizeParam?: string
    }
    lighting?: {
      ambient?: number
      key?: { position?: [number, number, number]; intensity?: number }
      fill?: { position?: [number, number, number]; intensity?: number }
      // Geometry self-shadowing (percentage-closer soft shadows).
      shadows?: boolean
      // How dark cast shadows fall (0..1); default 0.65.
      shadowIntensity?: number
      // Text casts onto the ornament's front face.
      letterShadows?: boolean
      // The ornament mesh casts shadows onto itself.
      selfShadows?: boolean
    }
    // Gold material overrides; defaults match the shared studio gold.
    material?: {
      color?: string
      metalness?: number
      roughness?: number
    }
  }
  params: ConfigParam[]
}

export interface ConfigCollection {
  id: string
  heading: string
  sub?: string
  cta: string
  designs: OrnamentDesign[]
}

const configs = new Map<string, PublicOrnamentConfig>()
const collections: ConfigCollection[] = []
// Preview file -> owning config + the param overrides that design
// carries (e.g. which shape a gallery card preselects).
const entriesByFile = new Map<
  string,
  { config: PublicOrnamentConfig; defaults: Record<string, unknown> }
>()

export function getConfig(id: string) {
  return configs.get(id)
}

export function configEntryFor(
  design: OrnamentDesign,
): { config: PublicOrnamentConfig; defaults: Record<string, unknown> } | null {
  return entriesByFile.get(design.file) ?? null
}

export function configCollections(): ConfigCollection[] {
  return collections
}

// A config's gallery variants become regular design entries so the
// existing pickers, thumbnails and deep links work unchanged.
function projectDesigns(config: PublicOrnamentConfig): OrnamentDesign[] {
  const models = config.preview?.models ?? {}
  const variants = config.gallery?.variants ?? []
  return variants.map((variant) => ({
    label: variant.label,
    file: models[variant.id] ?? '',
    blurb: variant.blurb ?? '',
    ornament: config.id,
    unitScale: config.preview?.unitScale ?? 1,
    fonts: [],
    rails: false,
    decorations: [],
    clipping: false,
    flipNormals: config.preview?.flipNormals ?? false,
    textPreview: config.preview?.textProfile,
    collection: config.gallery?.collection ?? config.displayName,
    configDefaults: config.preview?.modelParam
      ? { [config.preview.modelParam]: variant.id }
      : {},
  }))
}

// Called once before the app renders (main.tsx). Registers each
// config's designs in the shared registry so every existing consumer
// (design picker, Explore grid, ?design= links, cart) sees them.
// Failure is non-fatal: the legacy ornaments still work.
export async function loadOrnamentConfigs() {
  const res = await fetch(`${API}/api/ornaments`)
  if (!res.ok) return
  const list = (await res.json()) as { id: string }[]
  await Promise.all(
    list.map(async ({ id }) => {
      const cfgRes = await fetch(`${API}/api/ornaments/${id}`)
      if (!cfgRes.ok) return
      const config = (await cfgRes.json()) as PublicOrnamentConfig
      configs.set(id, config)
      const designs = projectDesigns(config).filter((d) => d.file)
      registerDesigns(designs)
      for (const design of designs) {
        entriesByFile.set(design.file, {
          config,
          defaults: design.configDefaults ?? {},
        })
      }
      collections.push({
        id,
        heading: config.gallery?.collection ?? config.displayName,
        sub: config.gallery?.collectionSub,
        cta: config.gallery?.cta ?? 'Customize →',
        designs,
      })
    }),
  )
}

export function paramDefaults(config: PublicOrnamentConfig) {
  return Object.fromEntries(
    config.params.map((p) => [p.key, p.default]),
  ) as Record<string, unknown>
}

export function isVisible(param: ConfigParam, values: Record<string, unknown>) {
  const when = param.visibleWhen
  return !when || values[when.param] === when.equals
}
