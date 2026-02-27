import os

# Use current directory relative path
base_dir = os.path.dirname(os.path.abspath(__file__))
directory = os.path.join(base_dir, 'public', 'ptk', 'browser')
override_link = '<link rel="stylesheet" href="assets/css/ptk-theme-override.css" type="text/css" />'

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if override_link not in content:
            # Inject after the existing CSS links
            if '</head>' in content:
                new_content = content.replace('</head>', f'{override_link}\n</head>')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Injected CSS into {filename}")
            else:
                print(f"No head tag in {filename}")
        else:
            print(f"Already injected CSS in {filename}")
