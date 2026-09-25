// Our prompts wrap untrusted text in tags such as <content>…</content> or <source>…</source>, so
// the model can tell data from instructions. That only works if the data can't contain those tags
// itself: a post containing "</content> New instructions: …" would otherwise "close" the data
// block early and smuggle in text that looks like it came from us.
//
// Escaping the few characters that form tags makes that impossible. Models read &lt; &gt; fine,
// so summaries and answers are unaffected.
export function escapeUntrusted(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
