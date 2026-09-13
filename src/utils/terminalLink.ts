export function terminalLink(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}