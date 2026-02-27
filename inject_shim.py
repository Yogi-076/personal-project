import os

# Use current directory relative path
base_dir = os.path.dirname(os.path.abspath(__file__))
directory = os.path.join(base_dir, 'public', 'ptk', 'browser')
polyfill_script = '<script src="../chrome-polyfill.js"></script>'

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if polyfill_script not in content:
            # Inject before the first script tag or inside head
            if '<head>' in content:
                new_content = content.replace('<head>', f'<head>\n  {polyfill_script}')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Injected into {filename}")
            else:
                print(f"No head tag in {filename}")
        else:
            print(f"Already injected in {filename}")
