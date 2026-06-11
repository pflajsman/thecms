import { useRef, useState, useCallback, useEffect } from 'react';
import Image from '@tiptap/extension-image';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';

const MIN_WIDTH = 40;

export type ImageFloat = 'left' | 'right' | 'none';

/**
 * NodeView for a resizable image. Shows the image and, when selected in an
 * editable editor, a draggable corner handle (bottom-right) to resize it.
 *
 * - `width` is written back as a plain `width` attribute on the <img>.
 * - `float` ('left' | 'right' | 'none') makes surrounding text wrap around the
 *   image; serialized as an inline `style` on the <img> so it renders the same
 *   on consumer sites.
 *
 * Resizing can grow the image up to its natural (intrinsic) resolution, so it
 * can be made bigger as well as smaller. Beyond natural size it's capped to
 * avoid upscaling blur.
 */
function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, alt, title, width, float } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
    float?: ImageFloat;
  };

  const imgRef = useRef<HTMLImageElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isEditable = editor.isEditable;

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const img = imgRef.current;
      const startX = event.clientX;
      const startWidth = img?.offsetWidth ?? MIN_WIDTH;
      // Allow growing up to the image's true resolution (naturalWidth).
      // Fall back to a generous cap if natural size is unknown.
      const naturalWidth = img?.naturalWidth || 4000;
      const maxWidth = Math.max(naturalWidth, startWidth);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.max(MIN_WIDTH, Math.min(startWidth + delta, maxWidth));
        setDragWidth(Math.round(next));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setDragWidth((finalWidth) => {
          if (finalWidth != null) {
            updateAttributes({ width: finalWidth });
          }
          return null;
        });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [updateAttributes]
  );

  // Clean up listeners if the node unmounts mid-drag
  useEffect(() => {
    return () => {
      setDragWidth(null);
    };
  }, []);

  const displayWidth = dragWidth ?? (width ? Number(width) : undefined);

  const floatStyle: React.CSSProperties =
    float === 'left'
      ? { float: 'left', marginRight: 16, marginBottom: 8 }
      : float === 'right'
      ? { float: 'right', marginLeft: 16, marginBottom: 8 }
      : {};

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: float === 'left' || float === 'right' ? 'block' : 'inline-block',
        position: 'relative',
        lineHeight: 0,
        maxWidth: '100%',
        ...floatStyle,
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        title={title || undefined}
        draggable={false}
        style={{
          width: displayWidth ? `${displayWidth}px` : 'auto',
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: 2,
          outline: selected && isEditable ? '2px solid #1976d2' : 'none',
        }}
      />

      {isEditable && selected && (
        <span
          onMouseDown={startResize}
          title="Drag to resize"
          style={{
            position: 'absolute',
            right: -5,
            bottom: -5,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#1976d2',
            border: '2px solid #fff',
            boxShadow: '0 0 2px rgba(0,0,0,0.4)',
            cursor: 'nwse-resize',
            zIndex: 1,
          }}
        />
      )}

      {isEditable && selected && displayWidth && (
        <span
          style={{
            position: 'absolute',
            top: -22,
            right: 0,
            fontSize: 11,
            lineHeight: '16px',
            padding: '0 6px',
            borderRadius: 3,
            backgroundColor: '#1976d2',
            color: '#fff',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {Math.round(displayWidth)} px
        </span>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Image extension with `width` + `float` attributes and a drag-to-resize
 * NodeView. Drop-in replacement for the default `@tiptap/extension-image`.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width') || element.style.width;
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      float: {
        default: 'none',
        parseHTML: (element) => (element.style.float as ImageFloat) || 'none',
        renderHTML: (attributes) => {
          const float = attributes.float as ImageFloat;
          if (!float || float === 'none') return {};
          const margin = float === 'left' ? '0 16px 8px 0' : '0 0 8px 16px';
          return { style: `float: ${float}; margin: ${margin};` };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
