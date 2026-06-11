import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import {
  Box,
  IconButton,
  Paper,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Select,
  Tooltip,
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  PermMediaOutlined,
  LinkOutlined,
  FormatColorText,
  FormatColorFill,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  FormatIndentDecrease,
  FormatIndentIncrease,
} from '@mui/icons-material';
import { MediaPickerDialog } from './MediaPickerDialog';
import { ResizableImage } from './ResizableImage';
import { FontSize } from './FontSize';
import type { MediaFile } from '../types';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const FONT_SIZES = [
  { label: 'Small', value: '13px' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '20px' },
  { label: 'Huge', value: '28px' },
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [imageMenuAnchor, setImageMenuAnchor] = useState<null | HTMLElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage,
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

  const addImageFromUrl = () => {
    setImageMenuAnchor(null);
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleGallerySelect = (media: MediaFile | MediaFile[]) => {
    const file = Array.isArray(media) ? media[0] : media;
    if (file) {
      editor
        .chain()
        .focus()
        .setImage({ src: file.blobUrl, alt: file.altText || file.originalName })
        .run();
    }
  };

  const isImageSelected = editor.isActive('image');

  const setImageFloat = (float: 'left' | 'right' | 'none') => {
    editor.chain().focus().updateAttributes('image', { float }).run();
  };

  // Heading level currently active (0 = paragraph)
  const activeHeading = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? 0;

  const currentFontSize =
    FONT_SIZES.find((f) => f.value && editor.isActive('textStyle', { fontSize: f.value }))?.value ??
    '';

  const currentColor = (editor.getAttributes('textStyle').color as string) || '#000000';

  return (
    <Paper variant="outlined">
      {/* Toolbar */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Block type (paragraph / headings) */}
        <Select
          size="small"
          value={activeHeading}
          onChange={(e) => {
            const level = Number(e.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
            }
          }}
          sx={{ minWidth: 110, mr: 0.5, '& .MuiSelect-select': { py: 0.5 } }}
        >
          <MenuItem value={0}>Paragraph</MenuItem>
          <MenuItem value={1}>Heading 1</MenuItem>
          <MenuItem value={2}>Heading 2</MenuItem>
          <MenuItem value={3}>Heading 3</MenuItem>
        </Select>

        {/* Font size */}
        <Select
          size="small"
          value={currentFontSize}
          displayEmpty
          onChange={(e) => {
            const size = e.target.value as string;
            if (size) {
              editor.chain().focus().setFontSize(size).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
          sx={{ minWidth: 90, mr: 0.5, '& .MuiSelect-select': { py: 0.5 } }}
        >
          {FONT_SIZES.map((f) => (
            <MenuItem key={f.label} value={f.value}>
              {f.label}
            </MenuItem>
          ))}
        </Select>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Bold">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBold().run()}
            color={editor.isActive('bold') ? 'primary' : 'default'}
          >
            <FormatBold />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            color={editor.isActive('italic') ? 'primary' : 'default'}
          >
            <FormatItalic />
          </IconButton>
        </Tooltip>
        <Tooltip title="Underline">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            color={editor.isActive('underline') ? 'primary' : 'default'}
          >
            <FormatUnderlined />
          </IconButton>
        </Tooltip>
        <Tooltip title="Strikethrough">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            color={editor.isActive('strike') ? 'primary' : 'default'}
          >
            <StrikethroughS />
          </IconButton>
        </Tooltip>

        {/* Text color */}
        <Tooltip title="Text color">
          <IconButton size="small" component="label">
            <FormatColorText sx={{ color: currentColor !== '#000000' ? currentColor : undefined }} />
            <input
              type="color"
              value={currentColor}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, padding: 0, border: 0 }}
            />
          </IconButton>
        </Tooltip>

        {/* Highlight */}
        <Tooltip title="Highlight">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fff59d' }).run()}
            color={editor.isActive('highlight') ? 'primary' : 'default'}
          >
            <FormatColorFill />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Alignment */}
        <Tooltip title="Align left">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
          >
            <FormatAlignLeft />
          </IconButton>
        </Tooltip>
        <Tooltip title="Align center">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
          >
            <FormatAlignCenter />
          </IconButton>
        </Tooltip>
        <Tooltip title="Align right">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
          >
            <FormatAlignRight />
          </IconButton>
        </Tooltip>
        <Tooltip title="Justify">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            color={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'}
          >
            <FormatAlignJustify />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Bullet list">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            color={editor.isActive('bulletList') ? 'primary' : 'default'}
          >
            <FormatListBulleted />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered list">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            color={editor.isActive('orderedList') ? 'primary' : 'default'}
          >
            <FormatListNumbered />
          </IconButton>
        </Tooltip>
        <Tooltip title="Quote">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            color={editor.isActive('blockquote') ? 'primary' : 'default'}
          >
            <FormatQuote />
          </IconButton>
        </Tooltip>
        <Tooltip title="Code block">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            color={editor.isActive('codeBlock') ? 'primary' : 'default'}
          >
            <Code />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Link">
          <IconButton size="small" onClick={addLink}>
            <LinkIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Image">
          <IconButton size="small" onClick={(e) => setImageMenuAnchor(e.currentTarget)}>
            <ImageIcon />
          </IconButton>
        </Tooltip>

        {/* Image float controls — only relevant when an image is selected */}
        {isImageSelected && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Wrap text on right (float left)">
              <IconButton
                size="small"
                onClick={() => setImageFloat('left')}
                color={editor.isActive('image', { float: 'left' }) ? 'primary' : 'default'}
              >
                <FormatIndentDecrease />
              </IconButton>
            </Tooltip>
            <Tooltip title="No wrap (inline)">
              <IconButton
                size="small"
                onClick={() => setImageFloat('none')}
                color={editor.isActive('image', { float: 'none' }) ? 'primary' : 'default'}
              >
                <ImageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Wrap text on left (float right)">
              <IconButton
                size="small"
                onClick={() => setImageFloat('right')}
                color={editor.isActive('image', { float: 'right' }) ? 'primary' : 'default'}
              >
                <FormatIndentIncrease />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Menu
          anchorEl={imageMenuAnchor}
          open={Boolean(imageMenuAnchor)}
          onClose={() => setImageMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setImageMenuAnchor(null);
              setGalleryOpen(true);
            }}
          >
            <ListItemIcon>
              <PermMediaOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>From media library</ListItemText>
          </MenuItem>
          <MenuItem onClick={addImageFromUrl}>
            <ListItemIcon>
              <LinkOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>By URL</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      <MediaPickerDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleGallerySelect}
        allowedMimeTypes={['image/*']}
      />

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
          // Clear floats so wrapped images don't bleed past their paragraph
          '& .ProseMirror::after': {
            content: '""',
            display: 'block',
            clear: 'both',
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
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
