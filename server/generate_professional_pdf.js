const fs = require('fs');
const puppeteer = require('puppeteer');

const mdPath = 'd:\\coding\\VAPT Framework\\lovable-security-framework-main\\VajraScan_Documentation.md';
const pdfPath = 'd:\\coding\\VAPT Framework\\lovable-security-framework-main\\VajraScan_Professional_Documentation.pdf';

console.log('Reading markdown file...');
const mdContent = fs.readFileSync(mdPath, 'utf8');

// Convert markdown to HTML with professional styling
const lines = mdContent.split('\n');
let htmlBody = '';
let inCodeBlock = false;
let codeContent = '';
let inList = false;

for (let line of lines) {
    // Handle code blocks
    if (line.startsWith('```')) {
        if (!inCodeBlock) {
            inCodeBlock = true;
            codeContent = '';
        } else {
            htmlBody += `<pre><code>${codeContent}</code></pre>`;
            inCodeBlock = false;
            codeContent = '';
        }
        continue;
    }

    if (inCodeBlock) {
        codeContent += line.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
        continue;
    }

    // Handle headings
    if (line.startsWith('# ')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += `<h1 class="main-title">${line.substring(2)}</h1>`;
    } else if (line.startsWith('## ')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += `<h2>${line.substring(3)}</h2>`;
    } else if (line.startsWith('### ')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += `<h3>${line.substring(4)}</h3>`;
    } else if (line.startsWith('#### ')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += `<h4>${line.substring(5)}</h4>`;
    }
    // Handle lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { htmlBody += '<ul>'; inList = true; }
        const content = line.substring(2)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
        htmlBody += `<li>${content}</li>`;
    }
    // Handle blockquotes
    else if (line.startsWith('> ')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += `<blockquote>${line.substring(2)}</blockquote>`;
    }
    // Handle horizontal rules
    else if (line.trim() === '---') {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        htmlBody += '<hr>';
    }
    // Handle tables
    else if (line.trim().startsWith('|')) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        // Simple table handling - just preserve as is for now
        htmlBody += `<p class="table-row">${line}</p>`;
    }
    // Handle regular paragraphs
    else if (line.trim()) {
        if (inList) { htmlBody += '</ul>'; inList = false; }
        const content = line
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
        htmlBody += `<p>${content}</p>`;
    }
}

if (inList) htmlBody += '</ul>';

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm;
    }
    
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      color: #2c3e50;
      font-size: 11pt;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }
    
    h1.main-title {
      color: #ffffff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      margin: -10mm -10mm 30px -10mm;
      font-size: 32pt;
      text-align: center;
      page-break-after: avoid;
      border-bottom: 6px solid #3498db;
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
      font-weight: 700;
      letter-spacing: 1px;
    }
    
    h1 {
      color: #2c3e50;
      font-size: 24pt;
      border-bottom: 4px solid #3498db;
      padding-bottom: 15px;
      margin-top: 50px;
      margin-bottom: 25px;
      page-break-before: always;
      page-break-after: avoid;
      font-weight: 700;
    }
    
    h2 {
      color: #34495e;
      font-size: 18pt;
      border-bottom: 3px solid #95a5a6;
      padding-bottom: 12px;
      margin-top: 35px;
      margin-bottom: 20px;
      page-break-after: avoid;
      font-weight: 600;
    }
    
    h3 {
      color: #7f8c8d;
      font-size: 14pt;
      margin-top: 28px;
      margin-bottom: 15px;
      font-weight: 600;
      page-break-after: avoid;
    }
    
    h4 {
      color: #95a5a6;
      font-size: 12pt;
      margin-top: 22px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    
    p {
      margin: 14px 0;
      text-align: justify;
      orphans: 3;
      widows: 3;
      line-height: 1.8;
    }
    
    code {
      background: #f4f4f4;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      color: #e74c3c;
      font-size: 10pt;
      border: 1px solid #e0e0e0;
    }
    
    pre {
      background: #2c3e50;
      color: #ecf0f1;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 9pt;
      page-break-inside: avoid;
      border-left: 5px solid #3498db;
      box-shadow: 0 3px 6px rgba(0,0,0,0.1);
      margin: 20px 0;
    }
    
    pre code {
      background: transparent;
      border: none;
      color: #ecf0f1;
      padding: 0;
    }
    
    blockquote {
      border-left: 5px solid #3498db;
      padding: 18px 28px;
      margin: 25px 0;
      background: linear-gradient(to right, #f8f9fa 0%, #ffffff 100%);
      color: #34495e;
      page-break-inside: avoid;
      border-radius: 6px;
      font-style: italic;
      box-shadow: 0 3px 6px rgba(0,0,0,0.08);
    }
    
    ul {
      margin: 18px 0;
      padding-left: 40px;
    }
    
    li {
      margin: 12px 0;
      line-height: 1.7;
    }
    
    strong {
      color: #2c3e50;
      font-weight: 600;
    }
    
    em {
      color: #7f8c8d;
      font-style: italic;
    }
    
    hr {
      border: none;
      border-top: 3px solid #ecf0f1;
      margin: 45px 0;
    }
    
    .table-row {
      font-family: 'Consolas', monospace;
      font-size: 9pt;
      background: #f8f9fa;
      padding: 8px;
      margin: 2px 0;
      border-left: 3px solid #3498db;
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

console.log('Launching browser...');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    console.log('Generating professional PDF...');

    await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: {
            top: '25mm',
            right: '20mm',
            bottom: '25mm',
            left: '20mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:9pt;color:#7f8c8d;width:100%;text-align:center;padding-top:10mm;font-family:Arial">VajraScan VAPT Framework - Technical Documentation</div>',
        footerTemplate: '<div style="font-size:9pt;color:#7f8c8d;width:100%;text-align:center;padding-bottom:5mm;font-family:Arial">Page <span class="pageNumber"></span> of <span class="totalPages"></span> | © 2026 Fornsec Solutions</div>'
    });

    await browser.close();

    console.log('✓ Professional PDF created successfully!');
    console.log('Location:', pdfPath);

    // Get file size
    const stats = fs.statSync(pdfPath);
    console.log('File size:', Math.round(stats.size / 1024), 'KB');
})();
