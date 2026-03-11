'use client';

import { useCallback, useRef, forwardRef, useImperativeHandle, useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  LevelFormat,
  AlignmentType,
} from 'docx';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Copy,
  Check,
  Type,
} from 'lucide-react';

export interface RichTextEditorRef {
  getHtml: () => string;
  getText: () => string;
  getMarkdown: () => string;
  getDocx: () => Promise<Blob>;
}

interface RichTextEditorProps {
  initialContent?: string;
  placeholder?: string;
  minHeight?: number;
  language?: string;
  onChange?: (content: string) => void;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, string>;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

// Convert Markdown to HTML for initial content
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // Check if already HTML - return as-is
  if (markdown.includes('<') && markdown.includes('>')) {
    // Clean up HTML - remove unwanted wrapper divs and styles that might come from copy-paste
    let cleaned = markdown
      // Remove common office/website wrappers
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<meta[^>]*>/gi, '') // Remove meta tags
      .replace(/<link[^>]*>/gi, '') // Remove link tags
      // Clean up common attributes we don't need
      .replace(/\s+(class|style|id|data-\w+|on\w+)="[^"]*"/gi, '')
      .replace(/\s+(class|style|id|data-\w+|on\w+)='[^']*'/gi, '')
      // Convert spans to plain text
      .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
      // Convert divs to paragraphs
      .replace(/<div[^>]*>(.*?)<\/div>/gi, '<p>$1</p>')
      // Clean up empty elements
      .replace(/<p><\/p>/gi, '')
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/<[^/>][^>]*>\s*<\/[^>]+>/gi, '')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .trim();
    
    return cleaned;
  }
  
  let html = markdown;
  
  // Headings
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Bold and Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');
  
  // Blockquote
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
  
  // Lists - preserve the structure better
  html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
  
  // Wrap consecutive li elements in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Paragraphs - wrap lines that aren't already wrapped
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

