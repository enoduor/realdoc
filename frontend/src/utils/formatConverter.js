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

/**
 * Normalize analytics report to markdown string (for display/download).
 * API returns report as string; accept string or object for robustness.
 * @param {string|object} report - Analytics report (string markdown or object with content)
 * @returns {string} Markdown string
 */
export const analyticsReportToMarkdown = (report) => {
    if (report == null) return '';
    if (typeof report === 'string') return report;
    if (typeof report === 'object' && report.markdown) return report.markdown;
    if (typeof report === 'object' && report.report) return report.report;
    if (typeof report === 'object' && report.content) return report.content;
    return String(report);
};
