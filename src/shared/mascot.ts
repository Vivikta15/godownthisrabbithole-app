export type MascotState = 'greet' | 'explain_quiz' | 'idle' | 'finder_think' | 'finder_found' | 'hop_in' | 'reading' | 'hop_out' | 'cheer';
export type MascotEvent = 'onboarding_start' | 'quiz_begin' | 'tab_change_other' | 'tab_change_finder' | 'finder_result' | 'read_start' | 'read_finish' | 'animation_done';

export function nextMascot(s: MascotState, e: MascotEvent): MascotState {
  if (e === 'read_start') return 'hop_in';
  if (s === 'hop_in' && e === 'animation_done') return 'reading';
  if (s === 'reading') return e === 'read_finish' ? 'hop_out' : 'reading'; // stays in hole until finish
  if (s === 'hop_out' && e === 'animation_done') return 'cheer';
  if (e === 'onboarding_start') return 'greet';
  if (e === 'quiz_begin') return 'explain_quiz';
  if (e === 'tab_change_finder') return 'finder_think';
  if (e === 'finder_result') return 'finder_found';
  if (e === 'tab_change_other') return 'idle';
  if (e === 'animation_done' && (s === 'greet' || s === 'cheer' || s === 'finder_found')) return 'idle';
  return s;
}
