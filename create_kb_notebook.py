import sys, asyncio, os
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

VAULT_BASE = f"{OBSIDIAN_VAULT}/Hermes OS"

SOURCES = [
    ("Hermes OS — Knowledge Base Index",          f"{VAULT_BASE}/07 Reference/Cloned Repos/README.md"),
    ("jcodemunch-mcp — AST Codebase Indexer",     f"{VAULT_BASE}/07 Reference/Cloned Repos/jcodemunch-mcp.md"),
    ("mattpocock-skills — Real Engineering Skills",f"{VAULT_BASE}/07 Reference/Cloned Repos/mattpocock-skills.md"),
    ("andrej-karpathy-skills — 4 Coding Principles",f"{VAULT_BASE}/07 Reference/Cloned Repos/andrej-karpathy-skills.md"),
    ("clean-code-skills — 66 Clean Code Rules",   f"{VAULT_BASE}/07 Reference/Cloned Repos/clean-code-skills.md"),
    ("rtk — Rust Token Killer",                   f"{VAULT_BASE}/07 Reference/Cloned Repos/rtk.md"),
    ("severus-social — Pipeline Codebase Map",    f"{VAULT_BASE}/01 - ACTIVE/projects/severus-social/codebase-map.md"),
    ("Hermes OS — HOME",                          f"{VAULT_BASE}/HOME.md"),
    ("Memory Index — Project State",              f"{VAULT_BASE}/06 Memory/project-state.md"),
]

async def main():
    async with await notebooklm.NotebookLMClient.from_storage() as client:
        print("Creating notebook: Hermes OS - Knowledge Base & Vault")
        notebook = await client.notebooks.create("Hermes OS - Knowledge Base & Vault")
        print(f"Created: {notebook.id}")

        for title, filepath in SOURCES:
            print(f"Adding: {title}")
            try:
                content = open(filepath, encoding="utf-8").read()
                await client.sources.add_text(notebook.id, title, content)
                await asyncio.sleep(2)
            except Exception as e:
                print(f"  ERROR: {e}")

        print(f"\nDone.")
        print(f"URL: https://notebooklm.google.com/notebook/{notebook.id}")

if __name__ == "__main__":
    asyncio.run(main())
