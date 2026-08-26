import json

def generate_balanced_256_batches():
    beat_labels = ['1', '2', '3', '4']
    tiers = {i: [] for i in range(9)}

    for i in range(256):
        bits = f"{i:08b}"
        note_count = bits.count('1')
        
        grid = []
        name_parts = []
        for b in range(4):
            p1 = bits[b * 2]
            p2 = bits[b * 2 + 1]
            
            b1 = ('accent' if b == 0 else 'normal') if p1 == '1' else 'mute'
            b2 = 'normal' if p2 == '1' else 'mute'
            grid.append([b1, b2])

            l1 = beat_labels[b] if p1 == '1' else '_'
            l2 = '&' if p2 == '1' else '_'
            name_parts.append(f"{l1}{l2}")
            
        pattern = {
            "id": i + 1,
            "bits": bits,
            "count": note_count,
            "grid": grid,
            "name": " ".join(name_parts)
        }
        tiers[note_count].append(pattern)

    # Interleave patterns from tiers into 15 batches (18 per batch for 1-14, 4 for 15)
    batches = [[] for _ in range(15)]
    
    # Order of tier picking for maximum variety per batch
    tier_order = [4, 3, 5, 2, 6, 1, 7, 0, 8]
    
    tier_indices = {t: 0 for t in range(9)}

    # Fill 18 patterns into batches 0 to 13, and remaining into batch 14
    batch_idx = 0
    while any(tier_indices[t] < len(tiers[t]) for t in range(9)):
        pattern_added = False
        for t in tier_order:
            if tier_indices[t] < len(tiers[t]):
                if len(batches[batch_idx]) < 18 or batch_idx == 14:
                    batches[batch_idx].append(tiers[t][tier_indices[t]])
                    tier_indices[t] += 1
                    pattern_added = True
                    if len(batches[batch_idx]) == 18 and batch_idx < 14:
                        batch_idx += 1
        if not pattern_added:
            break

    # Format JSON structure
    batch_data = []
    for b_i, b_pats in enumerate(batches):
        batch_data.append({
            "batch": b_i + 1,
            "totalPatterns": len(b_pats),
            "patterns": b_pats
        })

    with open(r"G:\My Drive\Python Scripts\music\eighths_adv_batches.json", "w") as f:
        json.dump(batch_data, f, indent=2)

    print(f"Successfully generated 15 balanced batches in eighths_adv_batches.json! Total patterns: {sum(len(b['patterns']) for b in batch_data)}")

generate_balanced_256_batches()
