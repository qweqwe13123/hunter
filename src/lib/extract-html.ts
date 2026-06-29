// Extract the html code block from an assistant text — works on partial streams.
export function extractHtml(text: string): string | null {
  if (!text) return null;
  // Closed block
  const closed = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (closed) return closed[1].trim();
  // Open block (still streaming)
  const open = text.match(/```(?:html)?\s*([\s\S]*)$/i);
  if (open) {
    const candidate = open[1].trim();
    if (candidate.toLowerCase().includes("<!doctype") || candidate.toLowerCase().includes("<html")) {
      return candidate;
    }
  }
  // Raw doc without fences
  if (/<!doctype html|<html[\s>]/i.test(text)) return text;
  return null;
}

export function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?(?:```|$)/g, "").trim();
}
