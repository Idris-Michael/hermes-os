import os

vault = "C:/Users/profs/Desktop/Sandbox/Hermes OS"
md_files = []
for root, dirs, files in os.walk(vault):
    # Exclude hidden files and directories
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for file in files:
        if file.endswith('.md'):
            md_files.append(os.path.join(root, file))

print(f"Total Obsidian .md files in Hermes OS: {len(md_files)}")
