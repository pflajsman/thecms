import { useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PanelLeft,
  PanelRight,
  Quote,
  RectangleHorizontal,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { safeHref } from './link-utils'

const BLOCKS = [
  { value: '0', label: 'Paragraph' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
]
const SIZES = [
  { value: '13px', label: 'Small' },
  { value: '', label: 'Normal' },
  { value: '20px', label: 'Large' },
  { value: '28px', label: 'Huge' },
]
// Highlighter swatch stored in the document HTML (content, not a UI color).
const HIGHLIGHT = '#fff59d'
const LINK_HINT = 'Use a web address (https://…), an email (mailto:…) or a page path (/about)'
const toolClass = 'grid size-8 shrink-0 place-items-center rounded-md text-foreground hover:bg-accent disabled:opacity-40'

function Tool({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(toolClass, active && 'bg-secondary text-primary')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />
}

export function EditorToolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [urlImageOpen, setUrlImageOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState(false)

  const chain = () => editor.chain().focus()
  const heading = [1, 2, 3].find((level) => editor.isActive('heading', { level })) ?? 0
  const size = SIZES.find((s) => s.value && editor.isActive('textStyle', { fontSize: s.value }))?.value ?? ''
  const imageSelected = editor.isActive('image')
  const linkActive = editor.isActive('link')

  const applyLink = () => {
    const href = safeHref(linkValue)
    if (!href) {
      setLinkError(LINK_HINT)
      return
    }
    chain().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  const applyImageUrl = () => {
    const src = safeHref(imageUrl)
    if (!src || src.startsWith('mailto:') || src.startsWith('#')) {
      setImageError(true)
      return
    }
    chain().setImage({ src }).run()
    setUrlImageOpen(false)
    setImageUrl('')
    setImageError(false)
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
      <label className="sr-only" htmlFor="rte-block">
        Text style
      </label>
      <select
        id="rte-block"
        value={String(heading)}
        onChange={(e) => {
          const level = Number(e.target.value)
          if (level === 0) chain().setParagraph().run()
          else chain().toggleHeading({ level: level as 1 | 2 | 3 }).run()
        }}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {BLOCKS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="rte-size">
        Text size
      </label>
      <select
        id="rte-size"
        value={size}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {SIZES.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Divider />
      <Tool label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
        <Bold aria-hidden className="size-4" />
      </Tool>
      <Tool label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
        <Italic aria-hidden className="size-4" />
      </Tool>
      <Tool label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon aria-hidden className="size-4" />
      </Tool>
      <Tool label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough aria-hidden className="size-4" />
      </Tool>
      <label className={cn(toolClass, 'relative cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring')} title="Text color">
        <span className="sr-only">Text color</span>
        <span aria-hidden className="font-serif text-sm font-semibold underline decoration-2">
          A
        </span>
        <input
          type="color"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onChange={(e) => chain().setColor(e.target.value).run()}
        />
      </label>
      <Tool label="Highlight" active={editor.isActive('highlight')} onClick={() => chain().toggleHighlight({ color: HIGHLIGHT }).run()}>
        <Highlighter aria-hidden className="size-4" />
      </Tool>
      <Divider />
      <Tool label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}>
        <AlignLeft aria-hidden className="size-4" />
      </Tool>
      <Tool label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}>
        <AlignCenter aria-hidden className="size-4" />
      </Tool>
      <Tool label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}>
        <AlignRight aria-hidden className="size-4" />
      </Tool>
      <Tool label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}>
        <AlignJustify aria-hidden className="size-4" />
      </Tool>
      <Divider />
      <Tool label="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
        <List aria-hidden className="size-4" />
      </Tool>
      <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered aria-hidden className="size-4" />
      </Tool>
      <Tool label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>
        <Quote aria-hidden className="size-4" />
      </Tool>
      <Tool label="Code block" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 aria-hidden className="size-4" />
      </Tool>
      <Divider />
      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open)
          if (open) {
            setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '')
            setLinkError(null)
          }
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" aria-label="Link" title="Link" aria-pressed={linkActive} className={cn(toolClass, linkActive && 'bg-secondary text-primary')}>
            <LinkIcon aria-hidden className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              // The popover is portaled, but React still bubbles submit to the entry form around the editor.
              e.stopPropagation()
              applyLink()
            }}
          >
            <Label htmlFor="rte-link">Link URL</Label>
            <Input
              id="rte-link"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="https://example.com"
              aria-invalid={linkError ? true : undefined}
              aria-describedby={linkError ? 'rte-link-error' : undefined}
            />
            {linkError && (
              <p id="rte-link-error" className="text-xs text-destructive">
                {linkError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {linkActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    chain().extendMarkRange('link').unsetLink().run()
                    setLinkOpen(false)
                  }}
                >
                  <Unlink aria-hidden />
                  Remove link
                </Button>
              )}
              <Button type="submit" size="sm">
                Apply link
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Insert image" title="Insert image" className={toolClass}>
            <ImageIcon aria-hidden className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onPickImage}>From media library</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setUrlImageOpen(true)}>By URL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {imageSelected && (
        <>
          <Divider />
          <Tool label="Wrap text on the right" active={editor.isActive('image', { float: 'left' })} onClick={() => chain().updateAttributes('image', { float: 'left' }).run()}>
            <PanelLeft aria-hidden className="size-4" />
          </Tool>
          <Tool label="No text wrap" active={editor.isActive('image', { float: 'none' })} onClick={() => chain().updateAttributes('image', { float: 'none' }).run()}>
            <RectangleHorizontal aria-hidden className="size-4" />
          </Tool>
          <Tool label="Wrap text on the left" active={editor.isActive('image', { float: 'right' })} onClick={() => chain().updateAttributes('image', { float: 'right' }).run()}>
            <PanelRight aria-hidden className="size-4" />
          </Tool>
        </>
      )}
      {urlImageOpen && (
        // Not a <form>: the editor usually sits inside the entry form, and nested forms submit the outer one.
        <div className="flex w-full flex-wrap items-center gap-1 pt-1">
          <label className="sr-only" htmlFor="rte-image-url">
            Image URL
          </label>
          <Input
            id="rte-image-url"
            autoFocus
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyImageUrl()
              } else if (e.key === 'Escape') {
                setUrlImageOpen(false)
              }
            }}
            placeholder="https://…"
            className="h-8 min-w-0 flex-1"
            aria-invalid={imageError ? true : undefined}
          />
          <Button type="button" size="sm" onClick={applyImageUrl}>
            Insert
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setUrlImageOpen(false)}>
            Cancel
          </Button>
          {imageError && <p className="w-full text-xs text-destructive">Enter an image address starting with https://</p>}
        </div>
      )}
    </div>
  )
}