export default forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(
    { initialContent = '', placeholder = 'Schreiben Sie hier...', minHeight = 200, onChange },
    ref
  ) {
    const colorInputRef = useRef<HTMLInputElement>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [activeStates, setActiveStates] = useState({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      h1: false,
      h2: false,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      alignLeft: false,
      alignCenter: false,
      alignRight: false,
    });

    // Convert initial content to HTML if it's markdown
    const processedContent = useMemo(() => {
      return markdownToHtml(initialContent);
    }, [initialContent]);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2],
          },
          blockquote: {
            HTMLAttributes: {
              class: 'border-l-4 border-gray-300 pl-4 italic text-gray-600',
            },
          },
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TextStyle,
        Color,
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: processedContent,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
        updateActiveStates();
      },
    });

    // Update content when initialContent changes
    useEffect(() => {
      if (editor && initialContent) {
        const currentHtml = editor.getHTML();
        const newHtml = markdownToHtml(initialContent);
        // Only update if content actually changed
        if (currentHtml !== newHtml && !editor.isFocused) {
          editor.commands.setContent(newHtml);
        }
      }
    }, [initialContent, editor]);

    // Update active states based on cursor position
    const updateActiveStates = useCallback(() => {
      if (!editor) return;
      
      setActiveStates({
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        h1: editor.isActive('heading', { level: 1 }),
        h2: editor.isActive('heading', { level: 2 }),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        alignLeft: editor.isActive({ textAlign: 'left' }),
        alignCenter: editor.isActive({ textAlign: 'center' }),
        alignRight: editor.isActive({ textAlign: 'right' }),
      });
    }, [editor]);

    useEffect(() => {
      if (!editor) return;
      
      const handleUpdate = () => {
        updateActiveStates();
      };

      editor.on('transaction', handleUpdate);
      editor.on('selectionUpdate', handleUpdate);
      editor.on('focus', handleUpdate);

      return () => {
        editor.off('transaction', handleUpdate);
        editor.off('selectionUpdate', handleUpdate);
        editor.off('focus', handleUpdate);
      };
    }, [editor, updateActiveStates]);

    // Expose methods
    useImperativeHandle(ref, () => ({
      getHtml: () => editor?.getHTML() || '',
      getText: () => editor?.getText() || '',
      getMarkdown: () => {
      if (!editor) return '';
      
      // Get the JSON representation of the document
      const doc = editor.getJSON() as TipTapNode;
      
      // Convert JSON to Markdown recursively
      function nodeToMarkdown(
        node: TipTapNode, 
        listDepth = 0, 
        listType: string = '', 
        listIndex = 0
      ): string {
        if (!node) return '';
        
        // Handle text nodes with marks (formatting)
        if (node.type === 'text' && node.text !== undefined) {
          let text = node.text;
          
          // Apply marks (formatting)
          if (node.marks && Array.isArray(node.marks)) {
            for (const mark of node.marks) {
              if (mark.type === 'bold') {
                text = `**${text}**`;
              } else if (mark.type === 'italic') {
                text = `*${text}*`;
              } else if (mark.type === 'underline') {
                text = `<u>${text}</u>`;
              } else if (mark.type === 'strike') {
                text = `~~${text}~~`;
              } else if (mark.type === 'code') {
                text = `\`${text}\``;
              } else if (mark.type === 'textStyle' && mark.attrs?.color) {
                text = `<span style="color:${mark.attrs.color}">${text}</span>`;
              }
            }
          }
          return text;
        }
        
        // Handle block nodes
        if (!node.content || !Array.isArray(node.content) || node.content.length === 0) {
          if (node.type === 'paragraph') return '';
          return '';
        }
        
        // Process children
        let childrenText = '';
        for (const child of node.content) {
          childrenText += nodeToMarkdown(child, listDepth, listType, listIndex);
        }
        
        // Wrap in appropriate block format
        switch (node.type) {
          case 'heading':
            const level = (node.attrs?.level as number) || 1;
            return `${'#'.repeat(level)} ${childrenText}\n`;
          
          case 'paragraph':
            return `${childrenText}\n`;
          
          case 'bulletList':
          case 'orderedList':
            return childrenText;
          
          case 'listItem':
            const indent = '  '.repeat(listDepth);
            const prefix = listType === 'ordered' ? `${listIndex}. ` : '- ';
            // Process the content of list item
            let itemText = '';
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                if (child.type === 'paragraph') {
                  if (child.content && Array.isArray(child.content)) {
                    for (const textNode of child.content) {
                      if (textNode.type === 'text') {
                        itemText += nodeToMarkdown(textNode);
                      }
                    }
                  }
                } else if (child.type === 'bulletList' || child.type === 'orderedList') {
                  const nextListType = child.type === 'orderedList' ? 'ordered' : 'bullet';
                  itemText += '\n' + nodeToMarkdown(child, listDepth + 1, nextListType, 1);
                } else {
                  itemText += nodeToMarkdown(child);
                }
              }
            }
            return `${indent}${prefix}${itemText}\n`;
          
          case 'blockquote':
            const lines = childrenText.trim().split('\n');
            return lines.map((l: string) => `> ${l}`).join('\n') + '\n';
          
          case 'codeBlock':
            return `\`\`\`\n${childrenText}\`\`\`\n`;
          
          case 'hardBreak':
            return '\n';
          
          default:
            return childrenText;
        }
      }
      
      // Process the document
      let markdown = '';
      let currentListType = '';
      let currentListIndex = 0;
      
      if (doc.content && Array.isArray(doc.content)) {
        for (let i = 0; i < doc.content.length; i++) {
          const node = doc.content[i];
          
          // Track list state
          if (node.type === 'bulletList') {
            currentListType = 'bullet';
            currentListIndex = 0;
          } else if (node.type === 'orderedList') {
            currentListType = 'ordered';
            currentListIndex = 0;
          }
          
          // Handle list items with proper numbering
          if (node.type === 'bulletList' || node.type === 'orderedList') {
            const isOrdered = node.type === 'orderedList';
            if (node.content && Array.isArray(node.content)) {
              for (let j = 0; j < node.content.length; j++) {
                const listItem = node.content[j];
                if (listItem.type === 'listItem') {
                  currentListIndex++;
                  let itemText = '';
                  if (listItem.content && Array.isArray(listItem.content)) {
                    for (const child of listItem.content) {
                      if (child.type === 'paragraph' && child.content && Array.isArray(child.content)) {
                        for (const textNode of child.content) {
                          if (textNode.type === 'text') {
                            itemText += nodeToMarkdown(textNode);
                          }
                        }
                      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
                        // Nested list
                        const nestedIsOrdered = child.type === 'orderedList';
                        if (child.content && Array.isArray(child.content)) {
                          for (let k = 0; k < child.content.length; k++) {
                            const nestedItem = child.content[k];
                            if (nestedItem.type === 'listItem' && nestedItem.content && Array.isArray(nestedItem.content)) {
                              let nestedText = '';
                              for (const nc of nestedItem.content) {
                                if (nc.type === 'paragraph' && nc.content && Array.isArray(nc.content)) {
                                  for (const nt of nc.content) {
                                    if (nt.type === 'text') {
                                      nestedText += nodeToMarkdown(nt);
                                    }
                                  }
                                }
                              }
                              const prefix = nestedIsOrdered ? `${k + 1}. ` : '- ';
                              markdown += `  ${prefix}${nestedText}\n`;
                            }
                          }
                        }
                      }
                    }
                  }
                  const prefix = isOrdered ? `${j + 1}. ` : '- ';
                  markdown += `${prefix}${itemText}\n`;
                }
              }
            }
            markdown += '\n';
          } else {
            markdown += nodeToMarkdown(node);
          }
        }
      }
      
      // Clean up multiple newlines
      return markdown.replace(/\n{3,}/g, '\n\n').trim();
    },
    getDocx: async () => {
      if (!editor) return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // Definiere Typen für TipTap JSON
      interface TipTapMark {
        type: string;
        attrs?: Record<string, string>;
      }

      interface TipTapNode {
        type: string;
        content?: TipTapNode[];
        text?: string;
        marks?: TipTapMark[];
        attrs?: Record<string, unknown>;
      }
      
      const doc = editor.getJSON() as TipTapNode;
      const docxParagraphs: Paragraph[] = [];
      
      // Hilfsfunktion für TextRuns
      function createTextRuns(node: TipTapNode): TextRun[] {
        if (!node.text) return [];
        
        // Verwende Record<string, unknown> für flexible Optionen
        const options: Record<string, unknown> = {
          text: node.text,
        };
        
        if (node.marks && Array.isArray(node.marks)) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                options.bold = true;
                break;
              case 'italic':
                options.italics = true;
                break;
              case 'underline':
                options.underline = {};
                break;
              case 'strike':
                options.strike = true;
                break;
              case 'code':
                options.font = 'Courier New';
                break;
              case 'textStyle':
                if (mark.attrs?.color) {
                  options.color = mark.attrs.color;
                }
                break;
            }
          }
        }
        
        return [new TextRun(options)];
      }
      
      // Dokumentknoten verarbeiten
      if (doc.content && Array.isArray(doc.content)) {
        for (const node of doc.content) {
          // Überschriften
          if (node.type === 'heading') {
            const level = (node.attrs?.level as number) || 1;
            const headingLevel = level === 1 
              ? HeadingLevel.HEADING_1 
              : level === 2 
                ? HeadingLevel.HEADING_2 
                : HeadingLevel.HEADING_3;
            
            const textRuns: TextRun[] = [];
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                if (child.type === 'text') {
                  textRuns.push(...createTextRuns(child));
                }
              }
            }
            
            docxParagraphs.push(new Paragraph({
              heading: headingLevel,
              children: textRuns,
            }));
          }
          
          // Absätze
          else if (node.type === 'paragraph') {
            const textRuns: TextRun[] = [];
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                if (child.type === 'text') {
                  textRuns.push(...createTextRuns(child));
                }
              }
            }
            
            docxParagraphs.push(new Paragraph({
              children: textRuns.length > 0 ? textRuns : [new TextRun('')],
            }));
          }
          
          // Listen
          else if (node.type === 'bulletList' || node.type === 'orderedList') {
            const isOrdered = node.type === 'orderedList';
            
            if (node.content && Array.isArray(node.content)) {
              for (const listItem of node.content) {
                // Type Guard für listItem
                if (listItem && typeof listItem === 'object' && 'type' in listItem && listItem.type === 'listItem') {
                  const textRuns: TextRun[] = [];
                  
                  // Prüfe, ob listItem.content existiert und ein Array ist
                  if (listItem.content && Array.isArray(listItem.content)) {
                    for (const child of listItem.content) {
                      // Type Guard für child
                      if (child && typeof child === 'object' && 'type' in child) {
                        if (child.type === 'paragraph' && child.content && Array.isArray(child.content)) {
                          for (const textNode of child.content) {
                            if (textNode && typeof textNode === 'object' && 'type' in textNode && textNode.type === 'text') {
                              textRuns.push(...createTextRuns(textNode));
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  docxParagraphs.push(new Paragraph({
                    children: textRuns,
                    bullet: {
                      level: 0,
                      format: isOrdered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
                    },
                  }));
                }
              }
            }
          }
          
          // Zitate
          else if (node.type === 'blockquote') {
            const textRuns: TextRun[] = [];
            if (node.content && Array.isArray(node.content)) {
              for (const child of node.content) {
                if (child && typeof child === 'object' && 'type' in child) {
                  if (child.type === 'paragraph' && child.content && Array.isArray(child.content)) {
                    for (const textNode of child.content) {
                      if (textNode && typeof textNode === 'object' && 'type' in textNode && textNode.type === 'text') {
                        textRuns.push(...createTextRuns(textNode));
                      }
                    }
                  }
                }
              }
            }
            
            docxParagraphs.push(new Paragraph({
              children: textRuns,
              indent: { left: 720 }, // 720 twips = 0.5 inch
            }));
          }
        }
      }
      
      // Dokument erstellen
      const document = new Document({
        sections: [{
          properties: {},
          children: docxParagraphs,
        }],
      });
      
      // Blob generieren
      const blob = await Packer.toBlob(document);
      return blob;
    },
    }));

    // Copy
    const handleCopy = useCallback(async () => {
      if (editor) {
        await navigator.clipboard.writeText(editor.getHTML());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    }, [editor]);

    // Color change - only apply to selection or set for future typing
    const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      setCurrentColor(color);
      
      if (editor) {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          // Has selection - apply color to selection only
          editor.chain().focus().setColor(color).run();
        }
        // Store color for future typing - will be applied on next character
      }
    }, [editor]);

    // Apply current color while typing
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (!editor) return;
      
      // Apply color for printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setTimeout(() => {
          // Only apply color if we're typing (not deleting)
          const { from, to } = editor.state.selection;
          if (from === to) {
            // Cursor position, no selection - apply current color
            editor.commands.setColor(currentColor);
          }
        }, 10);
      }
    }, [editor, currentColor]);

    // Toolbar button
    const ToolbarBtn = ({ 
      onClick, 
      icon: Icon, 
      title, 
      active = false 
    }: { 
      onClick: () => void; 
      icon: React.ElementType; 
      title: string;
      active?: boolean;
    }) => (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`p-2 rounded transition-colors ${
          active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );

    if (!editor) {
      return (
        <div className="border rounded-xl p-8 text-center text-muted-foreground">
          Editor wird geladen...
        </div>
      );
    }

    return (
      <div className="border rounded-xl overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/50">
          {/* Text formatting */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            icon={Bold} 
            title="Fett (Ctrl+B)" 
            active={activeStates.bold}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            icon={Italic} 
            title="Kursiv (Ctrl+I)" 
            active={activeStates.italic}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleUnderline().run()} 
            icon={UnderlineIcon} 
            title="Unterstrichen (Ctrl+U)" 
            active={activeStates.underline}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleStrike().run()} 
            icon={Strikethrough} 
            title="Durchgestrichen" 
            active={activeStates.strike}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {/* Headings */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
            icon={Heading1} 
            title="Überschrift 1" 
            active={activeStates.h1}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
            icon={Heading2} 
            title="Überschrift 2" 
            active={activeStates.h2}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {/* Lists */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            icon={List} 
            title="Aufzählungsliste" 
            active={activeStates.bulletList}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            icon={ListOrdered} 
            title="Nummerierte Liste" 
            active={activeStates.orderedList}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {/* Quote */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().toggleBlockquote().run()} 
            icon={Quote} 
            title="Zitat" 
            active={activeStates.blockquote}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {/* Alignment */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().setTextAlign('left').run()} 
            icon={AlignLeft} 
            title="Links ausrichten" 
            active={activeStates.alignLeft}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().setTextAlign('center').run()} 
            icon={AlignCenter} 
            title="Zentrieren" 
            active={activeStates.alignCenter}
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().setTextAlign('right').run()} 
            icon={AlignRight} 
            title="Rechts ausrichten" 
            active={activeStates.alignRight}
          />

          <div className="w-px h-6 bg-border mx-1" />

          {/* Color Picker */}
          <button
            type="button"
            onClick={() => colorInputRef.current?.click()}
            title="Textfarbe"
            className="p-2 rounded hover:bg-accent transition-colors flex items-center gap-1"
          >
            <Type className="w-4 h-4" />
            <div 
              className="w-5 h-5 rounded border border-border"
              style={{ backgroundColor: currentColor }}
            />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={currentColor}
            onChange={handleColorChange}
            className="w-0 h-0 opacity-0 absolute"
          />

          <div className="flex-1" />

          {/* Undo/Redo */}
          <ToolbarBtn 
            onClick={() => editor.chain().focus().undo().run()} 
            icon={Undo2} 
            title="Rückgängig (Ctrl+Z)" 
          />
          <ToolbarBtn 
            onClick={() => editor.chain().focus().redo().run()} 
            icon={Redo2} 
            title="Wiederholen (Ctrl+Y)" 
          />

          {/* Copy */}
          <ToolbarBtn 
            onClick={handleCopy} 
            icon={isCopied ? Check : Copy} 
            title="HTML kopieren" 
          />
        </div>

        {/* Editor */}
        <EditorContent 
          editor={editor}
          onKeyDown={handleKeyDown}
          className="prose prose-sm max-w-none"
          style={{ minHeight: `${minHeight}px` }}
        />

        {/* Styles for the editor */}
        <style jsx global>{`
          .tiptap {
            padding: 1rem;
            outline: none;
            min-height: ${minHeight}px;
          }
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: hsl(var(--muted-foreground));
            pointer-events: none;
            height: 0;
          }
          .tiptap h1 {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 0.5em;
          }
          .tiptap h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 0.5em;
          }
          .tiptap blockquote {
            border-left: 4px solid hsl(var(--border));
            padding-left: 1em;
            margin-left: 0;
            color: hsl(var(--muted-foreground));
            font-style: italic;
          }
          .tiptap ul, .tiptap ol {
            padding-left: 1.5em;
            margin: 0.5em 0;
          }
          .tiptap ul {
            list-style-type: disc;
          }
          .tiptap ol {
            list-style-type: decimal;
          }
        `}</style>

        {/* Status */}
        <div className="flex gap-4 px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
          <span>{editor.getText().length} Zeichen</span>
          <span>{editor.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0} Wörter</span>
          <div className="flex-1" />
          <span className="flex items-center gap-1">
            Aktive Farbe: 
            <div 
              className="w-3 h-3 rounded-sm border border-border inline-block"
              style={{ backgroundColor: currentColor }}
            />
          </span>
        </div>
      </div>
    );
  }
);
