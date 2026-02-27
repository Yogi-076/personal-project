import os

# Use current directory relative path
base_dir = os.path.dirname(os.path.abspath(__file__))
directory = os.path.join(base_dir, 'public', 'ptk', 'browser')
bridge_script = '<script type="module" src="assets/js/background-bridge.js"></script>'

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Inject after chrome-polyfill.js or semantic
        if bridge_script not in content:
            # We want to inject it LATE in the head or early body, but needs to be after libraries? 
            # Actually, standard scripts (polyfill) run significantly before modules sometimes, 
            # but we need Shim to be ready before Bridge runs.
            # Shim is sync script, Bridge is module. Shim runs first.
            if '</head>' in content:
                new_content = content.replace('</head>', f'{bridge_script}\n</head>')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Injected Bridge into {filename}")
        else:
            print(f"Already injected Bridge in {filename}")
