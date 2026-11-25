/**
 * Turns numbered clauses into bullet points: "4.6 Text" becomes "- Text" and "6.5.1 Text" becomes a nested "  - Text".
 * Section headings such as "# 4. PERMITTED ACTIONS" are left as they are.
 */
export function toBulletPoints(text: string): string {
  return text.replace(/(^|\n)\d+\.\d+\.\d+ /g, "$1  - ").replace(/(^|\n)\d+\.\d+ /g, "$1- ");
}
