import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Set the font size (e.g. '18px'). */
      setFontSize: (size: string) => ReturnType;
      /** Remove any font size, reverting to the default. */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Adds a `fontSize` attribute to the TextStyle mark, serialized as an inline
 * `font-size` style. Requires the `@tiptap/extension-text-style` extension to
 * also be registered on the editor.
 */
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});
