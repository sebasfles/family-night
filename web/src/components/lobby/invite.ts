const SHARE_TITLE = 'Noche de juegos';
const SHARE_TEXT = '¡Únete a la sala!';

function copyWithTextarea(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithTextarea(text);
  }
}

export async function shareRoom(url: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    }
    return;
  }
  const text = encodeURIComponent(`${SHARE_TEXT} ${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
}
