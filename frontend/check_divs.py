import re

def check_div_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    depth = 0
    for i, line in enumerate(lines):
        # Very simple regex for tags. Won't handle string literals or comments perfectly,
        # but in JSX it usually works okay for block-level.
        # Let's just remove comments for safety
        clean_line = re.sub(r'//.*', '', line)
        clean_line = re.sub(r'/\*.*?\*/', '', clean_line)
        
        opens = len(re.findall(r'<div\b[^>]*>', clean_line))
        closes = len(re.findall(r'</div\s*>', clean_line))
        
        depth += opens - closes
        if depth < 0:
            print(f"Depth went negative at line {i+1}: {line.strip()}")
            return
    print(f"Final depth: {depth}")

check_div_balance('src/pages/Dashboard.tsx')
