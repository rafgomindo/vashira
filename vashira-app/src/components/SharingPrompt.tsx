import React from 'react';
import { Radio } from 'lucide-react';

/** One wording for the LAN-sharing question, shown in the tour, the one-time prompt and Settings. */
export const LAN_SHARING_QUESTION = 'Share what you add with Vashira users on your network?';
export const LAN_SHARING_EXPLAINER =
  'If you say yes, the title and DOI of each paper you import are announced to other Vashira users on the same network ' +
  '(e.g. your university Wi-Fi), and they can ask your copy of Vashira for its bibliographic details. Never files, never notes. ' +
  'You can change this anytime in Settings.';

export const SharingChoiceButtons: React.FC<{ onChoose: (share: boolean) => void }> = ({ onChoose }) => (
  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
    <button className="btn-secondary" style={{ padding: '9px 14px', fontSize: '0.75rem' }} onClick={() => onChoose(false)}>
      NO, KEEP PRIVATE
    </button>
    <button className="btn-primary" style={{ padding: '9px 14px', fontSize: '0.75rem' }} onClick={() => onChoose(true)}>
      YES, SHARE
    </button>
  </div>
);

/** One-time prompt for people who already finished the tour before this question existed. */
const SharingPrompt: React.FC<{ onChoose: (share: boolean) => void }> = ({ onChoose }) => (
  <div className="glass-card scale-up" style={{ position: 'fixed', right: '24px', bottom: '24px', width: '380px', padding: '22px', zIndex: 9000 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <Radio size={16} color="var(--accent-primary)" />
      <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>{LAN_SHARING_QUESTION}</h3>
    </div>
    <p style={{ fontSize: '0.8rem', lineHeight: 1.6, opacity: 0.75, marginBottom: '16px' }}>{LAN_SHARING_EXPLAINER}</p>
    <SharingChoiceButtons onChoose={onChoose} />
  </div>
);

export default SharingPrompt;
