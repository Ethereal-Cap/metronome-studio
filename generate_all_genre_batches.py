import json

def score_eighth_pattern(bits):
    # Iconic 8th note patterns in Rock, Metal, Jazz, Pop, Funk
    # bits is 8 chars: 1, 1&, 2, 2&, 3, 3&, 4, 4&
    genre_patterns = {
        "10101010": 100, # Quarters (Rock/Pop drive)
        "11111111": 99,  # Full 8ths (Rock/Metal drive)
        "01010101": 98,  # Offbeats (Reggae/Ska/Pop)
        "10001000": 97,  # Half notes (1 & 3)
        "10010000": 96,  # Charleston (1, 2&)
        "10010010": 95,  # 3-3-2 Tresillo (1, 2&, 4)
        "10011001": 94,  # Funk Push (1, 2&, 3, 4&)
        "01100110": 93,  # Reggae Skank (1&, 2, 3&, 4)
        "11101110": 92,  # Alternating 8ths/Quarters (1& 2 3& 4)
        "10111011": 91,  # Alternating Quarters/8ths (1 2& 3 4&)
        "11011101": 90,  # Syncopated Thrash/Metal
        "11111010": 89,  # Heavy Metal Push (1& 2& 3 4)
        "10101111": 88,  # Pop Rock 16th Prep (1 2 3& 4&)
        "10010110": 87,  # Son Clave 3-side
        "11001100": 86,  # Front-heavy 8ths (1& 2& 3 4)
        "00110011": 85,  # Back-heavy 8ths (1 2 3& 4&)
        "10000000": 84,  # Downbeat 1
        "00100000": 83,  # Downbeat 2
        "00001000": 82,  # Downbeat 3
        "00000010": 81,  # Downbeat 4
        "01000000": 80,  # Offbeat 1&
        "00010000": 79,  # Offbeat 2&
        "00000100": 78,  # Offbeat 3&
        "00000001": 77,  # Offbeat 4&
        "01111111": 76,  # Mute 1 gap test
        "10111111": 75,  # Mute 1& gap test
        "11011111": 74,  # Mute 2 gap test
        "11101111": 73,  # Mute 2& gap test
        "11110111": 72,  # Mute 3 gap test
        "11111011": 71,  # Mute 3& gap test
        "11111101": 70,  # Mute 4 gap test
        "11111110": 69   # Mute 4& gap test
    }
    return genre_patterns.get(bits, 0)

def score_triplet_pattern(bits):
    # Iconic 8th Triplet patterns in Jazz, Blues, Metal, Rock, Fusion
    # bits is 12 chars: 1 1+ 1a 2 2+ 2a 3 3+ 3a 4 4+ 4a
    genre_patterns = {
        "101101101101": 100, # Classic Jazz Swing / Shuffle (1 a 2 a 3 a 4 a)
        "110110110110": 99,  # Hard Triplet Shuffle (1 + 2 + 3 + 4 +)
        "111111111111": 98,  # Full Triplet Roll (1 + a 2 + a 3 + a 4 + a)
        "100100100100": 97,  # Quarter Note Triplet Pulse (1 2 3 4)
        "111100111100": 96,  # Iron Maiden / Metal Triplet Gallop (1+a 2 3+a 4)
        "100111100111": 95,  # Reverse Triplet Gallop (1 2+a 3 4+a)
        "111111100100": 94,  # Power Metal Breakdown (1+a 2+a 3 4)
        "101110101110": 93,  # 3:4 Metal Polyrhythm Triplet
        "100101100101": 92,  # Blues Rock Shuffle Accent
        "111111111100": 91,  # Triplet Fill Anticipation
        "100011100011": 90,  # Syncopated Fusion Push
        "100000100000": 89,  # Half note triplets (1 3)
        "101000101000": 88,  # Jazz Comping Triplet
        "001001001001": 87   # Pure Triplet Offbeats (a notes)
    }
    return genre_patterns.get(bits, 0)

def score_sixteenth_pattern(bits):
    # Iconic 16th note patterns in Funk, Disco, Metal, Rock, Pop
    # bits is 16 chars: 1 1e 1& 1a 2 2e 2& 2a 3 3e 3& 3a 4 4e 4& 4a
    genre_patterns = {
        "1111111111111111": 100, # Full 16th stream (1e&a 2e&a 3e&a 4e&a)
        "1010101010101010": 99,  # 8th note grid reference (1 & 2 & 3 & 4 &)
        "1000100010001000": 98,  # Quarter note pulse (1 2 3 4)
        "1001100110011001": 97,  # Funk 16th '1-a' Scratch (1 a 2 a 3 a 4 a)
        "1100110011001100": 96,  # Funk 16th '1-e' Push (1 e 2 e 3 e 4 e)
        "1110111011101110": 95,  # 16th '1-e-&' Grouping (Funk/Metal)
        "1011101110111011": 94,  # 16th '1-&-a' Motown Push (1 & a 2 & a 3 & a 4 & a)
        "1111100011111000": 93,  # Metal Double Bass 16th Burst
        "1110111011111000": 92,  # Thrash Metal Breakdown
        "1001110010011100": 91,  # Djent / Meshuggah Syncopated Accent
        "1111111110001000": 90,  # Metal Core 16th Chug
        "1010111110101111": 89,  # Rock 16th Snare Fill
        "1101110111011101": 88,  # Latin Samba 16th (1 e a)
        "1001101010011010": 87,  # Pop Ballad 16th Push
        "1110101111101011": 86,  # Linear Drumming / Paradiddle 16ths
        "0100010001000100": 85,  # 16th 'e' Offbeat Skank
        "0001000100010001": 84   # 16th 'a' Offbeat Skank
    }
    return genre_patterns.get(bits, 0)

