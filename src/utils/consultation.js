const CHAT_VALUES = ['chat', 'konsultasi online'];
const VIDEO_VALUES = ['video', 'telekonsultasi'];

/** Map legacy database labels and current booking values to one UI contract. */
export function normalizeConsultationType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (CHAT_VALUES.some((label) => type.includes(label))) return 'Chat';
  if (VIDEO_VALUES.some((label) => type.includes(label))) return 'Video Call';
  return 'Video Call';
}

export function isChatConsultation(value) {
  return normalizeConsultationType(value) === 'Chat';
}
