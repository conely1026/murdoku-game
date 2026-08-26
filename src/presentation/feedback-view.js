export const SUBMISSION_FEEDBACK_DURATION_MS = 4000;

export function createFeedbackController({
  root = globalThis.document,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
} = {}) {
  let dismissHandle = null;

  function cancelDismiss() {
    if (dismissHandle !== null) {
      cancel(dismissHandle);
      dismissHandle = null;
    }
  }

  function clear() {
    cancelDismiss();
    const feedback = root?.getElementById('feedback');
    if (!feedback) {
      return;
    }
    feedback.textContent = '';
    feedback.className = 'feedback';
    feedback.hidden = true;
  }

  function show(message, { tone = '', dismissAfterMs = 0 } = {}) {
    cancelDismiss();
    const feedback = root?.getElementById('feedback');
    if (!feedback) {
      return;
    }
    feedback.textContent = message;
    feedback.className = `feedback${tone ? ` is-${tone}` : ''}`;
    feedback.hidden = !message;
    if (message && dismissAfterMs > 0) {
      dismissHandle = schedule(clear, dismissAfterMs);
    }
  }

  return { clear, show };
}
