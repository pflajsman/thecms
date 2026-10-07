import { useMedia } from '../hooks/useContent';

/** An image from the media library by id. Keeps its box while loading, so the layout does not jump. */
export function MediaImage({ id, alt, className, eager }: { id?: string; alt: string; className?: string; eager?: boolean }) {
  const { data } = useMedia(id);
  const ratio = data?.width && data?.height ? `${data.width} / ${data.height}` : undefined;
  return (
    <div className={`media ${className ?? ''}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      {data?.url && (
        <img
          src={data.url}
          alt={alt}
          width={data.width}
          height={data.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </div>
  );
}
