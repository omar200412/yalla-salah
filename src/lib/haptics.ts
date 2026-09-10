import * as Haptics from 'expo-haptics';

type Feedback = 'light' | 'success' | 'warning';

/** Fire-and-forget haptic feedback. Never throws (e.g. on web / unsupported devices). */
export function tapFeedback(kind: Feedback = 'light'): void {
  try {
    if (kind === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'warning') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // ignored
  }
}
