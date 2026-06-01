import os
import json
import re
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
CONSTELLATION_PATH = os.path.join(VAULT_BASE, "03 - SYSTEM", "constellation.json")

def clean_id(name):
    # Match how ingest_note.py generates node IDs
    return re.sub(r"[^a-zA-Z0-9_]+", "_", name.lower()).strip("_")

def main():
    if not os.path.exists(CONSTELLATION_PATH):
        print(f"Error: constellation.json not found at {CONSTELLATION_PATH}")
        sys.exit(1)
        
    print(f"Reading existing constellation from: {CONSTELLATION_PATH}")
    with open(CONSTELLATION_PATH, "r", encoding="utf-8") as f:
        graph = json.load(f)
        
    existing_nodes = {node["id"]: node for node in graph.get("nodes", [])}
    existing_links = {
        (link["source"], link["target"], link.get("type", ""))
        for link in graph.get("links", [])
    }
    
    print(f"Current graph statistics: {len(existing_nodes)} nodes, {len(existing_links)} links.")
    
    print(f"Scanning Obsidian vault at {VAULT_BASE}...")
    md_files = []
    for root, dirs, files in os.walk(VAULT_BASE):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            if file.endswith('.md'):
                md_files.append(os.path.join(root, file))
                
    print(f"Found {len(md_files)} markdown files. Rebuilding/updating graph topology...")
    
    colors = {
        "projects": "#a855f7",
        "skills": "#22c55e",
        "areas": "#ec4899",
        "systems": "#0ea5e9",
        "generated": "#ef4444"
    }
    
    nodes_added = 0
    links_added = 0
    
    for filepath in md_files:
        base_name = os.path.splitext(os.path.basename(filepath))[0]
        node_id = clean_id(base_name)
        if not node_id:
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Determine group
        group = "generated"
        content_lower = content.lower() + " " + base_name.lower()
        if "project" in content_lower or "active" in content_lower:
            group = "projects"
        elif "skill" in content_lower or "tool" in content_lower:
            group = "skills"
        elif "area" in content_lower or "moc" in content_lower:
            group = "areas"
        elif "system" in content_lower or "infrastructure" in content_lower:
            group = "systems"
            
        # Create node if it doesn't exist
        if node_id not in existing_nodes:
            # Look for title header
            title = base_name.replace("-", " ").replace("_", " ").title()
            title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
            if title_match:
                title = title_match.group(1).strip()
            
            existing_nodes[node_id] = {
                "id": node_id,
                "label": title,
                "group": group,
                "val": 20 if group != "generated" else 12,
                "color": colors.get(group, "#ef4444")
            }
            nodes_added += 1
            
        # Extract double bracket links [[link_target]] or [[link_target|label]]
        wiki_links = re.findall(r"\[\[([^\]]+)\]\]", content)
        for link_str in wiki_links:
            parts = link_str.split("|")
            target_name = parts[0].strip()
            if not target_name:
                continue
                
            target_id = clean_id(target_name)
            if not target_id:
                continue
                
            # Create target stub if not exists
            if target_id not in existing_nodes:
                target_group = "generated"
                if "project" in target_name.lower():
                    target_group = "projects"
                elif "skill" in target_name.lower():
                    target_group = "skills"
                elif "area" in target_name.lower() or "moc" in target_name.lower():
                    target_group = "areas"
                elif "system" in target_name.lower():
                    target_group = "systems"
                    
                existing_nodes[target_id] = {
                    "id": target_id,
                    "label": target_name,
                    "group": target_group,
                    "val": 12,
                    "color": colors.get(target_group, "#ef4444")
                }
                nodes_added += 1
                
            # Add link from node_id to target_id
            link_type = "REFERENCES"
            if "depend" in content_lower:
                link_type = "DEPENDS_ON"
            elif "integrate" in content_lower:
                link_type = "INTEGRATES_WITH"
            elif "implement" in content_lower:
                link_type = "IMPLEMENTS"
                
            link_key = (node_id, target_id, link_type)
            if link_key not in existing_links:
                graph.setdefault("links", []).append({
                    "source": node_id,
                    "target": target_id,
                    "type": link_type,
                    "curvature": 0.15
                })
                existing_links.add(link_key)
                links_added += 1
                
    # Save back to graph
    graph["nodes"] = list(existing_nodes.values())
    
    print(f"\nRebuild completed:")
    print(f"  - Nodes Added/Updated: {nodes_added}")
    print(f"  - Links Added/Updated: {links_added}")
    print(f"  - Total Nodes: {len(graph['nodes'])}")
    print(f"  - Total Links: {len(graph.get('links', []))}")
    
    with open(CONSTELLATION_PATH, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2)
    print("Successfully saved updated constellation graph!")

if __name__ == "__main__":
    main()
