// Homepage "From Design to Reality" gallery — real photos of printed ornaments.
//
// To add a photograph:
//   1. Drop the optimized image (WebP preferred, portrait crop) in public/gallery/.
//   2. Add an entry below with its /gallery/... path, descriptive alt text,
//      and an optional caption and/or product link.
//   No component changes are needed; new entries render automatically,
//   three per row on desktop, wrapping to further rows, one per row on mobile.

export interface GalleryEntry {
  image: string
  alt: string
  caption?: string
  link?: string
}

export const galleryPhotos: GalleryEntry[] = [
  {
    image: '/gallery/ornament-brandon.webp',
    alt: '3D-printed gold snowflake ornament with the name BRANDON, hanging by a red ribbon on a Christmas tree',
  },
  {
    image: '/gallery/ornament-kennedy.webp',
    alt: '3D-printed gold snowflake ornament with the name KENNEDY, hanging by a red ribbon on a Christmas tree',
  },
  {
    image: '/gallery/ornament-richard.webp',
    alt: '3D-printed gold snowflake ornament with the name RICHARD, hanging by a red ribbon on a Christmas tree',
  },
]
