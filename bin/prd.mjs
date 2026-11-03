// Turns a PRD into plain text the agent can read: runs/<id>/prd.md.
// Accepts .md, .markdown and .txt as they are, .docx (macOS textutil, or the
// document XML unzipped), and .pdf (pdftotext, from poppler).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function docxText(file) {
  if (process.platform === 'darwin') {
    try { return run('textutil', ['-convert', 'txt', '-stdout', file]); } catch { /* fall back to the XML */ }
  }
  let xml;
  try {
    xml = run('unzip', ['-p', file, 'word/document.xml']);
  } catch {
    throw new Error(`Could not read ${path.basename(file)}. Save it as .md or .txt and pass that instead.`);
  }
  return decode(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

function pdfText(file) {
  try {
    return run('pdftotext', ['-layout', file, '-']);
  } catch {
    throw new Error(`Could not read ${path.basename(file)}: install pdftotext (brew install poppler), or save the PRD as .docx, .md or .txt.`);
  }
}

/** The PRD as Markdown-ish text with a heading naming the source file. */
export function prdToMarkdown(file) {
  if (!existsSync(file)) {
    // Suggest the documents that are in that folder: names with spaces are easy to get wrong.
    const dir = path.dirname(file);
    // Newest first; skip hidden files and Word's lock files (".~", "~$").
    const nearby = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => /\.(docx|pdf|md|markdown|txt)$/i.test(f) && !/^(\.|~\$)/.test(f))
          .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t)
          .slice(0, 8)
          .map(({ f }) => f)
      : [];
    const hint = nearby.length
      ? `\nDocuments in ${dir}:\n${nearby.map((f) => `  "${path.join(dir, f)}"`).join('\n')}\nPut the path in quotes when the name has spaces.`
      : '';
    throw new Error(`PRD file not found: ${file}${hint}`);
  }
  const ext = path.extname(file).toLowerCase();
  let text;
  if (['.md', '.markdown', '.txt'].includes(ext)) text = readFileSync(file, 'utf8');
  else if (ext === '.docx') text = docxText(file);
  else if (ext === '.pdf') text = pdfText(file);
  else throw new Error(`Unsupported PRD format "${ext}". Use .docx, .pdf, .md or .txt.`);

  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 200) throw new Error(`${path.basename(file)} has almost no text (${text.length} characters). Is it a scanned PDF?`);
  return `# PRD: ${path.basename(file)}\n\n${text}\n`;
}
