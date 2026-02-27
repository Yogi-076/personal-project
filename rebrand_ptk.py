import os
import re

# Use current directory relative path
base_dir = os.path.dirname(os.path.abspath(__file__))
directory = os.path.join(base_dir, 'public', 'ptk')

# Replacements Map (Regex -> Replacement)
replacements = [
    # HTML Titles and Visible Text
    (r'<title>OWASP Penetration Testing Kit - (.*?)</title>', r'<title>VAPT Pro - \1</title>'),
    (r'<title>OWASP Penetration Testing Kit</title>', r'<title>VAPT Framework Pro</title>'),
    (r'OWASP Penetration Testing Kit', 'VAPT Framework Pro'),
    (r'OWASP PTK', 'VAPT Pro'),
    
    # Author Comments
    (r'/\* Author: Denis Podgurskii \*/', '/* Integrated by: VAPT Framework Team */'),
    (r'Author: Denis Podgurskii', 'Author: VAPT Framework Team'),
    
    # Links and Emails
    (r'https://pentestkit.co.uk', '#'),
    (r'info@pentestkit.co.uk', 'support@vapt-framework.local'),
    (r'https://twitter.com/pentestkit', '#'),
    
    # Specific UI Elements
    (r'OWASP Secure Headers', 'Security Framework Headers'),
    (r'OWASP Juice Shop', 'Vulnerable Target Demo'),
    
    # Clean up "About" links
    (r'href="https://pentestkit.co.uk/howto.html"', 'href="#"'),
    (r'href="https://pentestkit.co.uk/release_notes.html"', 'href="#"'),
    
    # Remove specific footer credits if they exist (simple string replace)
    (r'By email: support@vapt-framework.local', ''), 
    (r'By visiting this page on our website: <a href="#" target="_blank">#</a>', '')
]

extensions = ['.html', '.js', '.css']

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for pattern, replacement in replacements:
            # Use regex sub for pattern matching
            content = re.sub(pattern, replacement, content)
            
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updates: {filepath}")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

for root, dirs, files in os.walk(directory):
    for filename in files:
        if any(filename.endswith(ext) for ext in extensions):
            process_file(os.path.join(root, filename))

print("Rebranding Complete.")
