"""
Supertonic TTS worker — called by hermes-hub server.ts
Usage: python tts_synthesize.py --text "..." --voice M1 --lang en --speed 1.0 --out path/to/out.wav
Exits 0 on success, prints JSON status to stdout.
"""
import argparse
import json
import sys
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", default="F1")
    parser.add_argument("--lang", default="en")
    parser.add_argument("--speed", type=float, default=1.05)
    parser.add_argument("--steps", type=int, default=8)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    try:
        from supertonic import TTS
        tts = TTS(auto_download=True)
        style = tts.get_voice_style(voice_name=args.voice)
        wav, duration = tts.synthesize(
            args.text,
            voice_style=style,
            speed=args.speed,
        )
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        tts.save_audio(wav, args.out)
        print(json.dumps({
            "ok": True,
            "out": args.out,
            "duration_s": float(duration[0]) if hasattr(duration, "__len__") else float(duration),
            "voice": args.voice,
            "lang": args.lang,
        }))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
