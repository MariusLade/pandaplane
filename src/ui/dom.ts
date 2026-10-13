export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}

export function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
export const metres = (n: number): string => `${Math.round(n).toLocaleString('en-US')} m`;
