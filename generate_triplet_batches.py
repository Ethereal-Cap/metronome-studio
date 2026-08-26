import json

def generate_balanced_4096_triplet_batches():
    beat_labels = ['1', '2', '3', '4']
    tiers = {i: [] for i in range(13)}

    for i in range(4096):
        bits = f"{i:012b}"
        note_count = bits.count('1')
        
        grid = []
        name_parts = []
        for b in range(4):
            p1 = bits[b * 3]
            p2 = bits[b * 3 + 1]
            p3 = bits[b * 3 + 2]
            
            b1 = ('accent' if b == 0 else 'normal') if p1 == '1' else 'mute'
            b2 = 'normal' if p2 == '1' else 'mute'
            b3 = 'normal' if p3 == '1' else 'mute'
            grid.append([b1, b2, b3])

            l1 = beat_labels[b] if p1 == '1' else '_'
            l2 = '+' if p2 == '1' else '_'
            l3 = 'a' if p3 == '1' else '_'
            name_parts.append(f"{l1}{l2}{l3}")
            
        pattern = {
            "id": i + 1,
            "bits": bits,
            "count": note_count,
            "grid": grid,
            "name": " ".join(name_parts)
        }
        tiers[note_count].append(pattern)

    # Interleave patterns from tiers into 228 batches (18 per batch for 1-227, 10 for 228)
    batches = [[] for _ in range(228)]
    
    # Priority order for tier distribution
    tier_order = [6, 5, 7, 4, 8, 3, 9, 2, 10, 1, 11, 0, 12]
    tier_indices = {t: 0 for t in range(13)}

    batch_idx = 0
    while any(tier_indices[t] < len(tiers[t]) for t in range(13)):
        pattern_added = False
        for t in tier_order:
            if tier_indices[t] < len(tiers[t]):
                if len(batches[batch_idx]) < 18 or batch_idx == 227:
                    batches[batch_idx].append(tiers[t][tier_indices[t]])
                    tier_indices[t] += 1
                    pattern_added = True
                    if len(batches[batch_idx]) == 18 and batch_idx < 227:
                        batch_idx += 1
        if not pattern_added:
            break

    batch_data = []
    for b_i, b_pats in enumerate(batches):
        batch_data.append({
            "batch": b_i + 1,
            "totalPatterns": len(b_pats),
            "patterns": b_pats
        })

    with open(r"G:\My Drive\Python Scripts\music\triplets_adv_batches.json", "w") as f:
        json.dump(batch_data, f, indent=2)

    with open(r"G:\My Drive\Python Scripts\music\triplets_adv_batches.js", "w") as f:
        f.write("const TRIPLETS_ADV_PREBUILT_BATCHES = " + json.dumps(batch_data) + ";")

    print(f"Successfully generated 228 balanced batches in triplets_adv_batches.json & triplets_adv_batches.js! Total patterns: {sum(len(b['patterns']) for b in batch_data)}")

generate_balanced_4096_triplet_batches()
