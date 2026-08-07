"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link2,
  Link2Off,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
} from "lucide-react";
import { toast } from "../../lib/toast";

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-accent text-on-brand" : "text-secondary hover:bg-surface-sunken hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-default" aria-hidden="true" />;
}

/**
 * Rich-text editor for /admin/blog post bodies. Tiptap (ProseMirror), a fixed
 * feature set exposed as a toolbar — bold/italic/underline/strike, H2/H3,
 * bullet/ordered lists, blockquote, code block, link, inline image (uploads
 * to Cloudinary via /api/admin/blog/upload-image), horizontal rule, text
 * align, undo/redo.
 *
 * Emits sanitized-on-write HTML via onChange — see src/lib/blog-content.js
 * for the server-side sanitize pass that runs before this ever hits the DB.
 */
export default function RichTextEditor({ value, onChange, placeholder = "Write the post…" }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      ImageExtension.configure({ HTMLAttributes: { class: "rounded-card" } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: "article-content min-h-64 max-w-none px-4 py-3 focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  function setLink() {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: form });
    setUploading(false);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Image upload failed.");
      return;
    }
    editor.chain().focus().setImage({ src: data.url }).run();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-default bg-surface transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-default bg-surface-sunken/60 px-2 py-1.5">
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Add link" active={editor.isActive("link")} onClick={setLink}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Remove link" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Insert image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickImage} />

        <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="bg-surface" />
    </div>
  );
}
