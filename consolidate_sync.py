import sys
import asyncio
import os
import random
from pathlib import Path

sys.path.insert(0, "C:/Users/profs/Documents/Hermes/notebooklm-py/src")
import notebooklm  # type: ignore

OBSIDIAN_VAULT = os.environ.get("OBSIDIAN_VAULT", "C:/Users/profs/Desktop/Sandbox")
env_local = "C:/Users/profs/Documents/Hermes/hermes-hub/.env.local"
if os.path.exists(env_local):
    with open(env_local, "r") as f:
        for line in f:
            if line.strip().startswith("OBSIDIAN_VAULT="):
                OBSIDIAN_VAULT = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

VAULT_BASE = os.path.join(OBSIDIAN_VAULT, "Hermes OS")
NEW_NOTEBOOK_TITLE = "Hermes OS - Consolidated Knowledge Base"
MAX_FILES_PER_PART = 80  # Safe limit to keep each upload size reasonable and readable

def get_directory_groups():
    groups = {}
    for root, dirs, files in os.walk(VAULT_BASE):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            if file.endswith('.md'):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, VAULT_BASE)
                dir_name = os.path.dirname(rel_path).replace("\\", "/")
                if not dir_name:
                    dir_name = "Root"
                groups.setdefault(dir_name, []).append((file, full_path))
    return groups

async def main():
    async with await notebooklm.NotebookLMClient.from_storage() as client:
        print("Connecting to NotebookLM client...")
        notebooks = await client.notebooks.list()
        
        target_notebook = None
        for nb in notebooks:
            if nb.title == NEW_NOTEBOOK_TITLE:
                target_notebook = nb
                break
        
        if not target_notebook:
            print(f"Creating a fresh new notebook: '{NEW_NOTEBOOK_TITLE}'...")
            target_notebook = await client.notebooks.create(NEW_NOTEBOOK_TITLE)
            print(f"Created notebook successfully! ID: {target_notebook.id}")
        else:
            print(f"Found existing consolidated notebook: '{target_notebook.title}' (ID: {target_notebook.id})")
        
        # Get existing sources to avoid uploading duplicates
        print("Fetching existing sources...")
        existing_sources = await client.sources.list(target_notebook.id)
        existing_titles = {s.title for s in existing_sources}
        print(f"Found {len(existing_sources)} existing sources in consolidated notebook.")
        
        groups = get_directory_groups()
        print(f"Loaded {len(groups)} directory groups from local vault.")
        
        # Prepare uploads
        uploads = []
        for dir_name, files in sorted(groups.items()):
            files.sort()  # Sort for deterministic chunking
            
            # Chunk files into parts if too large
            if len(files) > MAX_FILES_PER_PART:
                chunks = [files[i:i + MAX_FILES_PER_PART] for i in range(0, len(files), MAX_FILES_PER_PART)]
                for part_idx, chunk in enumerate(chunks, 1):
                    title = f"[Consolidated] {dir_name} (Part {part_idx} of {len(chunks)})"
                    uploads.append((title, chunk))
            else:
                title = f"[Consolidated] {dir_name}"
                uploads.append((title, files))
                
        print(f"Consolidated into {len(uploads)} mega-sources for ingestion.")
        
        to_upload = [(title, chunk) for title, chunk in uploads if title not in existing_titles]
        print(f"Total new consolidated sources to ingest: {len(to_upload)}")
        
        if not to_upload:
            print("All consolidated sources are already synchronized!")
            return
            
        for idx, (title, chunk) in enumerate(to_upload, 1):
            print(f"\n[{idx}/{len(to_upload)}] Preparing: {title} ({len(chunk)} files)")
            
            # Combine content
            combined_parts = []
            for file, filepath in chunk:
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read().strip()
                    if content:
                        header = f"\n\n{'='*80}\nFILE: {file}\n{'='*80}\n\n"
                        combined_parts.append(header + content)
                except Exception as read_err:
                    print(f"Warning: Failed to read {file}: {read_err}")
                    
            combined_content = "".join(combined_parts).strip()
            if not combined_content:
                print(f"Skipping empty consolidated source: {title}")
                continue
                
            # Upload with backoff protection
            success = False
            backoff = 4.0
            for attempt in range(4):
                try:
                    print(f"Attempting upload to NotebookLM (size: {len(combined_content)} chars)...")
                    await client.sources.add_text(target_notebook.id, title, combined_content)
                    success = True
                    break
                except Exception as upload_err:
                    print(f"[Attempt {attempt+1}/4 Failed] Reason: {upload_err}")
                    if attempt < 3:
                        sleep_time = backoff + random.uniform(1.0, 2.0)
                        print(f"Waiting {sleep_time:.2f} seconds before retrying...")
                        await asyncio.sleep(sleep_time)
                        backoff *= 2.0
                    else:
                        print(f"CRITICAL: Failed to upload consolidated source {title}")
                        
            if success:
                print(f"Successfully uploaded: {title}")
                # Safe gap between consolidated uploads
                await asyncio.sleep(2.0 + random.uniform(0.5, 1.5))
            else:
                # Long pause on failure to reset API limits
                await asyncio.sleep(10.0)
                
        print("\nConsolidated Knowledge Ingestion Complete!")

if __name__ == "__main__":
    asyncio.run(main())
