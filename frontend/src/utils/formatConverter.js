import { marked } from 'marked';
import TurndownService from 'turndown';

// Configure marked for safe HTML rendering
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
});

// Configure Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**'
});

/**
 * Convert Markdown to HTML
 * @param {string} markdown - Markdown text
 * @returns {string} HTML string
 */
export const markdownToHtml = (markdown) => {
    if (!markdown) return '';
    try {
        return marked.parse(markdown);
    } catch (error) {
        console.error('Error converting markdown to HTML:', error);
        return `<pre>${markdown}</pre>`;
    }
};

/**
 * Convert HTML to Markdown
 * @param {string} html - HTML string
 * @returns {string} Markdown text
 */
export const htmlToMarkdown = (html) => {
    if (!html) return '';
    try {
        return turndownService.turndown(html);
    } catch (error) {
        console.error('Error converting HTML to markdown:', error);
        return html;
    }
};

/**
 * Check if content is HTML
 * @param {string} content - Content to check
 * @returns {boolean} True if content appears to be HTML
 */
export const isHtml = (content) => {
    if (!content) return false;
    // Check for HTML tags
    const htmlTagRegex = /<[^>]+>/;
    return htmlTagRegex.test(content);
};
