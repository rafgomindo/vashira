import React, { useState, useEffect, useRef } from 'react';
import { FileText, Type, Save, Zap, AlertCircle, Check, Search, AtSign } from 'lucide-react';

interface ScribeProps {
  hubItems: any[];
  onShowToast: (msg: string) => void;
}

export default function Scribe({ hubItems, onShowToast }: ScribeProps) {
  const [content, setContent] = useState(() => localStorage.getItem('vashira_scribe_draft') || '# New Research Insight\n\nStart writing your next breakthrough...');
  const [showCitationPicker, setShowCitationPicker] = useState(false);
  const [citationSearch, setCitationSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(0);

  const persistDraft = () => {
    localStorage.setItem('vashira_scribe_draft', content);
    onShowToast('Draft persisted.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);
    setCursorPos(pos);

    // Check for @ trigger
    const lastAtIdx = val.lastIndexOf('@', pos - 1);
    if (lastAtIdx !== -1 && (lastAtIdx === 0 || val[lastAtIdx - 1] === ' ' || val[lastAtIdx - 1] === '\n')) {
      const searchStr = val.substring(lastAtIdx + 1, pos);
      if (!searchStr.includes(' ')) {
        setCitationSearch(searchStr);
        setShowCitationPicker(true);
      } else {
        setShowCitationPicker(false);
      }
    } else {
      setShowCitationPicker(false);
    }
  };

  const insertCitation = (item: any) => {
    if (!textareaRef.current) return;
    const lastAtIdx = content.lastIndexOf('@', cursorPos - 1);
    const before = content.substring(0, lastAtIdx);
    const after = content.substring(cursorPos);
    const citeKey = `[@${item.authors.split(',')[0].trim()}${item.published}]`;
    const newContent = `${before}${citeKey} ${after}`;
    setContent(newContent);
    setShowCitationPicker(false);
    onShowToast("Citation Secured.");
    
    // Set focus back
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = lastAtIdx + citeKey.length + 1;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredItems = hubItems.filter(i => 
    i.title.toLowerCase().includes(citationSearch.toLowerCase()) || 
    i.authors.toLowerCase().includes(citationSearch.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="scribe-container fade-in" style={{ display: 'flex', flex: 1, gap: '20px', height: '100%', overflow: 'hidden' }}>
      <div data-tour="scribe-editor-area" className="glass scribe-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '24px', position: 'relative' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Type size={18} color="var(--accent-color)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>THE SCRIBE</span>
           </div>
           <button data-tour="scribe-persist" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={persistDraft}>
              <Save size={14} /> PERSIST
           </button>
        </header>
        
        <textarea 
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          className="scribe-textarea"
          style={{ 
            flex: 1, 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-primary)', 
            resize: 'none', 
            fontSize: '1rem', 
            lineHeight: 1.6,
            outline: 'none',
            padding: '12px'
          }}
        />

        {showCitationPicker && (
          <div className="glass citation-picker-pop" style={{ position: 'absolute', left: '24px', bottom: '80px', width: '300px', padding: '12px', borderRadius: '12px', zIndex: 100, border: '1px solid var(--accent-color)' }}>
             <p style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 800, marginBottom: '8px' }}>MASTERED WORKS</p>
             {filteredItems.length === 0 ? (
               <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No matches found...</p>
             ) : (
               filteredItems.map(item => (
                 <div 
                  key={item.id} 
                  className="citation-item" 
                  onClick={() => insertCitation(item)}
                  style={{ padding: '8px', cursor: 'pointer', borderRadius: '6px' }}
                 >
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.title.substring(0, 40)}...</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.authors}</p>
                 </div>
               ))
             )}
          </div>
        )}
      </div>

      <div data-tour="scribe-preview-area" className="glass scribe-preview" style={{ flex: 1, padding: '32px', borderRadius: '24px', overflowY: 'auto' }}>
         <header style={{ marginBottom: '24px', opacity: 0.5 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>LIVE PREVIEW</span>
         </header>
         <div className="markdown-body" style={{ fontSize: '1rem', color: 'var(--text-primary)', opacity: 0.9 }}>
            {/* Minimal MD Renderer */}
            {content.split('\n').map((line, i) => (
               <p key={i} style={{ marginBottom: '12px' }}>
                 {line.startsWith('# ') ? <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)', marginBottom: '16px' }}>{line.substring(2)}</h1> : 
                  line.startsWith('## ') ? <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>{line.substring(3)}</h2> : line}
               </p>
            ))}
         </div>
      </div>
    </div>
  );
}
