const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const mdPath = 'C:\\Users\\yogi\\.gemini\\antigravity\\brain\\b9d44adb-062a-4ad8-9feb-c958118ccf22\\vajrascan_comprehensive_documentation.md';
    const pdfPath = 'C:\\Users\\yogi\\.gemini\\antigravity\\brain\\b9d44adb-062a-4ad8-9feb-c958118ccf22\\VajraScan_Comprehensive_Documentation.pdf';
    
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;line-height:1.6;max-width:900px;margin:40px auto;padding:20px;color:#333;}
h1{color:#2c3e50;border-bottom:3px solid #3498db;padding-bottom:10px;margin-top:40px;}
h2{color:#34495e;border-bottom:2px solid #95a5a6;padding-bottom:8px;margin-top:30px;}
h3{color:#7f8c8d;margin-top:20px;}
h4{color:#95a5a6;}
table{border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;}
th,td{border:1px solid #ddd;padding:10px;text-align:left;}
th{background-color:#3498db;color:white;font-weight:bold;}
tr:nth-child(even){background-color:#f9f9f9;}
code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:Consolas,monospace;color:#e74c3c;}
pre{background:#2c3e50;color:#ecf0f1;padding:15px;border-radius:5px;overflow-x:auto;font-size:13px;}
blockquote{border-left:4px solid #3498db;padding-left:20px;margin:20px 0;color:#7f8c8d;background:#f8f9fa;padding:15px 20px;}
ul,ol{margin:15px 0;padding-left:30px;}
li{margin:8px 0;}
a{color:#3498db;text-decoration:none;}
hr{border:none;border-top:2px solid #ecf0f1;margin:30px 0;}
.page-break{page-break-after:always;}
</style>
</head><body>${mdContent
  .replace(/```mermaid[\\s\\S]*?```/g, '<div style="background:#f0f0f0;padding:20px;margin:20px 0;border-radius:5px;text-align:center;font-style:italic;color:#666;border:2px dashed #ccc;">[Architecture Diagram - See Markdown Version]</div>')
  .replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
  .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
  .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
  .replace(/^---$/gm, '<hr>')
  .replace(/\\n\\n/g, '<br><br>')
}</body></html>`;
    
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log('Generating PDF...');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true,
      preferCSSPageSize: true
    });
    
    await browser.close();
    console.log('SUCCESS: PDF generated at:', pdfPath);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
})();
