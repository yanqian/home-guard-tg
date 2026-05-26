let activeMediaCapture = false;

export function acquireMediaCapture() {
  if (activeMediaCapture) {
    return false;
  }
  activeMediaCapture = true;
  return true;
}

export function releaseMediaCapture() {
  activeMediaCapture = false;
}

export function isMediaCaptureActive() {
  return activeMediaCapture;
}
