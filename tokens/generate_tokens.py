import json
import os

# Configuration
TOKENS_FILE = 'design-tokens.json'
ANDROID_OUTPUT = '../app/src/main/java/com/portfolio/videostreaming/ui/theme/Color.kt'

def to_kotlin_name(name):
    # Convert heritage-black to HeritageBlack
    return ''.join(word.capitalize() for word in name.split('-'))

def to_android_color(hex_color):
    # Convert #0C0A09 to Color(0xFF0C0A09)
    return f"Color(0xFF{hex_color[1:].upper()})"

def generate_android_tokens(tokens):
    os.makedirs(os.path.dirname(ANDROID_OUTPUT), exist_ok=True)

    with open(ANDROID_OUTPUT, 'w') as f:
        f.write("package com.portfolio.videostreaming.ui.theme\n\n")
        f.write("import androidx.compose.ui.graphics.Color\n\n")
        f.write("/**\n")
        f.write(" * AUTO-GENERATED DESIGN TOKENS\n")
        f.write(f" * Source: {TOKENS_FILE}\n")
        f.write(" * Do not modify manually.\n")
        f.write(" */\n\n")

        for name, value in tokens['colors'].items():
            f.write(f"val {to_kotlin_name(name)} = {to_android_color(value)}\n")

        # Add the legacy GoldGlow which is a derived color
        f.write("\n// Derived Colors\n")
        f.write("val GoldGlow = Amber500.copy(alpha = 0.2f)\n")

def main():
    if not os.path.exists(TOKENS_FILE):
        print(f"Error: {TOKENS_FILE} not found.")
        return

    with open(TOKENS_FILE, 'r') as f:
        tokens = json.load(f)

    print("Generating Android tokens...")
    generate_android_tokens(tokens)
    print("Done.")

if __name__ == "__main__":
    main()
