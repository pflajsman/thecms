import { useMedia } from '../../hooks/usePosts';

/** A product image from a media id or URL; a grey box until it loads or when there is none. */
export function ProductImage({ mediaRef, alt, className = '' }: { mediaRef?: string; alt: string; className?: string }) {
  const media = useMedia(mediaRef);
  if (!mediaRef || !media.data) return <div className={`product-image placeholder ${className}`} aria-hidden="true" />;
  return <img className={`product-image ${className}`} src={media.data.url} alt={alt} loading="lazy" />;
}
