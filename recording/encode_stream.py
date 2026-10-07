import argparse
import bisect
import subprocess
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("stream")
parser.add_argument("output")
parser.add_argument("--start", type=float, required=True)
parser.add_argument("--end", type=float, required=True)
parser.add_argument("--fps", type=int, default=30)
args = parser.parse_args()
root = Path(args.stream)
entries = []
for line in (root / "index.tsv").read_text().splitlines():
    timestamp, name = line.split("\t")
    if name != "END":
        entries.append((float(timestamp), root / name))
times = [entry[0] for entry in entries]
fps = args.fps
width, height = 1920, 1080
command = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{width}x{height}", "-r", str(fps), "-i", "-", "-an",
           "-c:v", "libx264", "-crf", "14", "-preset", "slow",
           "-pix_fmt", "yuv420p", args.output]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
last_index = None
pixels = None
for frame in range(round((args.end - args.start) * fps)):
    timestamp = args.start + frame / fps
    index = max(0, bisect.bisect_right(times, timestamp) - 1)
    if index != last_index:
        image = Image.open(entries[index][1]).convert("RGB")
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (width, height), "#191919")
        canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
        pixels = canvas.tobytes()
        last_index = index
    process.stdin.write(pixels)
process.stdin.close()
if process.wait() != 0:
    raise SystemExit("Encoding failed")
print(f"Encoded {args.output}: {args.end - args.start:.3f}s; timestamps preserved")
