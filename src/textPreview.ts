import {
  Box2, Box3, CubicBezierCurve, ExtrudeGeometry, QuadraticBezierCurve,
  type Path,
} from 'three'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'

export interface TextPreviewProfile {
  fontUrls: Readonly<Record<string, string>>
  millimetersPerEm: number
  originMm: [x: number, y: number, backZ: number]
  // Anchor fractions across the outline bounds in X and from the
  // baseline to the outline top in Y, matching the Font SOP alignment.
  anchor: [x: number, y: number]
  depthMm: number
  rim?: { expansionMm: number; depthMm: number }
}

function expandOutlineBounds(bounds: Box2, path: Path) {
  for (const curve of path.curves) {
    bounds.expandByPoint(curve.getPoint(0))
    bounds.expandByPoint(curve.getPoint(1))
    if (curve instanceof QuadraticBezierCurve) {
      bounds.expandByPoint(curve.v1)
    } else if (curve instanceof CubicBezierCurve) {
      bounds.expandByPoint(curve.v1)
      bounds.expandByPoint(curve.v2)
    }
  }
}

export function createTextPreview(
  name: string,
  font: Font,
  fontSize: number,
  profile: TextPreviewProfile,
) {
  // One unit of font size represents one em. Only XY follows the font
  // size. The exported STL's extrusion and outline offset stay in mm.
  const shapes = font.generateShapes(name.trim(), fontSize * profile.millimetersPerEm)
  if (shapes.length === 0) return null

  const outline = new Box2()
  for (const shape of shapes) {
    expandOutlineBounds(outline, shape)
    for (const hole of shape.holes) expandOutlineBounds(outline, hole)
  }
  if (outline.isEmpty()) return null

  const [anchorX, anchorY] = profile.anchor
  const [originX, originY, backZ] = profile.originMm
  const x = originX - (outline.min.x + (outline.max.x - outline.min.x) * anchorX)
  const y = originY - outline.max.y * anchorY
  const extrude = (depth: number, expansion = 0) => {
    const geometry = new ExtrudeGeometry(shapes, {
      depth,
      curveSegments: 24,
      bevelEnabled: expansion > 0,
      bevelThickness: 0,
      bevelSize: expansion,
      bevelSegments: 1,
    })
    geometry.translate(x, y, backZ)
    geometry.computeBoundingBox()
    return geometry
  }

  const geometry = extrude(profile.depthMm)
  const sideGeometry = profile.rim
    ? extrude(profile.rim.depthMm, profile.rim.expansionMm)
    : null
  const bounds = new Box3().copy(geometry.boundingBox!)
  if (sideGeometry) bounds.union(sideGeometry.boundingBox!)
  return { geometry, sideGeometry, bounds }
}
