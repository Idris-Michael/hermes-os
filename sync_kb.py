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
NOTEBOOK_ID = "fc885b4b-07e0-4c21-81f7-6220aaa3ee1b"

async def main():
    async with await notebooklm.NotebookLMClient.from_storage() as client:
        print(f"Connecting to NotebookLM client...")
        notebooks = await client.notebooks.list()
        target_notebook = None
        for nb in notebooks:
            if nb.id == NOTEBOOK_ID or nb.title == "Hermes OS - Knowledge Base & Vault":
                target_notebook = nb
                break
        
        if not target_notebook:
            print("Notebook 'Hermes OS - Knowledge Base & Vault' not found. Creating a new one...")
            target_notebook = await client.notebooks.create("Hermes OS - Knowledge Base & Vault")
        
        print(f"Active Notebook: '{target_notebook.title}' (ID: {target_notebook.id})")
        
        # Get existing sources to avoid duplicates
        print("Fetching existing sources in notebook...")
        existing_sources = await client.sources.list(target_notebook.id)
        existing_titles = {s.title for s in existing_sources}
        print(f"Found {len(existing_sources)} existing sources in NotebookLM.")
        
        # Find all markdown files in the Hermes OS vault
        print(f"Scanning Obsidian vault at {VAULT_BASE}...")
        all_md_files = []
        for root, dirs, files in os.walk(VAULT_BASE):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for file in files:
                if file.endswith('.md'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, VAULT_BASE)
                    # Use relative path as a clean, unique title
                    title = "Hermes OS / " + rel_path.replace("\\", "/")
                    all_md_files.append((title, full_path))
        
        print(f"Found {len(all_md_files)} markdown files in local vault.")
        
        # Ingest new files
        to_ingest = [(title, path) for title, path in all_md_files if title not in existing_titles]
        print(f"Total new files to ingest: {len(to_ingest)}")
        
        if not to_ingest:
            print("All files are already synchronized with NotebookLM!")
            return
        
        success_count = 0
        failed_count = 0
        total_count = len(to_ingest)
        
        print(f"Starting sequential ingestion queue with backoff protection...")
        
        # We will use sequential uploading with adaptive sleep to guarantee success
        base_sleep = 1.2
        for idx, (title, filepath) in enumerate(to_ingest, 1):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                if not content:
                    print(f"[{idx}/{total_count}] Skipping empty file: {title}")
                    continue
                
                # Retry loop with exponential backoff for this specific file
                success = False
                backoff = 3.0
                for attempt in range(4):
                    try:
                        await client.sources.add_text(target_notebook.id, title, content)
                        success = True
                        break
                    except Exception as upload_err:
                        print(f"\n[Attempt {attempt+1}/4 Failed] Error uploading: {title}")
                        print(f"Reason: {upload_err}")
                        if attempt < 3:
                            sleep_time = backoff + random.uniform(0.5, 1.5)
                            print(f"Backing off for {sleep_time:.2f} seconds before retrying...")
                            await asyncio.sleep(sleep_time)
                            backoff *= 2.0  # double the wait
                        else:
                            raise upload_err
                
                if success:
                    success_count += 1
                    print(f"[{idx}/{total_count}] OK: {title}")
                    # Adaptive standard sleep after successful upload
                    await asyncio.sleep(base_sleep + random.uniform(0.1, 0.4))
                else:
                    failed_count += 1
            except Exception as e:
                failed_count += 1
                print(f"[{idx}/{total_count}] CRITICAL FAILURE: {title} -> {e}")
                # Long pause after critical failure to let the API cooldown
                await asyncio.sleep(10.0)
        
        print(f"\nIngestion Sync Complete!")
        print(f"Successfully uploaded in this run: {success_count}")
        print(f"Failed in this run: {failed_count}")
        print(f"Total sources now in notebook: {len(existing_sources) + success_count}")
        print(f"Notebook URL: https://notebooklm.google.com/notebook/{target_notebook.id}")

if __name__ == "__main__":
    asyncio.run(main())
