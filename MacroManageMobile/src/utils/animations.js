let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  // expo-haptics not available
}

export const hapticLight = () => {
  try {
    if (Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

export const hapticMedium = () => {
  try {
    if (Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (e) {}
};

export const hapticSuccess = () => {
  try {
    if (Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {}
};

export const hapticSelection = () => {
  try {
    if (Haptics) Haptics.selectionAsync();
  } catch (e) {}
};

export const hapticHeavy = () => {
  try {
    if (Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (e) {}
};

export const hapticSoft = () => {
  try {
    if (Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  } catch (e) {}
};
