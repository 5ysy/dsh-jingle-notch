/** PowerShell single-quoted literals never interpolate variables or subexpressions. */
export function psQuote(text: string): string { return `'${text.replaceAll("'", "''")}'` }
