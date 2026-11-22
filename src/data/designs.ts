// Ornament design registry — add a new design by appending one entry
// here and dropping its preview STL under public/models/. No component
// changes are needed.
//
// Fields:
//   label        shown in the design picker and shop cards
//   file         preview STL under public/
//   blurb        one-line description on the Explore page card
//   ornament     backend ornament id sent to POST /api/jobs
//   backendDesign  classic-only: the HDA snowflake_design variant
//   unitScale    STL coordinate units per displayed millimeter — the
//                classic assets are already mm; pasta previews are in
//                Houdini scene units
//   fonts        font choices offered for this design
//   rails        whether the name sits between upper/lower rails
//   decorations  which decorator selects to show ('outer' | 'inner')
//   clipping     whether base/decorators are cleared behind the name
//   flipNormals  STL winding is reversed; flip normals at load
//   textDepth    name extrusion depth in display-mm; defaults to the
//                classic measured 5.55 mm
//   textSideExpand  lateral outline expansion in font units —
//                scales with the rendered letter height
//   textSideDepth   z-depth of that widened rim in display-mm

export type OrnamentId = 'classic' | 'pasta'

export interface OrnamentDesign {
  label: string
  file: string
  blurb: string
  ornament: OrnamentId
  backendDesign?: 'two_branch' | 'three_branch' | 'longer_branches'
  unitScale: number
  fonts: { label: string; value: string }[]
  rails: boolean
  decorations: ('outer' | 'inner')[]
  clipping: boolean
  flipNormals: boolean
  textMillimetersPerEm?: number
  textDepth?: number
  textSideExpand?: number
  textSideDepth?: number
}

const classicFonts = [
  { label: 'Lato Bold', value: 'lato' },
  { label: 'DejaVu Sans Bold', value: 'dejavu' },
  { label: 'Caladea Bold', value: 'caladea' },
]

const pastaFonts = [
  { label: 'Caladea Bold', value: 'caladea' },
  { label: 'Unifraktur Maguntia', value: 'unifraktur' },
  { label: 'Lobster', value: 'lobster' },
  { label: 'Oleo Script', value: 'oleo' },
]

export const ornamentDesigns: OrnamentDesign[] = [
  {
    label: 'Classic Snowflake',
    file: '/models/snowflake_two_pairs.stl',
    blurb: 'Classic six-armed snowflake with two pairs of branches.',
    ornament: 'classic',
    backendDesign: 'two_branch',
    unitScale: 1,
    fonts: classicFonts,
    rails: true,
    decorations: ['outer', 'inner'],
    clipping: true,
    flipNormals: false,
  },
  {
    label: 'Three Branch',
    file: '/models/snowflake_three_pairs.stl',
    blurb: 'A fuller silhouette with three pairs of branches.',
    ornament: 'classic',
    backendDesign: 'three_branch',
    unitScale: 1,
    fonts: classicFonts,
    rails: true,
    decorations: ['outer', 'inner'],
    clipping: true,
    flipNormals: false,
  },
  {
    label: 'Longer Branches',
    file: '/models/snowflake_longer_branches.stl',
    blurb: 'Elegant, elongated arms for a delicate look.',
    ornament: 'classic',
    backendDesign: 'longer_branches',
    unitScale: 1,
    fonts: classicFonts,
    rails: true,
    decorations: ['outer', 'inner'],
    clipping: true,
    flipNormals: false,
  },
  {
    label: 'Pasta Snowflake',
    file: '/models/snowflake_pasta/snowflake_pasta_no_text_v01.stl',
    blurb: 'A whimsical noodle-built snowflake with playful texture.',
    ornament: 'pasta',
    // This stable asset URL now serves the v2 no-text export in STL mm.
    unitScale: 1,
    fonts: pastaFonts,
    rails: false,
    decorations: [],
    clipping: false,
    flipNormals: false,
    // Font SOP size 1 is one em. The text transform scales by 0.25
    // and the final STL transform scales XY by 60.
    textMillimetersPerEm: 0.25 * 60,
    // Measured from the v2 STL after the back clip and Z transform.
    textDepth: 6.1875,
    textSideExpand: 0.06 * 0.25 * 60,
    textSideDepth: 5.34375,
  },
]
