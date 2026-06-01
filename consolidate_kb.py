import os
import sys

OBSIDIAN_VAULT = os.environ.get("OBSIDIAN_VAULT", "C:/Users/profs/Desktop/Sandbox")
env_local = "C:/Users/profs/Documents/Hermes/hermes-hub/.env.local"
if os.path.exists(env_local):
    with open(env_local, "r") as f:
        for line in f:
            if line.strip().startswith("OBSIDIAN_VAULT="):
                OBSIDIAN_VAULT = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

VAULT_BASE = os.path.join(OBSIDIAN_VAULT, "Hermes OS")

def get_directory_groups():
    groups = {}
    for root, dirs, files in os.walk(VAULT_BASE):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            if file.endswith('.md'):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, VAULT_BASE)
                dir_name = os.path.dirname(rel_path).replace("\\", "/")
                
                # If file is in the root vault folder, group it under "Root"
                if not dir_name:
                    dir_name = "Root"
                
                groups.setdefault(dir_name, []).append((file, full_path))
    return groups

def main():
    groups = get_directory_groups()
    print("Directory Consolidation Groups:")
    total_files = 0
    for name, files in sorted(groups.items()):
        print(f" - {name}: {len(files)} files")
        total_files += len(files)
    print(f"Total: {total_files} files across {len(groups)} directory groups.")

if __name__ == "__main__":
    main()
