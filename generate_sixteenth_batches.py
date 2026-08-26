import json

def generate_balanced_65536_sixteenth_batches():
    beat_labels = ['1', '2', '3', '4']
    tiers = {i: [] for i in range(17)}

    for i in range(65536):
        bits = f"{i:016b}"
        note_count = bits.count('1')
        
        grid = []
        name_parts = []
        for b in range(4):
            p1 = bits[b * 4]
            p2 = bits[b * 4 + 1]
            p3 = bits[b * 4 + 2]
            p4 = bits[b * 4 + 3]
            
            b1 = ('accent' if b == 0 else 'normal') if p1 == '1' else 'mute'
            b2 = 'normal' if p2 == '1' else 'mute'
            b3 = 'normal' if p3 == '1' else 'mute'
            b4 = 'normal' if p4 == '1' else 'mute'
            grid.append([b1, b2, b3, b4])

            l1 = beat_labels[b] if p1 == '1' else '_'
            l2 = 'e' if p2 == '1' else '_'
            l3 = '&' if p3 == '1' else '_'
            l4 = 'a' if p4 == '1' else '_'
            name_parts.append(f"{l1}{l2}{l3}{l4}")
            
        pattern = {
            "id": i + 1,
            "bits": bits,
            "count": note_count,
            "grid": grid,
            "name": " ".join(name_parts)
        }
        tiers[note_count].append(pattern)

    # Interleave patterns from tiers into 3641 batches (18 per batch for 1-3640, 16 for 3641)
    batches = [[] for _ in range(3641)]
    
    # Priority order for tier distribution
    tier_order = [8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15, 0, 16]
    tier_indices = {t: 0 for t in range(17)}

    batch_idx = 0
    while any(tier_indices[t] < len(tiers[t]) for t in range(17)):
        pattern_added = False
        for t in tier_order:
            if tier_indices[t] < len(tiers[t]):
                if len(batches[batch_idx]) < 18 or batch_idx == 3640:
                    batches[batch_idx].append(tiers[t][tier_indices[t]])
                    tier_indices[t] += 1
                    pattern_added = True
                    if len(batches[batch_idx]) == 18 and batch_idx < 3640:
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

    with open(r"G:\My Drive\Python Scripts\music\sixteenths_adv_batches.json", "w") as f:
        json.dump(batch_data, f, indent=2)

    with open(r"G:\My Drive\Python Scripts\music\sixteenths_adv_batches.js", "w") as f:
        f.write("const SIXTEENTHS_ADV_PREBUILT_BATCHES = " + json.dumps(batch_data) + ";")

    print(f"Successfully generated 3,641 balanced batches in sixteenths_adv_batches.json & sixteenths_adv_batches.js! Total patterns: {sum(len(b['patterns']) for b in batch_data)}")

generate_balanced_65536_sixteenth_batches()
