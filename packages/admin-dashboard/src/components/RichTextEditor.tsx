import { useState } from 'react'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { MediaPickerDialog } from '@/features/media/components/MediaPickerDialog'
import { ResizableImage } from './ResizableImage'
import { FontSize } from './FontSize'
import { EditorToolbar } from './rich-text/EditorToolbar'
import type { MediaFile } from '../types'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'cms-prose min-h-[200px] p-4 focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(placeholder ? { 'aria-label': placeholder } : {}),
      },
    },
  })
  // Re-render the toolbar whenever the selection or the active marks change.
  useEditorState({
    editor,
    selector: (ctx) => ({
      selection: ctx.editor?.state.selection.toJSON(),
      marks: ctx.editor?.state.storedMarks?.map((m) => m.type.name).join(',') ?? '',
      doc: ctx.editor?.state.doc,
    }),
  })

  if (!editor) return null

  const insertFromLibrary = (media: MediaFile[]) => {
    const file = media[0]
    if (file) editor.chain().focus().setImage({ src: file.blobUrl, alt: file.altText || file.originalName }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring/50">
      <EditorToolbar editor={editor} onPickImage={() => setGalleryOpen(true)} />
      <div className="max-h-[500px] overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <MediaPickerDialog open={galleryOpen} onOpenChange={setGalleryOpen} onSelect={insertFromLibrary} accept={['image/*']} />
    </div>
  )
}
