import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Universal alert that works seamlessly on both Web and Mobile (iOS/Android).
 * On Web: uses window.confirm for multi-button confirmation and window.alert for notices.
 * On Native: uses native Alert.alert with full callback support.
 */
export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  if (Platform.OS === 'web') {
    const textMsg = message ? `\n\n${message}` : '';
    const fullText = `${title}${textMsg}`;

    if (!buttons || buttons.length <= 1) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(fullText);
      }
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }

    // Has 2 or more buttons -> Confirmation dialog
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[1] || buttons[0];
    const cancelBtn = buttons.find((b) => b.style === 'cancel');

    const confirmed = typeof window !== 'undefined' ? window.confirm(fullText) : true;
    if (confirmed) {
      if (confirmBtn?.onPress) {
        confirmBtn.onPress();
      }
    } else {
      if (cancelBtn?.onPress) {
        cancelBtn.onPress();
      }
    }
    return;
  }

  // Native iOS / Android
  Alert.alert(title, message, buttons);
}
