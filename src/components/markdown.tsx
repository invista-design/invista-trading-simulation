import type { ReactNode } from "react";

/** Small, safe markdown renderer for the rulebook: headings, bold, paragraphs, bullet lists and pipe tables. No raw HTML. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

const BULLET = /^( *)[-*]\s+/;

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={`t${i}`} className="my-3 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push(h[1].length === 1 ? <h1 key={i}>{inline(h[2])}</h1> : <h2 key={i}>{inline(h[2])}</h2>);
      i++;
      continue;
    }
    if (BULLET.test(line)) {
      // A list runs over blank lines until a line that is not a bullet. Items indented by 2 or more spaces nest under the item above.
      const items: { text: string; children: string[] }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          const next = lines.slice(i + 1).find((x) => x.trim());
          if (next && BULLET.test(next)) {
            i++;
            continue;
          }
          break;
        }
        const m = BULLET.exec(l);
        if (!m) break;
        const text = l.replace(BULLET, "");
        if (m[1].length >= 2 && items.length) items[items.length - 1].children.push(text);
        else items.push({ text, children: [] });
        i++;
      }
      out.push(
        <ul key={`u${i}`} className="my-3 list-disc space-y-2 pl-6">
          {items.map((it, k) => (
            <li key={k}>
              {inline(it.text)}
              {it.children.length ? (
                <ul className="mt-2 list-[circle] space-y-1 pl-6">
                  {it.children.map((c, j) => (
                    <li key={j}>{inline(c)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    out.push(<p key={i}>{inline(line)}</p>);
    i++;
  }
  return <div className="prose-rules text-sm">{out}</div>;
}
