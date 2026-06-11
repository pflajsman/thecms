import { useRef, useState, useCallback, useEffect } from 'react';
import Image from '@tiptap/extension-image';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react';

const MIN_WIDTH = 40;

/**
 * NodeView for a resizable image. Shows the image and, when selected in an
 * editable editor, a draggable corner handle (bottom-right) to resize it.
 * The chosen width is written back to the node's `width` attribute and
 * serialized as a plain `width` attribute on the <img> in the stored HTML.
 */
function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, alt, title, width } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
  };

  const imgRef = useRef<HTMLImageElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isEditable = editor.isEditable;

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = imgRef.current?.offsetWidth ?? MIN_WIDTH;
      const maxWidth = imgRef.current?.parentElement?.offsetWidth ?? Infinity;

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

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: 'inline-block',
        position: 'relative',
        lineHeight: 0,
        maxWidth: '100%',
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
 * Image extension with a `width` attribute and a drag-to-resize NodeView.
 * Drop-in replacement for the default `@tiptap/extension-image`.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const w = element.getAttribute('width');
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