def build_batches(num_bits, total_combos, batch_size, score_fn, json_path, js_path, js_var_name):
    beat_labels = ['1', '2', '3', '4']
    all_patterns = []

    for i in range(total_combos):
        bits = f"{i:0{num_bits}b}"
        count = bits.count('1')
        score = score_fn(bits)
        
        grid = []
        name_parts = []
        
        if num_bits == 8: # 8th notes (4 beats x 2 sub)
            for b in range(4):
                p1, p2 = bits[b*2], bits[b*2+1]
                b1 = ('accent' if b == 0 else 'normal') if p1 == '1' else 'mute'
                b2 = 'normal' if p2 == '1' else 'mute'
                grid.append([b1, b2])
                l1 = beat_labels[b] if p1 == '1' else '_'
                l2 = '&' if p2 == '1' else '_'
                name_parts.append(f"{l1}{l2}")
        elif num_bits == 12: # 8th triplets (4 beats x 3 sub)
            for b in range(4):
                p1, p2, p3 = bits[b*3], bits[b*3+1], bits[b*3+2]
                b1 = ('accent' if b == 0 else 'normal') if p1 == '1' else 'mute'
                b2 = 'normal' if p2 == '1' else 'mute'
                b3 = 'normal' if p3 == '1' else 'mute'
                grid.append([b1, b2, b3])
                l1 = beat_labels[b] if p1 == '1' else '_'
                l2 = '+' if p2 == '1' else '_'
                l3 = 'a' if p3 == '1' else '_'
                name_parts.append(f"{l1}{l2}{l3}")
        elif num_bits == 16: # 16th notes (4 beats x 4 sub)
            for b in range(4):
                p1, p2, p3, p4 = bits[b*4], bits[b*4+1], bits[b*4+2], bits[b*4+3]
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

        all_patterns.append({
            "id": i + 1,
            "bits": bits,
            "count": count,
            "score": score,
            "grid": grid,
            "name": " ".join(name_parts)
        })

    # Separate Genre High Priority patterns from remaining patterns
    genre_patterns = [p for p in all_patterns if p['score'] > 0]
    genre_patterns.sort(key=lambda x: x['score'], reverse=True)
    
    remaining_patterns = [p for p in all_patterns if p['score'] == 0]
    
    # Sort remaining patterns by density tiers for Maximum Variety Interleaving
    max_tier = num_bits
    tiers = {t: [] for t in range(max_tier + 1)}
    for p in remaining_patterns:
        tiers[p['count']].append(p)
        
    interleaved_remaining = []
    tier_indices = {t: 0 for t in range(max_tier + 1)}
    
    # Tier order preference: middle densities first
    mid = max_tier // 2
    tier_order = sorted(range(max_tier + 1), key=lambda t: abs(t - mid))
    
    while any(tier_indices[t] < len(tiers[t]) for t in range(max_tier + 1)):
        for t in tier_order:
            if tier_indices[t] < len(tiers[t]):
                interleaved_remaining.append(tiers[t][tier_indices[t]])
                tier_indices[t] += 1

    # Combine: Genre patterns FIRST, followed by Interleaved Remaining patterns
    ordered_all_patterns = genre_patterns + interleaved_remaining

    total_batches = (len(ordered_all_patterns) + batch_size - 1) // batch_size
    batches = []

    for b in range(total_batches):
        start = b * batch_size
        end = min(start + batch_size, len(ordered_all_patterns))
        pats = ordered_all_patterns[start:end]
        batches.append({
            "batch": b + 1,
            "totalPatterns": len(pats),
            "patterns": pats
        })

    with open(json_path, "w") as f:
        json.dump(batches, f, indent=2)

    with open(js_path, "w") as f:
        f.write(f"const {js_var_name} = " + json.dumps(batches) + ";")

    print(f"Generated {total_batches} batches for {js_var_name} ({len(genre_patterns)} Genre patterns up front, {len(remaining_patterns)} interleaved).")

def run_all():
    print("Generating Genre-Prioritized Batches...")
    build_batches(8, 256, 18, score_eighth_pattern,
                  r"G:\My Drive\Python Scripts\music\eighths_adv_batches.json",
                  r"G:\My Drive\Python Scripts\music\eighths_adv_batches.js",
                  "EIGHTHS_ADV_PREBUILT_BATCHES")

    build_batches(12, 4096, 18, score_triplet_pattern,
                  r"G:\My Drive\Python Scripts\music\triplets_adv_batches.json",
                  r"G:\My Drive\Python Scripts\music\triplets_adv_batches.js",
                  "TRIPLETS_ADV_PREBUILT_BATCHES")

    build_batches(16, 65536, 18, score_sixteenth_pattern,
                  r"G:\My Drive\Python Scripts\music\sixteenths_adv_batches.json",
                  r"G:\My Drive\Python Scripts\music\sixteenths_adv_batches.js",
                  "SIXTEENTHS_ADV_PREBUILT_BATCHES")

if __name__ == "__main__":
    run_all()
