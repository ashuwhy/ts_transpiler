// src/parser/jsdocExtractor.ts

import ts from 'typescript';

export interface ExtractedSpecs {
  requires: string[];
  ensures: string[];
  cases: string[];
  preds: string[];
  foralls: string[];
}

export function extractJSDocSpecs(node: ts.Node, sourceFile: ts.SourceFile): ExtractedSpecs {
  const specs: ExtractedSpecs = {
    requires: [],
    ensures: [],
    cases: [],
    preds: [],
    foralls: []
  };

  // Extract from JSDoc tags
  const tags = ts.getJSDocTags(node);
  for (const tag of tags) {
    const tagName = tag.tagName.text;
    const commentStr = getCommentText(tag.comment);
    if (!commentStr) continue;

    if (tagName === 'requires' || tagName === 'req') {
      specs.requires.push(cleanSpecCurlyBraces(commentStr));
    } else if (tagName === 'ensures' || tagName === 'ens') {
      specs.ensures.push(cleanSpecCurlyBraces(commentStr));
    } else if (tagName === 'case') {
      specs.cases.push(cleanSpecCurlyBraces(commentStr));
    } else if (tagName === 'pred') {
      specs.preds.push(commentStr);
    } else if (tagName === 'forall') {
      specs.foralls.push(commentStr);
    }
  }

  // Fallback: If no tags were found using getJSDocTags (which can happen if nodes aren't associated correctly),
  // we can also parse comments from the node's source text leading up to it.
  if (specs.requires.length === 0 && specs.ensures.length === 0 && specs.cases.length === 0 && specs.preds.length === 0) {
    extractFromLeadingComments(node, sourceFile, specs);
  }

  return specs;
}

function getCommentText(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
  if (!comment) return '';
  if (typeof comment === 'string') return comment.trim();
  
  // It's a NodeArray
  return comment
    .map(c => c.text)
    .join('')
    .trim();
}

/**
 * Removes leading '{' and trailing '}' if present around requires/ensures contents.
 */
function cleanSpecCurlyBraces(comment: string): string {
  let cleaned = comment.trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  return cleaned;
}

function extractFromLeadingComments(node: ts.Node, sourceFile: ts.SourceFile, specs: ExtractedSpecs) {
  const sourceText = sourceFile.text;
  const leadingComments = ts.getLeadingCommentRanges(sourceText, node.pos);
  if (!leadingComments) return;

  for (const range of leadingComments) {
    const commentText = sourceText.substring(range.pos, range.end);
    // Parse comments line by line
    const lines = commentText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/\*\s*@(requires|req|ensures|ens|case|pred|forall)\s+(.*)/);
      if (match) {
        const tag = match[1];
        const content = match[2].trim();
        if (tag === 'requires' || tag === 'req') {
          specs.requires.push(cleanSpecCurlyBraces(content));
        } else if (tag === 'ensures' || tag === 'ens') {
          specs.ensures.push(cleanSpecCurlyBraces(content));
        } else if (tag === 'case') {
          specs.cases.push(cleanSpecCurlyBraces(content));
        } else if (tag === 'pred') {
          specs.preds.push(content);
        } else if (tag === 'forall') {
          specs.foralls.push(content);
        }
      }
    }
  }
}
