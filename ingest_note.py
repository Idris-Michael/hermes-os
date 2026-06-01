import os
import json
import sys

# Setup API key and vault path from environments
def load_env_file(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    key, val = line.strip().split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

# Load central hub env first, then fall back to severus-social
load_env_file(os.path.join(os.path.dirname(__file__), "hermes-hub", ".env.local"))
load_env_file(os.path.join(os.path.dirname(__file__), "severus-social", ".env.local"))

def extract_graph_elements_heuristically(file_content, current_constellation_json, file_path):
    import re
    print("\n[Topology Engine] Engaging Local Heuristic Graph Compiler (No-API Fallback)...", file=sys.stderr)
    
    # Parse existing nodes to find ids
    existing_nodes = []
    try:
        current_data = json.loads(current_constellation_json)
        existing_nodes = current_data.get("nodes", [])
    except Exception:
        pass
    
    existing_node_ids = {node["id"] for node in existing_nodes}
    existing_node_labels = {node["label"].lower(): node["id"] for node in existing_nodes}
    
    # Extract potential node label and id from frontmatter or filename
    title = None
    # 1. Look for # header
    title_match = re.search(r"^#\s+(.+)$", file_content, re.MULTILINE)
    if title_match:
        title = title_match.group(1).strip()
    
    # 2. Look for title in frontmatter
    if not title:
        fm_title_match = re.search(r"^title:\s*[\"']?([^\"'\n]+)[\"']?$", file_content, re.MULTILINE)
        if fm_title_match:
            title = fm_title_match.group(1).strip()
            
    # 3. Fall back to base filename
    if not title and file_path:
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        # De-kebab or de-snake for nice label
        title = base_name.replace("-", " ").replace("_", " ").title()
        
    if not title:
        title = "Unnamed Node"
        
    # Simple ID generation from title
    node_id = re.sub(r"[^a-zA-Z0-9_]+", "_", title.lower()).strip("_")
    if not node_id and file_path:
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        node_id = re.sub(r"[^a-zA-Z0-9_]+", "_", base_name.lower()).strip("_")
    if not node_id:
        node_id = "generated_node"
        
    # Determine group based on content keywords
    group = "generated"
    content_lower = file_content.lower() + " " + title.lower()
    if "project" in content_lower or "active" in content_lower:
        group = "projects"
    elif "skill" in content_lower or "tool" in content_lower:
        group = "skills"
    elif "area" in content_lower or "moc" in content_lower:
        group = "areas"
    elif "system" in content_lower or "infrastructure" in content_lower:
        group = "systems"
        
    colors = {
        "projects": "#a855f7",
        "skills": "#22c55e",
        "areas": "#3b82f6",
        "systems": "#eab308",
        "generated": "#ef4444"
    }
    
    # Create the incoming node if not existing
    new_nodes = []
    if node_id not in existing_node_ids:
        new_nodes.append({
            "id": node_id,
            "label": title,
            "group": group,
            "val": 20,
            "color": colors.get(group, "#ef4444")
        })
        existing_node_ids.add(node_id)
        
    # Extract double-bracket links [[link_target]] or [[link_target|label]]
    wiki_links = re.findall(r"\[\[([^\]]+)\]\]", file_content)
    new_links = []
    
    for link_str in wiki_links:
        # Split alias
        parts = link_str.split("|")
        target_name = parts[0].strip()
        
        # Ignore empty links or system anchors
        if not target_name:
            continue
            
        # Generate target id
        target_id = re.sub(r"[^a-zA-Z0-9_]+", "_", target_name.lower()).strip("_")
        if not target_id:
            continue
            
        # Check if target exists in our graph
        if target_id not in existing_node_ids:
            # Let's see if we can find a fuzzy match by label
            matched_id = existing_node_labels.get(target_name.lower())
            if matched_id:
                target_id = matched_id
            else:
                # Add target as a stub node
                target_group = "generated"
                if "project" in target_name.lower():
                    target_group = "projects"
                elif "skill" in target_name.lower():
                    target_group = "skills"
                elif "area" in target_name.lower() or "moc" in target_name.lower():
                    target_group = "areas"
                elif "system" in target_name.lower():
                    target_group = "systems"
                    
                new_nodes.append({
                    "id": target_id,
                    "label": target_name,
                    "group": target_group,
                    "val": 12,
                    "color": colors.get(target_group, "#ef4444")
                })
                existing_node_ids.add(target_id)
                
        # Determine a semantic link type
        link_type = "REFERENCES"
        if "depend" in content_lower:
            link_type = "DEPENDS_ON"
        elif "integrate" in content_lower:
            link_type = "INTEGRATES_WITH"
        elif "implement" in content_lower:
            link_type = "IMPLEMENTS"
            
        # Add link from the new node to target
        new_links.append({
            "source": node_id,
            "target": target_id,
            "type": link_type,
            "curvature": 0.15
        })
        
    return {
        "new_nodes": new_nodes,
        "new_links": new_links
    }

def extract_graph_elements(file_content, current_constellation_json, file_path):
    # Try Gemini 3.5 Flash first if key is present
    if "GEMINI_API_KEY" in os.environ and os.environ["GEMINI_API_KEY"]:
        try:
            import google.generativeai as genai
            genai.configure(api_key=os.environ["GEMINI_API_KEY"])
            
            # Enforces explicit schema parameters onto Gemini 3.5 Flash
            model = genai.GenerativeModel(
                model_name="gemini-3.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
            
            prompt = f"""
            You are the Graph Topology Engine for Hermes OS.
            Analyze the incoming text/code file change and identify structural connections to existing nodes.

            INCOMING FILE:
            \"\"\"{file_content}\"\"\"

            CURRENT GRAPH TOPOLOGY:
            {current_constellation_json}

            TASK:
            1. Identify if this file creates a new entity (Node) or updates an old one.
            2. Extract semantic, functional, or system dependencies (Links).
            3. Categorize groupings strictly: [projects, skills, areas, systems, generated].
            4. Set "val" scale (size) proportional to the component's algorithmic complexity or connectivity weight.

            Output a clean JSON object containing ONLY two root lists: "new_nodes" and "new_links". Do not truncate or wrap in markdown formatting wrappers.
            """
            
            response = model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            print(f"Gemini API execution failed (prepayment quota/auth): {e}. Falling back to Anthropic Claude...", file=sys.stderr)

    # Try Anthropic Claude if key is present
    if "ANTHROPIC_API_KEY" in os.environ and os.environ["ANTHROPIC_API_KEY"]:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            
            prompt = f"""
            You are the Graph Topology Engine for Hermes OS.
            Analyze the incoming text/code file change and identify structural connections to existing nodes.

            INCOMING FILE:
            \"\"\"{file_content}\"\"\"

            CURRENT GRAPH TOPOLOGY:
            {current_constellation_json}

            TASK:
            1. Identify if this file creates a new entity (Node) or updates an old one.
            2. Extract semantic, functional, or system dependencies (Links).
            3. Categorize groupings strictly: [projects, skills, areas, systems, generated].
            4. Set "val" scale (size) proportional to the component's algorithmic complexity or connectivity weight.
            5. Return ONLY a valid JSON object containing exactly two keys: "new_nodes" and "new_links".
            
            Guidelines:
            - For nodes, ensure fields: "id" (string), "label" (string), "group" (string: one of [projects, skills, areas, systems, generated]), "val" (integer, e.g., 10-35), and optionally "color" matching standard system groupings.
            - For links, ensure fields: "source" (string, existing/new node id), "target" (string, existing/new node id), "type" (string, relationship name in caps like "DEPENDS_ON", "INTEGRATES_WITH", etc.), "curvature" (float between -0.3 and 0.3).
            - Do NOT include any explanations, markdown code block ticks (```json), or extra text. Output only raw JSON.
            """
            
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4000,
                temperature=0.0,
                system="You are an expert systems engineer and graph compiler. You output ONLY raw JSON.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            content = message.content[0].text.strip()
            if content.startswith("```json"):
                content = content[len("```json"):].strip()
            if content.endswith("```"):
                content = content[:-3].strip()
                
            return json.loads(content)
        except Exception as e:
            print(f"Anthropic API execution failed (prepayment quota/auth): {e}. Engaging local heuristic compiler fallback...", file=sys.stderr)

    # Ultimate Heuristic Fallback
    return extract_graph_elements_heuristically(file_content, current_constellation_json, file_path)

def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest_note.py <path_to_obsidian_note_or_file>", file=sys.stderr)
        sys.exit(1)
        
    input_file_path = sys.argv[1]
    if not os.path.exists(input_file_path):
        print(f"Error: Input file does not exist: {input_file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading incoming file: {input_file_path}")
    with open(input_file_path, "r", encoding="utf-8") as f:
        file_content = f.read()

    obsidian_vault = os.environ.get("OBSIDIAN_VAULT", r"C:\Users\profs\Desktop\Sandbox")
    constellation_path = os.path.join(obsidian_vault, "Hermes OS", "03 - SYSTEM", "constellation.json")
    if not os.path.exists(constellation_path):
        print(f"Error: constellation.json not found at: {constellation_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading current graph topology from: {constellation_path}")
    with open(constellation_path, "r", encoding="utf-8") as f:
        current_constellation_data = json.load(f)
        current_constellation_json = json.dumps(current_constellation_data, indent=2)

    print("Invoking Graph Topology Engine...")
    try:
        extracted = extract_graph_elements(file_content, current_constellation_json, input_file_path)
    except Exception as e:
        print(f"Error compiling graph topology: {e}", file=sys.stderr)
        sys.exit(1)

    new_nodes = extracted.get("new_nodes", [])
    new_links = extracted.get("new_links", [])

    print(f"\nExtracted from model:")
    print(f"  - New Nodes: {len(new_nodes)}")
    print(f"  - New Links: {len(new_links)}")

    # Merge nodes
    existing_node_ids = {node["id"] for node in current_constellation_data.get("nodes", [])}
    nodes_added = 0
    nodes_updated = 0

    for node in new_nodes:
        node_id = node.get("id")
        if not node_id:
            continue
        if node_id in existing_node_ids:
            # Update existing node fields
            for idx, existing_node in enumerate(current_constellation_data["nodes"]):
                if existing_node["id"] == node_id:
                    current_constellation_data["nodes"][idx].update(node)
                    nodes_updated += 1
                    break
        else:
            current_constellation_data["nodes"].append(node)
            existing_node_ids.add(node_id)
            nodes_added += 1

    # Merge links
    existing_links = {
        (link["source"], link["target"], link.get("type", ""))
        for link in current_constellation_data.get("links", [])
    }
    links_added = 0

    for link in new_links:
        src = link.get("source")
        tgt = link.get("target")
        ltype = link.get("type", "")
        if not src or not tgt:
            continue
        # Make sure source and target nodes exist in the combined nodes list
        if src not in existing_node_ids or tgt not in existing_node_ids:
            print(f"Warning: Link target or source not present in nodes, skipping: {src} -> {tgt}")
            continue
            
        link_key = (src, tgt, ltype)
        if link_key not in existing_links:
            # Ensure curvature default is present if model did not output it
            if "curvature" not in link:
                link["curvature"] = 0.15
            current_constellation_data["links"].append(link)
            existing_links.add(link_key)
            links_added += 1

    print(f"\nMerge Status:")
    print(f"  - Nodes Added: {nodes_added}")
    print(f"  - Nodes Updated: {nodes_updated}")
    print(f"  - Links Added: {links_added}")

    # Write back to constellation.json
    print(f"Saving updated graph to: {constellation_path}")
    with open(constellation_path, "w", encoding="utf-8") as f:
        json.dump(current_constellation_data, f, indent=2)

    print("\nSuccess! Constellation graph updated successfully.")

if __name__ == "__main__":
    main()
