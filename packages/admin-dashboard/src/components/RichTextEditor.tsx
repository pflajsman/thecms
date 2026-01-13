import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Box, IconButton, Paper, Divider } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <Paper variant="outlined">
      {/* Toolbar */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          color={editor.isActive('bold') ? 'primary' : 'default'}
        >
          <FormatBold />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          color={editor.isActive('italic') ? 'primary' : 'default'}
        >
          <FormatItalic />
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          color={editor.isActive('bulletList') ? 'primary' : 'default'}
        >
          <FormatListBulleted />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          color={editor.isActive('orderedList') ? 'primary' : 'default'}
        >
          <FormatListNumbered />
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          color={editor.isActive('blockquote') ? 'primary' : 'default'}
        >
          <FormatQuote />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          color={editor.isActive('codeBlock') ? 'primary' : 'default'}
        >
          <Code />
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <IconButton size="small" onClick={addLink}>
          <LinkIcon />
        </IconButton>
        <IconButton size="small" onClick={addImage}>
          <ImageIcon />
        </IconButton>
      </Box>

      {/* Editor */}
      <Box
        sx={{
          minHeight: 200,
          maxHeight: 500,
          overflow: 'auto',
          '& .ProseMirror': {
            padding: 2,
            outline: 'none',
            minHeight: 200,
          },
          '& .ProseMirror p.is-editor-empty:first-child::before': {
            color: 'text.secondary',
            content: placeholder ? `"${placeholder}"` : '""',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Paper>
  );
}
